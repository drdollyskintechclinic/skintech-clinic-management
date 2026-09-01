import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/server/auth/authorization";
import { db } from "@/server/db/prisma";

export const dynamic = "force-dynamic";

const leadSchema = z.object({
  name: z.string().trim().min(2).max(120),
  mobile: z.string().trim().min(8).max(20),
  email: z.string().trim().email().max(320).optional().or(z.literal("")),
  source: z.string().trim().min(2).max(40),
  interestedTreatment: z.string().trim().min(2).max(160),
  followUpAt: z.string().datetime().optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  ownerUserId: z.string().uuid().optional().or(z.literal(""))
});

type LeadData = z.infer<typeof leadSchema> & { status?: string; followUpAt?: string | null };
type LeadEvent = { id: string; occurredAt: Date; actorUserId: string | null; resourceId: string | null; action: string; metadata: unknown };

function normalizeMobile(value: string) {
  return value.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
}

function serialize(event: LeadEvent) {
  const data = (event.metadata ?? {}) as LeadData;
  return {
    id: event.resourceId ?? event.id,
    createdAt: event.occurredAt.toISOString(),
    ownerUserId: data.ownerUserId ?? event.actorUserId,
    name: data.name ?? "",
    mobile: data.mobile ?? "",
    email: data.email ?? "",
    source: data.source ?? "",
    interestedTreatment: data.interestedTreatment ?? "",
    followUpAt: data.followUpAt ?? null,
    notes: data.notes ?? "",
    status: data.status ?? "NEW"
  };
}

async function currentLeads(organizationId: string) {
  const events = await db.auditEvent.findMany({
    where: { organizationId, resourceType: "LEAD" },
    orderBy: { occurredAt: "desc" },
    take: 2000
  }) as LeadEvent[];
  const latest = new Map<string, LeadEvent>();
  for (const event of events) {
    const id = event.resourceId ?? event.id;
    if (!latest.has(id)) latest.set(id, event);
  }
  return [...latest.values()]
    .filter((event) => event.action !== "LEAD_DELETED")
    .map(serialize);
}

async function findLeadEvent(organizationId: string, leadId: string) {
  const events = await db.auditEvent.findMany({
    where: { organizationId, resourceType: "LEAD", OR: [{ resourceId: leadId }, { id: leadId }] },
    orderBy: { occurredAt: "desc" },
    take: 1
  }) as LeadEvent[];
  const event = events[0];
  if (!event || event.action === "LEAD_DELETED") return null;
  return { event, lead: serialize(event) };
}

export async function GET(request: Request) {
  const user = await requirePermission("reception.manage");
  const params = new URL(request.url).searchParams;
  const query = params.get("q")?.trim().toLowerCase() ?? "";
  const page = Math.max(1, Number(params.get("page") ?? "1") || 1);
  const pageSize = Math.min(50, Math.max(5, Number(params.get("pageSize") ?? "10") || 10));
  const allLeads = (await currentLeads(user.organizationId)).filter((lead) =>
    !query || lead.name.toLowerCase().includes(query) || lead.mobile.toLowerCase().includes(query)
  );
  const total = allLeads.length;
  const start = (page - 1) * pageSize;
  const leads = allLeads.slice(start, start + pageSize);
  const owners = await db.user.findMany({
    where: { isActive: true, staffProfile: { is: { organizationId: user.organizationId, isActive: true } } },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" }
  });
  return NextResponse.json({ leads, owners, pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } });
}

