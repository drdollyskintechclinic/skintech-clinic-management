import { NextResponse } from "next/server";
import { hash } from "argon2";
import { z } from "zod";

import { requirePermission } from "@/server/auth/authorization";
import { db } from "@/server/db/prisma";

export const dynamic = "force-dynamic";

const doctorSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(320),
  password: z.string().min(12).max(128)
});

export async function GET() {
  const user = await requirePermission("staff.manage");
  const doctors = await db.userRole.findMany({
    where: { organizationId: user.organizationId, role: { name: "DOCTOR" } },
    include: {
      user: { select: { id: true, name: true, email: true, isActive: true } },
      clinicLocation: { select: { id: true, name: true } }
    },
    orderBy: { user: { name: "asc" } }
  });
  const seen = new Set<string>();
  return NextResponse.json({
    doctors: doctors.filter((item) => {
      if (seen.has(item.user.id)) return false;
      seen.add(item.user.id);
      return true;
    }).map((item) => ({
      id: item.user.id,
      name: item.user.name ?? "",
      email: item.user.email,
      isActive: item.user.isActive,
      clinicLocationId: item.clinicLocationId,
      clinicLocationName: item.clinicLocation?.name ?? "All branches"
    }))
  });
}

export async function POST(request: Request) {
  const user = await requirePermission("staff.manage");
  const parsed = doctorSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Please enter a valid doctor name, email and password (minimum 12 characters)." }, { status: 400 });

  const email = parsed.data.email.toLowerCase();
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: "A staff account already exists for this email." }, { status: 409 });

  const role = await db.role.findUnique({ where: { name: "DOCTOR" } });
  if (!role) return NextResponse.json({ error: "Doctor role is not configured." }, { status: 500 });

  const passwordHash = await hash(parsed.data.password);
  const doctor = await db.user.create({
    data: {
      email,
      name: parsed.data.name,
      passwordHash,
      isActive: true,
      staffProfile: {
        create: {
          organizationId: user.organizationId,
          clinicLocationId: user.clinicLocationId,
          scopeKey: user.clinicLocationId ?? user.organizationId,
          jobTitle: "Doctor",
          isActive: true
        }
      },
      userRoles: {
        create: {
          roleId: role.id,
          organizationId: user.organizationId,
          clinicLocationId: user.clinicLocationId
        }
      }
    }
  });

  return NextResponse.json({ doctor: { id: doctor.id, name: doctor.name, email: doctor.email, isActive: doctor.isActive } }, { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await requirePermission("staff.manage");
  const body = await request.json();
  const doctorId = z.string().uuid().safeParse(body.doctorId);
  if (!doctorId.success) return NextResponse.json({ error: "Invalid doctor." }, { status: 400 });

  const assignment = await db.userRole.findFirst({ where: { userId: doctorId.data, organizationId: user.organizationId, role: { name: "DOCTOR" } } });
  if (!assignment) return NextResponse.json({ error: "Doctor not found." }, { status: 404 });

  const isActive = z.boolean().safeParse(body.isActive);
  if (!isActive.success) return NextResponse.json({ error: "Invalid active status." }, { status: 400 });

  await db.user.update({ where: { id: doctorId.data }, data: { isActive: isActive.data } });
  return NextResponse.json({ ok: true });
}
