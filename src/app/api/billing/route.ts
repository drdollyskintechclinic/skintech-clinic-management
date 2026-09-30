import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/server/auth/authorization";
import { db } from "@/server/db/prisma";

export const dynamic = "force-dynamic";

type Event = { id: string; occurredAt: Date; actorUserId: string | null; resourceId: string | null; action: string; metadata: unknown };

const lineSchema = z.object({
  type: z.enum(["TREATMENT", "PACKAGE"]),
  catalogueId: z.string().uuid(),
  name: z.string().trim().min(2).max(160),
  quantity: z.coerce.number().int().min(1).max(100),
  unitPrice: z.coerce.number().min(0).max(10000000),
  discountAmount: z.coerce.number().min(0).max(10000000),
  total: z.coerce.number().min(0).max(10000000)
});

const billSchema = z.object({
  patientId: z.string().uuid(),
  appointmentId: z.string().uuid().optional().or(z.literal("")),
  lineItems: z.array(lineSchema).min(1).max(50),
  billDiscount: z.coerce.number().min(0).max(10000000),
  taxRate: z.coerce.number().min(0).max(100),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  initialPayment: z.coerce.number().min(0).max(10000000),
  paymentMethod: z.enum(["CASH", "UPI", "CARD", "BANK_TRANSFER", "OTHER"]).optional(),
  paymentNotes: z.string().trim().max(500).optional().or(z.literal(""))
});

const paymentSchema = z.object({
  billId: z.string().uuid(),
  amount: z.coerce.number().positive().max(10000000),
  method: z.enum(["CASH", "UPI", "CARD", "BANK_TRANSFER", "OTHER"]),
  notes: z.string().trim().max(500).optional().or(z.literal(""))
});

function data(event: Event) { return (event.metadata ?? {}) as Record<string, unknown>; }

