import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/server/auth/authorization";
import { db } from "@/server/db/prisma";

export const dynamic = "force-dynamic";

const statuses = ["SCHEDULED", "CONFIRMED", "CHECKED_IN", "IN_CONSULTATION", "COMPLETED", "CANCELLED", "NO_SHOW"] as const;
const appointmentSchema = z.object({
  patientId: z.string().uuid(),
  doctorUserId: z.string().uuid(),
  appointmentDate: z.string().date(),
  appointmentTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Invalid appointment time."),
  appointmentType: z.string().trim().min(2).max(100),
  treatment: z.string().trim().max(160).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  status: z.enum(statuses).optional()
});

type AppointmentData = z.infer<typeof appointmentSchema>;
type AppointmentEvent = { id: string; occurredAt: Date; actorUserId: string | null; resourceId: string | null; action: string; metadata: unknown };

function serialize(event: AppointmentEvent) {
  const data = (event.metadata ?? {}) as AppointmentData & {
    appointmentNumber?: string; status?: string; patientName?: string; patientNumber?: string; mobile?: string; doctorName?: string;
  };
  return {
    id: event.resourceId ?? event.id,
    appointmentNumber: data.appointmentNumber ?? "APT-" + (event.resourceId ?? event.id).slice(0, 8).toUpperCase(),
    createdAt: event.occurredAt.toISOString(),
    patientId: data.patientId,
    patientNumber: data.patientNumber ?? "",
    patientName: data.patientName ?? "",
    mobile: data.mobile ?? "",
    doctorUserId: data.doctorUserId,
    doctorName: data.doctorName ?? "",
    appointmentDate: data.appointmentDate,
    appointmentTime: data.appointmentTime,
    appointmentType: data.appointmentType,
    treatment: data.treatment ?? "",
    notes: data.notes ?? "",
    status: data.status ?? "SCHEDULED"
  };
}

async function doctorOptions(organizationId: string, clinicLocationId: string | null) {
  const assignments = await db.userRole.findMany({
    where: { organizationId, role: { name: "DOCTOR" }, user: { isActive: true }, OR: [{ clinicLocationId }, { clinicLocationId: null }] },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { user: { name: "asc" } }
  });
  const seen = new Set<string>();
  return assignments
    .filter((item) => {
      if (seen.has(item.user.id)) return false;
      seen.add(item.user.id);
      return true;
    })
    .map((item) => ({ id: item.user.id, name: item.user.name?.trim() || item.user.email }));
}

async function currentAppointments(organizationId: string, date?: string) {
  const events = await db.auditEvent.findMany({
    where: { organizationId, resourceType: "APPOINTMENT", ...(date ? { metadata: { path: ["appointmentDate"], equals: date } } : {}) },
    orderBy: { occurredAt: "desc" },
    take: 5000
  }) as AppointmentEvent[];
  const latest = new Map<string, AppointmentEvent>();
  for (const event of events) {
    const id = event.resourceId ?? event.id;
    if (!latest.has(id)) latest.set(id, event);
  }
  return [...latest.values()].filter((event) => event.action !== "APPOINTMENT_DELETED").map(serialize);
}

async function patientForAppointment(organizationId: string, patientId: string) {
  const events = await db.auditEvent.findMany({
    where: { organizationId, resourceType: "PATIENT", resourceId: patientId },
    orderBy: { occurredAt: "desc" },
    take: 1
  });
  const event = events[0];
  if (!event || event.action === "PATIENT_DELETED") return null;
  const data = (event.metadata ?? {}) as { patientNumber?: string; name?: string; mobile?: string };
  return { patientNumber: data.patientNumber ?? "", name: data.name ?? "", mobile: data.mobile ?? "" };
}

async function doctorName(organizationId: string, doctorUserId: string, clinicLocationId: string | null) {
  const doctors = await doctorOptions(organizationId, clinicLocationId);
  return doctors.find((doctor) => doctor.id === doctorUserId)?.name ?? null;
}

async function findAppointment(organizationId: string, appointmentId: string) {
  const appointments = await currentAppointments(organizationId);
  return appointments.find((appointment) => appointment.id === appointmentId) ?? null;
}

async function saveAppointmentEvent(user: { id: string; organizationId: string }, appointmentId: string, action: string, metadata: Record<string, unknown>) {
  return db.auditEvent.create({
    data: {
      organizationId: user.organizationId,
      actorUserId: user.id,
      resourceId: appointmentId,
      action,
      resourceType: "APPOINTMENT",
      metadata
    }
  });
}

export async function GET(request: Request) {
  const user = await requirePermission("reception.manage");
  const params = new URL(request.url).searchParams;
  const date = params.get("date") || undefined;
  const doctors = await doctorOptions(user.organizationId, user.clinicLocationId ?? null);
  const appointments = await currentAppointments(user.organizationId, date);
  return NextResponse.json({ doctors, appointments });
}

