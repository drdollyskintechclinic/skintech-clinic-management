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
  notes: z.string().trim().max(2000).optional().or(z.literal(""))
});

function serialize(event: { id: string; occurredAt: Date; actorUserId: string | null; metadata: unknown }) {
  const data = (event.metadata ?? {}) as Record<string, unknown>;
  return { id: event.id, createdAt: event.occurredAt.toISOString(), ownerUserId: event.actorUserId, ...data };
}

export async function GET(request: Request) {
  const user = await requirePermission("reception.manage");
  const query = new URL(request.url).searchParams.get("q")?.trim().toLowerCase() ?? "";
  const events = await db.auditEvent.findMany({ where: { organizationId: user.organizationId, resourceType: "LEAD" }, orderBy: { occurredAt: "desc" }, take: 200 });
  const leads = events.map(serialize).filter((lead) => !query || String(lead.name ?? "").toLowerCase().includes(query) || String(lead.mobile ?? "").toLowerCase().includes(query));
  return NextResponse.json({ leads });
}

export async function POST(request: Request) {
  const user = await requirePermission("reception.manage");
  const parsed = leadSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Please check the enquiry details." }, { status: 400 });

  const lead = await db.auditEvent.create({
    data: {
      organizationId: user.organizationId,
      actorUserId: user.id,
      action: "LEAD_CREATED",
      resourceType: "LEAD",
      metadata: { ...parsed.data, status: "NEW", followUpAt: parsed.data.followUpAt || null }
    }
  });
  return NextResponse.json({ lead: serialize(lead) }, { status: 201 });
}
