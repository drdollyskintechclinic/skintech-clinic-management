import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/server/auth/authorization";
import { db } from "@/server/db/prisma";

const fields = ["chiefComplaint","examinationFindings","diagnosis","treatmentAdvised","procedurePerformed","prescription","doctorNotes"] as const;
const schema = z.object({
  field: z.enum(fields),
  name: z.string().trim().min(1).max(120),
  content: z.string().trim().min(1).max(6000),
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0)
});

async function listTemplates(organizationId: string) {
  const events = await db.auditEvent.findMany({
    where: { organizationId, resourceType: "CONSULTATION_TEMPLATE" },
    orderBy: { occurredAt: "desc" },
    take: 1000
  });
  const latest = new Map<string, any>();
  for (const event of events) {
    if (!event.resourceId || latest.has(event.resourceId)) continue;
    latest.set(event.resourceId, event);
  }
  return [...latest.values()]
    .filter((event) => event.action !== "CONSULTATION_TEMPLATE_DELETED")
    .map((event) => event.metadata as Record<string, unknown>)
    .sort((a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0) || String(a.name).localeCompare(String(b.name)));
}

export async function GET() {
  const user = await requirePermission("clinical.read");
  return NextResponse.json({ templates: await listTemplates(user.organizationId) });
}

export async function POST(request: Request) {
  const user = await requirePermission("staff.manage");
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Please check the template details." }, { status: 400 });
  const id = crypto.randomUUID();
  const metadata = { id, ...parsed.data };
  await db.auditEvent.create({
    data: { organizationId: user.organizationId, actorUserId: user.id, resourceType: "CONSULTATION_TEMPLATE", resourceId: id, action: "CONSULTATION_TEMPLATE_CREATED", metadata }
  });
  return NextResponse.json({ template: metadata }, { status: 201 });
}

export async function PUT(request: Request) {
  const user = await requirePermission("staff.manage");
  const body = await request.json();
  const id = z.string().uuid().safeParse(body.id);
  const parsed = schema.safeParse(body);
  if (!id.success || !parsed.success) return NextResponse.json({ error: "Please check the template details." }, { status: 400 });
  const metadata = { id: id.data, ...parsed.data };
  await db.auditEvent.create({
    data: { organizationId: user.organizationId, actorUserId: user.id, resourceType: "CONSULTATION_TEMPLATE", resourceId: id.data, action: "CONSULTATION_TEMPLATE_UPDATED", metadata }
  });
  return NextResponse.json({ template: metadata });
}

export async function DELETE(request: Request) {
  const user = await requirePermission("staff.manage");
  const id = z.string().uuid().safeParse((await request.json()).id);
  if (!id.success) return NextResponse.json({ error: "Invalid template." }, { status: 400 });
  await db.auditEvent.create({
    data: { organizationId: user.organizationId, actorUserId: user.id, resourceType: "CONSULTATION_TEMPLATE", resourceId: id.data, action: "CONSULTATION_TEMPLATE_DELETED", metadata: { id: id.data } }
  });
  return NextResponse.json({ success: true });
}
