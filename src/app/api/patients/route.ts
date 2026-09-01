import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/server/auth/authorization";
import { db } from "@/server/db/prisma";

export const dynamic = "force-dynamic";

const genders = ["FEMALE", "MALE", "OTHER", "PREFER_NOT_TO_SAY"] as const;
const genderSchema = z.enum(genders);

const patientSchema = z.object({
  name: z.string().trim().min(2).max(120),
  mobile: z.string().trim().min(8).max(20),
  email: z.string().trim().email().max(320).optional().or(z.literal("")),
  dateOfBirth: z.string().date().optional().or(z.literal("")),
  age: z.union([z.string().trim(), z.number()]).optional().or(z.literal("")),
  gender: genderSchema.optional().or(z.literal("")),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  referredBy: z.string().trim().max(200).optional().or(z.literal("")),
  alternateContactNumber: z.string().trim().max(20).optional().or(z.literal("")),
  notes: z.string().trim().max(3000).optional().or(z.literal(""))
});

type PatientData = z.infer<typeof patientSchema>;
type PatientEvent = { id: string; occurredAt: Date; actorUserId: string | null; resourceId: string | null; action: string; metadata: unknown };

function normalizeMobile(value: string) {
  return value.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
}

function indiaToday() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return { year: Number(get("year")), month: Number(get("month")), day: Number(get("day")) };
}

function dateFromAge(ageValue: unknown) {
  if (ageValue === "" || ageValue === undefined || ageValue === null) return "";
  const age = Number(ageValue);
  if (!Number.isInteger(age) || age < 0 || age > 120) throw new Error("Age must be a whole number between 0 and 120.");
  const today = indiaToday();
  return `${today.year - age}-${String(today.month).padStart(2, "0")}-${String(today.day).padStart(2, "0")}`;
}

function serialize(event: PatientEvent) {
  const data = (event.metadata ?? {}) as PatientData & { patientNumber?: string };
  return {
    id: event.resourceId ?? event.id,
    patientNumber: data.patientNumber ?? `PT-${(event.resourceId ?? event.id).slice(0, 8).toUpperCase()}`,
    createdAt: event.occurredAt.toISOString(),
    name: data.name ?? "",
    mobile: data.mobile ?? "",
    email: data.email ?? "",
    dateOfBirth: data.dateOfBirth ?? "",
    gender: data.gender ?? "",
    address: data.address ?? "",
    referredBy: data.referredBy ?? "",
    alternateContactNumber: data.alternateContactNumber ?? "",
    notes: data.notes ?? ""
  };
}

async function currentPatients(organizationId: string) {
  const events = await db.auditEvent.findMany({ where: { organizationId, resourceType: "PATIENT" }, orderBy: { occurredAt: "desc" }, take: 5000 }) as PatientEvent[];
  const latest = new Map<string, PatientEvent>();
  for (const event of events) {
    const id = event.resourceId ?? event.id;
    if (!latest.has(id)) latest.set(id, event);
  }
  return [...latest.values()].filter((event) => event.action !== "PATIENT_DELETED").map(serialize);
}

async function findPatient(organizationId: string, patientId: string) {
  const events = await db.auditEvent.findMany({ where: { organizationId, resourceType: "PATIENT", resourceId: patientId }, orderBy: { occurredAt: "desc" }, take: 1 }) as PatientEvent[];
  const event = events[0];
  if (!event || event.action === "PATIENT_DELETED") return null;
  return serialize(event);
}

async function nextPatientNumber(organizationId: string) {
  const today = indiaToday();
  const prefix = `DDSC${today.year}${String(today.month).padStart(2, "0")}`;
  const events = await db.auditEvent.findMany({ where: { organizationId, resourceType: "PATIENT", action: "PATIENT_CREATED" }, select: { metadata: true }, take: 5000 });
  let max = 0;
  for (const event of events) {
    const number = typeof event.metadata === "object" && event.metadata !== null && "patientNumber" in event.metadata ? String((event.metadata as { patientNumber?: unknown }).patientNumber ?? "") : "";
    if (number.startsWith(prefix)) max = Math.max(max, Number(number.slice(prefix.length)) || 0);
  }
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

function prepareData(data: PatientData) {
  const dateOfBirth = data.dateOfBirth || dateFromAge(data.age);
  const { age: _age, ...rest } = data;
  return { ...rest, dateOfBirth };
}

export async function GET(request: Request) {
  const user = await requirePermission("reception.manage");
  const params = new URL(request.url).searchParams;
  const query = params.get("q")?.trim().toLowerCase() ?? "";
  const page = Math.max(1, Number(params.get("page") ?? "1") || 1);
  const pageSize = Math.min(50, Math.max(5, Number(params.get("pageSize") ?? "10") || 10));
  const allPatients = (await currentPatients(user.organizationId)).filter((patient) => !query || patient.name.toLowerCase().includes(query) || patient.mobile.toLowerCase().includes(query) || patient.patientNumber.toLowerCase().includes(query));
  const total = allPatients.length;
  const start = (page - 1) * pageSize;
  return NextResponse.json({ patients: allPatients.slice(start, start + pageSize), pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } });
}

