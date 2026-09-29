import { NextResponse } from "next/server";
import { hash } from "argon2";
import { z } from "zod";

import { requirePermission } from "@/server/auth/authorization";
import { db } from "@/server/db/prisma";

export const dynamic = "force-dynamic";

const roles = ["ADMIN", "DOCTOR", "RECEPTIONIST_TELECALLER", "THERAPIST"] as const;
const roleLabels: Record<(typeof roles)[number], string> = {
  ADMIN: "Admin",
  DOCTOR: "Doctor",
  RECEPTIONIST_TELECALLER: "Receptionist / Telecaller",
  THERAPIST: "Therapist"
};

const optionalPassword = z.preprocess((value) => value === "" ? undefined : value, z.string().min(12).max(128).optional());
const staffSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(320),
  password: optionalPassword,
  role: z.enum(roles),
  clinicLocationId: z.string().uuid(),
  jobTitle: z.string().trim().max(120).optional(),
  contactNumber: z.string().trim().max(30).optional(),
  degree: z.string().trim().max(120).optional(),
  speciality: z.string().trim().max(160).optional()
});

function clean(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function GET() {
  const user = await requirePermission("staff.manage");
  const [staff, locations] = await Promise.all([
    db.userRole.findMany({
      where: { organizationId: user.organizationId },
      include: {
        role: { select: { name: true } },
        user: {
          select: {
            id: true, name: true, email: true, isActive: true,
            staffProfile: { select: { contactNumber: true, degree: true, speciality: true, jobTitle: true } }
          }
        },
        clinicLocation: { select: { id: true, name: true } }
      },
      orderBy: { user: { name: "asc" } }
    }),
    db.clinicLocation.findMany({
      where: { organizationId: user.organizationId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" }
    })
  ]);

  const seen = new Set<string>();
  const result = staff.filter((item) => item.role.name !== "ADMIN").filter((item) => {
    if (seen.has(item.user.id)) return false;
    seen.add(item.user.id);
    return true;
  }).map((item) => ({
    id: item.user.id,
    name: item.user.name ?? "",
    email: item.user.email,
    isActive: item.user.isActive,
    role: item.role.name,
    roleLabel: roleLabels[item.role.name as (typeof roles)[number]] ?? item.role.name,
    clinicLocationId: item.clinicLocationId ?? "",
    clinicLocationName: item.clinicLocation?.name ?? "All branches",
    jobTitle: item.user.staffProfile?.jobTitle ?? "",
    contactNumber: item.user.staffProfile?.contactNumber ?? "",
    degree: item.user.staffProfile?.degree ?? "",
    speciality: item.user.staffProfile?.speciality ?? ""
  }));

  return NextResponse.json({ staff: result, locations });
}

export async function POST(request: Request) {
  const user = await requirePermission("staff.manage");
  const parsed = staffSchema.extend({ password: z.string().min(12).max(128) }).safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Please enter valid staff details and a password of at least 12 characters." }, { status: 400 });

  const location = await db.clinicLocation.findFirst({
    where: { id: parsed.data.clinicLocationId, organizationId: user.organizationId, isActive: true }
  });
  if (!location) return NextResponse.json({ error: "Selected branch is not available." }, { status: 400 });

  const email = parsed.data.email.toLowerCase();
  if (await db.user.findUnique({ where: { email } })) {
    return NextResponse.json({ error: "A staff account already exists for this email." }, { status: 409 });
  }

  const role = await db.role.findUnique({ where: { name: parsed.data.role } });
  if (!role) return NextResponse.json({ error: "Selected staff role is not configured." }, { status: 500 });

  const passwordHash = await hash(parsed.data.password);
  const staff = await db.user.create({
    data: {
      email,
      name: parsed.data.name,
      passwordHash,
      isActive: true,
      staffProfile: {
        create: {
          organizationId: user.organizationId,
          clinicLocationId: location.id,
          scopeKey: location.id,
          jobTitle: clean(parsed.data.jobTitle) ?? roleLabels[parsed.data.role],
          contactNumber: clean(parsed.data.contactNumber),
          degree: clean(parsed.data.degree),
          speciality: clean(parsed.data.speciality),
          isActive: true
        }
      },
      userRoles: {
        create: {
          roleId: role.id,
          organizationId: user.organizationId,
          clinicLocationId: location.id
        }
      }
    }
  });

  return NextResponse.json({ staff: { id: staff.id, name: staff.name, email: staff.email } }, { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await requirePermission("staff.manage");
  const body = await request.json();
  const staffId = z.string().uuid().safeParse(body.staffId);
  if (!staffId.success) return NextResponse.json({ error: "Invalid staff member." }, { status: 400 });

  const existingRole = await db.userRole.findFirst({
    where: { userId: staffId.data, organizationId: user.organizationId },
    include: { role: true }
  });
  const existingProfile = await db.staffProfile.findUnique({ where: { userId: staffId.data } });
  if (!existingRole || !existingProfile) return NextResponse.json({ error: "Staff member not found." }, { status: 404 });

  if (typeof body.isActive === "boolean") {
    await db.$transaction([
      db.user.update({ where: { id: staffId.data }, data: { isActive: body.isActive } }),
      db.staffProfile.update({ where: { userId: staffId.data }, data: { isActive: body.isActive } })
    ]);
    return NextResponse.json({ ok: true });
  }

  const parsed = staffSchema.partial().safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid staff details." }, { status: 400 });

  if (parsed.data.email) {
    const email = parsed.data.email.toLowerCase();
    const other = await db.user.findFirst({ where: { email, id: { not: staffId.data } } });
    if (other) return NextResponse.json({ error: "Another staff account already uses this email." }, { status: 409 });
  }

  const role = parsed.data.role ? await db.role.findUnique({ where: { name: parsed.data.role } }) : existingRole.role;
  if (!role) return NextResponse.json({ error: "Selected staff role is not configured." }, { status: 500 });

  let locationId = parsed.data.clinicLocationId ?? existingProfile.clinicLocationId;
  if (!locationId) return NextResponse.json({ error: "Please select a branch." }, { status: 400 });
  const location = await db.clinicLocation.findFirst({ where: { id: locationId, organizationId: user.organizationId, isActive: true } });
  if (!location) return NextResponse.json({ error: "Selected branch is not available." }, { status: 400 });

  const userData: { name?: string; email?: string; passwordHash?: string } = {};
  if (parsed.data.name) userData.name = parsed.data.name;
  if (parsed.data.email) userData.email = parsed.data.email.toLowerCase();
  if (parsed.data.password) userData.passwordHash = await hash(parsed.data.password);

  await db.$transaction([
    db.user.update({ where: { id: staffId.data }, data: userData }),
    db.staffProfile.update({
      where: { userId: staffId.data },
      data: {
        clinicLocationId: location.id,
        scopeKey: location.id,
        jobTitle: clean(parsed.data.jobTitle) ?? existingProfile.jobTitle ?? roleLabels[role.name as (typeof roles)[number]],
        contactNumber: parsed.data.contactNumber === undefined ? existingProfile.contactNumber : clean(parsed.data.contactNumber),
        degree: parsed.data.degree === undefined ? existingProfile.degree : clean(parsed.data.degree),
        speciality: parsed.data.speciality === undefined ? existingProfile.speciality : clean(parsed.data.speciality)
      }
    }),
    db.userRole.update({ where: { id: existingRole.id }, data: { roleId: role.id, clinicLocationId: location.id } })
  ]);

  return NextResponse.json({ ok: true });
}