export async function POST(request: Request) {
  const user = await requirePermission("reception.manage");
  const body = await request.json();
  const parsed = leadSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Please check the enquiry details." }, { status: 400 });

  const normalizedMobile = normalizeMobile(parsed.data.mobile);
  if (normalizedMobile.length < 8) return NextResponse.json({ error: "Please enter a valid mobile number." }, { status: 400 });

  if (!body.allowDuplicate) {
    const existing = (await currentLeads(user.organizationId))
      .filter((lead) => normalizeMobile(lead.mobile) === normalizedMobile)
      .slice(0, 5)
      .map((lead) => ({ id: lead.id, name: lead.name, mobile: lead.mobile, interestedTreatment: lead.interestedTreatment, createdAt: lead.createdAt }));
    if (existing.length) {
      return NextResponse.json({ error: "An enquiry already exists for this mobile number.", duplicates: existing }, { status: 409 });
    }
  }

  if (parsed.data.ownerUserId) {
    const owner = await db.user.findFirst({ where: { id: parsed.data.ownerUserId, isActive: true, staffProfile: { is: { organizationId: user.organizationId, isActive: true } } }, select: { id: true } });
    if (!owner) return NextResponse.json({ error: "Selected owner is not an active clinic staff member." }, { status: 400 });
  }
  const leadId = crypto.randomUUID();
  const lead = await db.auditEvent.create({
    data: {
      organizationId: user.organizationId,
      actorUserId: user.id,
      resourceId: leadId,
      action: "LEAD_CREATED",
      resourceType: "LEAD",
      metadata: { ...parsed.data, ownerUserId: parsed.data.ownerUserId || user.id, status: "NEW", followUpAt: parsed.data.followUpAt || null }
    }
  });
  return NextResponse.json({ lead: serialize(lead as LeadEvent) }, { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await requirePermission("reception.manage");
  const body = await request.json();
  const leadId = z.string().uuid().safeParse(body.leadId);
  if (!leadId.success) return NextResponse.json({ error: "Invalid enquiry." }, { status: 400 });
  const existing = await findLeadEvent(user.organizationId, leadId.data);
  if (!existing) return NextResponse.json({ error: "Enquiry not found." }, { status: 404 });

  const action = body.action === "assign" ? "assign" : "update";
  if (action === "assign") {
    const ownerId = z.string().uuid().safeParse(body.ownerUserId);
    if (!ownerId.success) return NextResponse.json({ error: "Please select a valid owner." }, { status: 400 });
    const owner = await db.user.findFirst({ where: { id: ownerId.data, isActive: true, staffProfile: { is: { organizationId: user.organizationId, isActive: true } } }, select: { id: true } });
    if (!owner) return NextResponse.json({ error: "Selected owner is not an active clinic staff member." }, { status: 400 });
    const lead = await db.auditEvent.create({ data: { organizationId: user.organizationId, actorUserId: user.id, resourceId: leadId.data, action: "LEAD_ASSIGNED", resourceType: "LEAD", metadata: { ...existing.lead, ownerUserId: ownerId.data } } });
    return NextResponse.json({ lead: serialize(lead as LeadEvent) });
  }

  const parsed = leadSchema.safeParse(body.data);
  if (!parsed.success) return NextResponse.json({ error: "Please check the enquiry details." }, { status: 400 });
  const lead = await db.auditEvent.create({ data: { organizationId: user.organizationId, actorUserId: user.id, resourceId: leadId.data, action: "LEAD_UPDATED", resourceType: "LEAD", metadata: { ...parsed.data, ownerUserId: parsed.data.ownerUserId || existing.lead.ownerUserId || user.id, status: existing.lead.status, followUpAt: parsed.data.followUpAt || null } } });
  return NextResponse.json({ lead: serialize(lead as LeadEvent) });
}

export async function DELETE(request: Request) {
  const user = await requirePermission("reception.manage");
  const leadId = z.string().uuid().safeParse(new URL(request.url).searchParams.get("id"));
  if (!leadId.success) return NextResponse.json({ error: "Invalid enquiry." }, { status: 400 });
  const existing = await findLeadEvent(user.organizationId, leadId.data);
  if (!existing) return NextResponse.json({ error: "Enquiry not found." }, { status: 404 });
  await db.auditEvent.create({ data: { organizationId: user.organizationId, actorUserId: user.id, resourceId: leadId.data, action: "LEAD_DELETED", resourceType: "LEAD", metadata: { ...existing.lead, status: "DELETED" } } });
  return NextResponse.json({ ok: true });
}