export async function POST(request: Request) {
  const user = await requirePermission("reception.manage");
  const body = await request.json();
  const parsed = patientSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Please check the patient details." }, { status: 400 });
  let prepared: ReturnType<typeof prepareData>;
  try { prepared = prepareData(parsed.data); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid age." }, { status: 400 }); }
  const normalizedMobile = normalizeMobile(prepared.mobile);
  if (normalizedMobile.length !== 10) return NextResponse.json({ error: "Please enter a valid 10-digit mobile number." }, { status: 400 });
  if (prepared.alternateContactNumber && normalizeMobile(prepared.alternateContactNumber).length !== 10) return NextResponse.json({ error: "Please enter a valid alternate contact number." }, { status: 400 });
  if (!body.allowDuplicate) {
    const existing = (await currentPatients(user.organizationId)).filter((patient) => normalizeMobile(patient.mobile) === normalizedMobile).slice(0, 5).map((patient) => ({ id: patient.id, patientNumber: patient.patientNumber, name: patient.name, mobile: patient.mobile, createdAt: patient.createdAt }));
    if (existing.length) return NextResponse.json({ error: "A patient already exists for this mobile number.", duplicates: existing }, { status: 409 });
  }
  const patientId = crypto.randomUUID();
  const patientNumber = await nextPatientNumber(user.organizationId);
  const event = await db.auditEvent.create({ data: { organizationId: user.organizationId, actorUserId: user.id, resourceId: patientId, action: "PATIENT_CREATED", resourceType: "PATIENT", metadata: { ...prepared, patientNumber, mobile: normalizedMobile, alternateContactNumber: prepared.alternateContactNumber ? normalizeMobile(prepared.alternateContactNumber) : "" } } });
  return NextResponse.json({ patient: serialize(event as PatientEvent) }, { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await requirePermission("reception.manage");
  const body = await request.json();
  const patientId = z.string().uuid().safeParse(body.patientId);
  if (!patientId.success) return NextResponse.json({ error: "Invalid patient." }, { status: 400 });
  const existing = await findPatient(user.organizationId, patientId.data);
  if (!existing) return NextResponse.json({ error: "Patient not found." }, { status: 404 });
  const parsed = patientSchema.safeParse(body.data);
  if (!parsed.success) return NextResponse.json({ error: "Please check the patient details." }, { status: 400 });
  let prepared: ReturnType<typeof prepareData>;
  try { prepared = prepareData(parsed.data); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid age." }, { status: 400 }); }
  const normalizedMobile = normalizeMobile(prepared.mobile);
  if (normalizedMobile.length !== 10) return NextResponse.json({ error: "Please enter a valid 10-digit mobile number." }, { status: 400 });
  if (prepared.alternateContactNumber && normalizeMobile(prepared.alternateContactNumber).length !== 10) return NextResponse.json({ error: "Please enter a valid alternate contact number." }, { status: 400 });
  if (!body.allowDuplicate && normalizedMobile !== normalizeMobile(existing.mobile)) {
    const duplicate = (await currentPatients(user.organizationId)).find((patient) => patient.id !== existing.id && normalizeMobile(patient.mobile) === normalizedMobile);
    if (duplicate) return NextResponse.json({ error: "Another patient already uses this mobile number.", duplicates: [duplicate] }, { status: 409 });
  }
  const event = await db.auditEvent.create({ data: { organizationId: user.organizationId, actorUserId: user.id, resourceId: patientId.data, action: "PATIENT_UPDATED", resourceType: "PATIENT", metadata: { ...prepared, patientNumber: existing.patientNumber, mobile: normalizedMobile, alternateContactNumber: prepared.alternateContactNumber ? normalizeMobile(prepared.alternateContactNumber) : "" } } });
  return NextResponse.json({ patient: serialize(event as PatientEvent) });
}

export async function DELETE(request: Request) {
  const user = await requirePermission("reception.manage");
  const patientId = z.string().uuid().safeParse(new URL(request.url).searchParams.get("id"));
  if (!patientId.success) return NextResponse.json({ error: "Invalid patient." }, { status: 400 });
  const existing = await findPatient(user.organizationId, patientId.data);
  if (!existing) return NextResponse.json({ error: "Patient not found." }, { status: 404 });
  await db.auditEvent.create({ data: { organizationId: user.organizationId, actorUserId: user.id, resourceId: patientId.data, action: "PATIENT_DELETED", resourceType: "PATIENT", metadata: { ...existing } } });
  return NextResponse.json({ ok: true });
}