function indiaDate() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const v = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${v.year}-${v.month}-${v.day}`;
}

async function events(org: string, resourceType: string) {
  return await db.auditEvent.findMany({ where: { organizationId: org, resourceType }, orderBy: { occurredAt: "desc" }, take: 5000 }) as Event[];
}

function current(es: Event[]) {
  const latest = new Map<string, Event>();
  for (const e of es) {
    const id = e.resourceId ?? e.id;
    if (!latest.has(id)) latest.set(id, e);
  }
  return [...latest.values()].filter((e) => !e.action.endsWith("_DELETED"));
}

async function patient(org: string, id: string) {
  const es = await events(org, "PATIENT");
  const e = es.find((x) => (x.resourceId ?? x.id) === id);
  if (!e || e.action === "PATIENT_DELETED") return null;
  const d = data(e);
  return { id, patientNumber: String(d.patientNumber ?? ""), name: String(d.name ?? ""), mobile: String(d.mobile ?? ""), city: String(d.city ?? "") };
}

async function catalog(org: string) {
  const [te, pe] = await Promise.all([events(org, "TREATMENT"), events(org, "TREATMENT_PACKAGE")]);
  const treatments = current(te).map((e) => ({ id: e.resourceId ?? e.id, type: "TREATMENT" as const, name: String(data(e).name ?? ""), category: String(data(e).category ?? ""), price: Number(data(e).price ?? 0), discountAmount: Number(data(e).discountAmount ?? 0), status: String(data(e).status ?? "ACTIVE") })).filter((x) => x.status === "ACTIVE");
  const ids = new Set(treatments.map((x) => x.id));
  const packages = current(pe).map((e) => ({ id: e.resourceId ?? e.id, type: "PACKAGE" as const, name: String(data(e).name ?? ""), treatmentId: String(data(e).treatmentId ?? ""), sessions: Number(data(e).sessions ?? 0), price: Number(data(e).price ?? 0), status: String(data(e).status ?? "ACTIVE") })).filter((x) => x.status === "ACTIVE" && ids.has(x.treatmentId));
  return { treatments, packages };
}

function serializeBill(e: Event) {
  const d = data(e);
  return { id: e.resourceId ?? e.id, ...d, createdAt: e.occurredAt.toISOString() };
}

export async function GET(request: Request) {
  const user = await requirePermission("finance.basic");
  const params = new URL(request.url).searchParams;
  const q = params.get("q")?.trim().toLowerCase() ?? "";
  const [catalogue, billEvents] = await Promise.all([catalog(user.organizationId), events(user.organizationId, "BILL")]);
  const bills = current(billEvents).map(serializeBill).filter((b) => !q || String(b.billNumber ?? "").toLowerCase().includes(q) || String(b.patientName ?? "").toLowerCase().includes(q) || String(b.patientNumber ?? "").toLowerCase().includes(q) || String(b.mobile ?? "").includes(q));
  return NextResponse.json({ ...catalogue, bills });
}

export async function POST(request: Request) {
  const user = await requirePermission("finance.basic");
  const body = await request.json();

  if (body.action === "payment") {
    const parsed = paymentSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Please check the payment details." }, { status: 400 });
    const bills = current(await events(user.organizationId, "BILL"));
    const existing = bills.find((e) => (e.resourceId ?? e.id) === parsed.data.billId);
    if (!existing) return NextResponse.json({ error: "Bill not found." }, { status: 404 });
    const d = data(existing);
    const balance = Number(d.balanceDue ?? 0);
    if (parsed.data.amount > balance) return NextResponse.json({ error: "Payment cannot be greater than the balance due." }, { status: 400 });
    const totalPaid = Number(d.amountPaid ?? 0) + parsed.data.amount;
    const newBalance = Math.max(0, Number(d.grandTotal ?? 0) - totalPaid);
    const status = newBalance === 0 ? "PAID" : totalPaid > 0 ? "PARTIALLY_PAID" : "UNPAID";
    const payment = { paymentId: crypto.randomUUID(), amount: parsed.data.amount, method: parsed.data.method, notes: parsed.data.notes ?? "", paidAt: new Date().toISOString() };
    const payments = Array.isArray(d.payments) ? [...d.payments, payment] : [payment];
    const updated = { ...d, amountPaid: totalPaid, balanceDue: newBalance, paymentStatus: status, payments };
    const event = await db.auditEvent.create({ data: { organizationId: user.organizationId, actorUserId: user.id, resourceType: "BILL", resourceId: parsed.data.billId, action: "BILL_PAYMENT_RECORDED", metadata: updated } });
    return NextResponse.json({ bill: serializeBill(event as Event) });
  }

  const parsed = billSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Please check the bill details." }, { status: 400 });
  const p = await patient(user.organizationId, parsed.data.patientId);
  if (!p) return NextResponse.json({ error: "Patient not found." }, { status: 404 });

  const calculatedItems = parsed.data.lineItems.map((item) => {
    const gross = item.unitPrice * item.quantity;
    const discount = Math.min(gross, item.discountAmount);
    return { ...item, discountAmount: discount, total: Math.max(0, gross - discount) };
  });
  const subtotal = calculatedItems.reduce((sum, item) => sum + item.total, 0);
  const billDiscount = Math.min(subtotal, parsed.data.billDiscount);
  const taxableAmount = Math.max(0, subtotal - billDiscount);
  const taxAmount = Number((taxableAmount * parsed.data.taxRate / 100).toFixed(2));
  const grandTotal = Number((taxableAmount + taxAmount).toFixed(2));
  const initialPayment = Math.min(grandTotal, parsed.data.initialPayment);
  const balanceDue = Number((grandTotal - initialPayment).toFixed(2));
  const paymentStatus = balanceDue === 0 ? "PAID" : initialPayment > 0 ? "PARTIALLY_PAID" : "UNPAID";

  const prefix = indiaDate().replaceAll("-", "").slice(2);
  const existingBills = current(await events(user.organizationId, "BILL"));
  const sequence = Math.max(0, ...existingBills.map((e) => String(data(e).billNumber ?? "")).filter((n) => n.startsWith("BL" + prefix)).map((n) => Number(n.slice(("BL" + prefix).length)) || 0)) + 1;
  const billNumber = "BL" + prefix + String(sequence).padStart(3, "0");
  const billId = crypto.randomUUID();
  const initialPayments = initialPayment > 0 ? [{ paymentId: crypto.randomUUID(), amount: initialPayment, method: parsed.data.paymentMethod ?? "CASH", notes: parsed.data.paymentNotes ?? "", paidAt: new Date().toISOString() }] : [];

  const metadata = {
    billNumber, billDate: indiaDate(), patientId: p.id, patientNumber: p.patientNumber, patientName: p.name, mobile: p.mobile, city: p.city,
    appointmentId: parsed.data.appointmentId ?? "", lineItems: calculatedItems, subtotal, billDiscount, taxableAmount, taxRate: parsed.data.taxRate, taxAmount, grandTotal,
    amountPaid: initialPayment, balanceDue, paymentStatus, payments: initialPayments, notes: parsed.data.notes ?? ""
  };

  const event = await db.auditEvent.create({ data: { organizationId: user.organizationId, actorUserId: user.id, resourceType: "BILL", resourceId: billId, action: "BILL_CREATED", metadata } });
  return NextResponse.json({ bill: serializeBill(event as Event) }, { status: 201 });
}
