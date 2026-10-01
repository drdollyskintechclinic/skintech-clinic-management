import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/server/auth/authorization";
import { db } from "@/server/db/prisma";

export const dynamic = "force-dynamic";

const consultationSchema = z.object({
  appointmentId: z.string().uuid(),
  chiefComplaint: z.string().trim().max(4000).optional().or(z.literal("")),
  examinationFindings: z.string().trim().max(6000).optional().or(z.literal("")),
  diagnosis: z.string().trim().max(4000).optional().or(z.literal("")),
  treatmentAdvised: z.string().trim().max(6000).optional().or(z.literal("")),
  procedurePerformed: z.string().trim().max(4000).optional().or(z.literal("")),
  prescription: z.string().trim().max(6000).optional().or(z.literal("")),
  doctorNotes: z.string().trim().max(6000).optional().or(z.literal("")),
  followUpDate: z.string().date().optional().or(z.literal(""))
});

type EventRecord = { id: string; occurredAt: Date; resourceId: string | null; action: string; metadata: unknown };

async function getAppointment(organizationId: string, appointmentId: string) {
  const events = await db.auditEvent.findMany({
    where: { organizationId, resourceType: "APPOINTMENT", resourceId: appointmentId },
    orderBy: { occurredAt: "desc" },
    take: 20
  }) as EventRecord[];
  const latest = events.find((event) => event.action !== "APPOINTMENT_DELETED");
  if (!latest) return null;
  const data = (latest.metadata ?? {}) as Record<string, unknown>;
  return {
    id: appointmentId,
    appointmentNumber: String(data.appointmentNumber ?? ""),
    patientId: String(data.patientId ?? ""),
    patientNumber: String(data.patientNumber ?? ""),
    patientName: String(data.patientName ?? ""),
    mobile: String(data.mobile ?? ""),
    doctorUserId: String(data.doctorUserId ?? ""),
    doctorName: String(data.doctorName ?? ""),
    appointmentDate: String(data.appointmentDate ?? ""),
    appointmentTime: String(data.appointmentTime ?? ""),
    appointmentType: String(data.appointmentType ?? ""),
    treatment: String(data.treatment ?? ""),
    notes: String(data.notes ?? ""),
    status: String(data.status ?? "SCHEDULED")
  };
}

async function latestConsultation(organizationId: string, appointmentId: string) {
  const events = await db.auditEvent.findMany({
    where: { organizationId, resourceType: "CONSULTATION", resourceId: appointmentId },
    orderBy: { occurredAt: "desc" },
    take: 20
  }) as EventRecord[];
  const event = events.find((item) => item.action === "CONSULTATION_UPDATED" || item.action === "CONSULTATION_CREATED");
  if (!event) return null;
  return { id: event.id, ...(event.metadata as Record<string, unknown>) };
}

export async function GET(request: Request) {
  const user = await requirePermission("clinical.read");
  const appointmentId = z.string().uuid().safeParse(new URL(request.url).searchParams.get("appointmentId"));
  if (!appointmentId.success) return NextResponse.json({ error: "Invalid appointment." }, { status: 400 });
  const appointment = await getAppointment(user.organizationId, appointmentId.data);
  if (!appointment) return NextResponse.json({ error: "Appointment not found." }, { status: 404 });
  return NextResponse.json({ appointment, consultation: await latestConsultation(user.organizationId, appointmentId.data) });
}

export async function POST(request: Request) {
  const user = await requirePermission("clinical.write");
  const parsed = consultationSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Please check the consultation details." }, { status: 400 });

  const appointment = await getAppointment(user.organizationId, parsed.data.appointmentId);
  if (!appointment) return NextResponse.json({ error: "Appointment not found." }, { status: 404 });
  if (["CANCELLED", "NO_SHOW"].includes(appointment.status)) {
    return NextResponse.json({ error: "A cancelled or no-show appointment cannot have a consultation." }, { status: 409 });
  }

  const existing = await latestConsultation(user.organizationId, parsed.data.appointmentId);
  const metadata = {
    appointmentId: parsed.data.appointmentId,
    patientId: appointment.patientId,
    patientNumber: appointment.patientNumber,
    patientName: appointment.patientName,
    doctorUserId: appointment.doctorUserId,
    doctorName: appointment.doctorName,
    appointmentNumber: appointment.appointmentNumber,
    ...parsed.data
  };

  const event = await db.auditEvent.create({
    data: {
      organizationId: user.organizationId,
      actorUserId: user.id,
      resourceType: "CONSULTATION",
      resourceId: parsed.data.appointmentId,
      action: existing ? "CONSULTATION_UPDATED" : "CONSULTATION_CREATED",
      metadata
    }
  });

  // Keep the Follow-ups module synchronized with the consultation.
  // Saving a follow-up date automatically creates/updates one pending follow-up
  // for this consultation, while clearing the date does not create a new one.
  if (parsed.data.followUpDate) {
    const followUpEvents = await db.auditEvent.findMany({
      where: {
        organizationId: user.organizationId,
        resourceType: "FOLLOW_UP",
        metadata: { path: ["sourceConsultationAppointmentId"], equals: parsed.data.appointmentId }
      },
      orderBy: { occurredAt: "desc" },
      take: 50
    });

    const latest = followUpEvents.find((item) => item.action !== "FOLLOW_UP_DELETED");
    const existingFollowUp = latest ? (latest.metadata as Record<string, unknown>) : null;
    const followUpId = latest?.resourceId ?? crypto.randomUUID();

    await db.auditEvent.create({
      data: {
        organizationId: user.organizationId,
        actorUserId: user.id,
        resourceType: "FOLLOW_UP",
        resourceId: followUpId,
        action: latest ? "FOLLOW_UP_UPDATED" : "FOLLOW_UP_CREATED",
        metadata: {
          ...(existingFollowUp ?? {}),
          patientId: appointment.patientId,
          patientNumber: appointment.patientNumber,
          patientName: appointment.patientName,
          mobile: appointment.mobile,
          dueDate: parsed.data.followUpDate,
          purpose: "Consultation follow-up",
          assignedUserId: appointment.doctorUserId,
          assignedUserName: appointment.doctorName,
          notes: parsed.data.doctorNotes ?? "",
          status: "PENDING",
          sourceConsultationAppointmentId: parsed.data.appointmentId,
          createdByUserId: user.id,
          createdByUserName: user.name ?? ""
        }
      }
    });
  }

  return NextResponse.json({ consultation: { id: event.id, ...metadata } }, { status: existing ? 200 : 201 });
}
