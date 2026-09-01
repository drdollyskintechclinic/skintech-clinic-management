import "server-only";

import type { Prisma } from "@prisma/client";
import { db } from "@/server/db/prisma";

export type AuditInput = {
  organizationId: string;
  actorUserId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  metadata?: Prisma.InputJsonValue;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
};

export async function recordAuditEvent(input: AuditInput): Promise<void> {
  await db.auditEvent.create({ data: input });
}