export async function POST(request: Request) {
  const user = await requirePermission("reception.manage");
  const parsed = appointmentSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Please check the appointment details." }, { status: 400 });

  const patient = await patientForAppointment(user.organizationId, parsed.data.patientId);
  if (!patient) return NextResponse.json({ error: "Patient not found." }, { status: 404 });

  const selectedDoctorName = await doctorName(user.organizationId, parsed.data.doctorUserId, user.clinicLocationId ?? null);
  if (!selectedDoctorName) return NextResponse.json({ error: "Selected doctor is not available for this clinic." }, { status: 400 });

  const sameDay = await currentAppointments(user.organizationId, parsed.data.appointmentDate);
  const conflict = sameDay.find((appointment) =>
    appointment.doctorUserId === parsed.data.doctorUserId &&
    appointment.appointmentTime === parsed.data.appointmentTime &&
    !["CANCELLED", "NO_SHOW", "COMPLETED"].includes(appointment.status)
  );
  if (conflict) return NextResponse.json({ error: "This doctor already has an appointment at that time.", conflict }, { status: 409 });

  const appointmentId = crypto.randomUUID();
  const datePrefix = parsed.data.appointmentDate.replaceAll("-", "").slice(2);
  const existingNumbers = sameDay
    .map((appointment) => appointment.appointmentNumber)
    .filter((number) => number.startsWith(datePrefix))
    .map((number) => Number(number.slice(datePrefix.length)) || 0);
  const sequence = Math.max(0, ...existingNumbers) + 1;
  const appointmentNumber = datePrefix + String(sequence).padStart(3, "0");

  const metadata = {
    ...parsed.data,
    appointmentNumber,
    patientNumber: patient.patientNumber,
    patientName: patient.name,
    mobile: patient.mobile,
    doctorName: selectedDoctorName,
    status: "SCHEDULED"
  };

  const event = await saveAppointmentEvent(user, appointmentId, "APPOINTMENT_CREATED", metadata);
  return NextResponse.json({ appointment: serialize(event as AppointmentEvent) }, { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await requirePermission("reception.manage");
  const body = await request.json();
  const appointmentId = z.string().uuid().safeParse(body.appointmentId);
  if (!appointmentId.success) return NextResponse.json({ error: "Invalid appointment." }, { status: 400 });

  const existing = await findAppointment(user.organizationId, appointmentId.data);
  if (!existing) return NextResponse.json({ error: "Appointment not found." }, { status: 404 });

  if (body.action === "status") {
    const requested = z.enum(statuses).safeParse(body.status);
    if (!requested.success) return NextResponse.json({ error: "Invalid appointment status." }, { status: 400 });

    const transitions: Record<string, string[]> = {
      SCHEDULED: ["CONFIRMED", "CANCELLED", "NO_SHOW"],
      CONFIRMED: ["CHECKED_IN", "CANCELLED", "NO_SHOW"],
      CHECKED_IN: ["IN_CONSULTATION", "CANCELLED", "NO_SHOW"],
      IN_CONSULTATION: ["COMPLETED"],
      COMPLETED: [],
      CANCELLED: [],
      NO_SHOW: []
    };

    if (!transitions[existing.status]?.includes(requested.data)) {
      return NextResponse.json({
        error: "Cannot change status from " + existing.status.replaceAll("_", " ") + " to " + requested.data.replaceAll("_", " ") + "."
      }, { status: 409 });
    }

    const metadata = { ...existing, status: requested.data };
    const event = await saveAppointmentEvent(user, existing.id, "APPOINTMENT_STATUS_" + requested.data, metadata);
    return NextResponse.json({ appointment: serialize(event as AppointmentEvent) });
  }

  const parsed = appointmentSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Please check the appointment details." }, { status: 400 });

  const patient = await patientForAppointment(user.organizationId, parsed.data.patientId);
  if (!patient) return NextResponse.json({ error: "Patient not found." }, { status: 404 });

  const selectedDoctorName = await doctorName(user.organizationId, parsed.data.doctorUserId, user.clinicLocationId ?? null);
  if (!selectedDoctorName) return NextResponse.json({ error: "Selected doctor is not available for this clinic." }, { status: 400 });

  const sameDay = await currentAppointments(user.organizationId, parsed.data.appointmentDate);
  const conflict = sameDay.find((appointment) =>
    appointment.id !== existing.id &&
    appointment.doctorUserId === parsed.data.doctorUserId &&
    appointment.appointmentTime === parsed.data.appointmentTime &&
    !["CANCELLED", "NO_SHOW", "COMPLETED"].includes(appointment.status)
  );
  if (conflict) return NextResponse.json({ error: "This doctor already has an appointment at that time.", conflict }, { status: 409 });

  const metadata = {
    ...parsed.data,
    appointmentNumber: existing.appointmentNumber,
    patientNumber: patient.patientNumber,
    patientName: patient.name,
    mobile: patient.mobile,
    doctorName: selectedDoctorName,
    status: parsed.data.status ?? existing.status
  };

  const event = await saveAppointmentEvent(user, existing.id, "APPOINTMENT_UPDATED", metadata);
  return NextResponse.json({ appointment: serialize(event as AppointmentEvent) });
}
