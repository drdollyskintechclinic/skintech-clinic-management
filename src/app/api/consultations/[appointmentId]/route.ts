import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/server/auth/authorization";
import { db } from "@/server/db/prisma";

export const dynamic = "force-dynamic";

const consultationSchema = z.object({
  appointmentId: z.string().uuid(),
  chiefComplaint: z.string().trim().max(2000).optional().or(z.literal("")),
  examination: z.string().trim().max(4000).optional().or(z.literal("")),
  assessment: z.string().trim().max(4000).optional().or(z.literal("")),
  treatmentAdvised: z.string().trim().max(4000).optional().or(z.literal("")),
  procedurePerformed: z.string().trim().max(4000).optional().or(z.literal("")),
  prescription: z.string().trim().max(4000).optional().or(z.literal("")),
  notes: z.string().trim().max(4000).optional().or(z.literal("")),
  followUpDate: z.string().date().optional().or(z.literal(""))
});

type Event = {
  id: string;
  occurredAt: Date;
  resourceId: string | null;
  action: string;
  metadata: unknown;
};

async function appointmentForUser(organizationId: string, appointmentId: string) {
  const events = await db.auditEvent.findMany({
    where: { organizationId, resourceType: "APPOINTMENT", resourceId: appointmentId },
    orderBy: { occurredAt: "desc" },
    take: 50
  }) as Event[];

  const latest = events[0];
  if (!latest || latest.action === "APPOINTMENT_DELETED") return null;

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
    status: String(data.status ?? "SCHEDULED")
  };
}

async function latestConsultation(organizationId: string, appointmentId: string) {
  const events = await db.auditEvent.findMany({
    where: { organizationId, resourceType: "CONSULTATION", resourceId: appointmentId },
    orderBy: { occurredAt: "desc" },
    take: 20
  }) as Event[];

  const latest = events.find((event) => event.action !== "CONSULTATION_DELETED");
  if (!latest) return null;

  return {
    id: latest.id,
    ...((latest.metadata ?? {}) as Record<string, unknown>),
    updatedAt: latest.occurredAt.toISOString()
  };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ appointmentId: string }> }
) {
  const user = await requirePermission("clinical.read");
  const { appointmentId } = await context.params;

  const parsedId = z.string().uuid().safeParse(appointmentId);
  if (!parsedId.success) return NextResponse.json({ error: "Invalid appointment." }, { status: 400 });

  const appointment = await appointmentForUser(user.organizationId, parsedId.data);
  if (!appointment) return NextResponse.json({ error: "Appointment not found." }, { status: 404 });

  const consultation = await latestConsultation(user.organizationId, parsedId.data);
  return NextResponse.json({ appointment, consultation });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ appointmentId: string }> }
) {
  const user = await requirePermission("clinical.write");
  const { appointmentId } = await context.params;

  const parsedId = z.string().uuid().safeParse(appointmentId);
  if (!parsedId.success) return NextResponse.json({ error: "Invalid appointment." }, { status: 400 });

  const appointment = await appointmentForUser(user.organizationId, parsedId.data);
  if (!appointment) return NextResponse.json({ error: "Appointment not found." }, { status: 404 });

  const parsed = consultationSchema.safeParse({ ...(await request.json()), appointmentId: parsedId.data });
  if (!parsed.success) return NextResponse.json({ error: "Please check the consultation details." }, { status: 400 });

  const event = await db.auditEvent.create({
    data: {
      organizationId: user.organizationId,
      actorUserId: user.id,
      resourceId: parsedId.data,
      resourceType: "CONSULTATION",
      action: "CONSULTATION_SAVED",
      metadata: {
        ...parsed.data,
        appointmentNumber: appointment.appointmentNumber,
        patientId: appointment.patientId,
        patientNumber: appointment.patientNumber,
        patientName: appointment.patientName,
        doctorUserId: appointment.doctorUserId,
        doctorName: appointment.doctorName
      }
    }
  });

  return NextResponse.json({ consultation: { id: event.id, ...(parsed.data), updatedAt: event.occurredAt.toISOString() } }, { status: 201 });
}
