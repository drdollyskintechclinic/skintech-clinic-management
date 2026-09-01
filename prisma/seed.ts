import { PrismaClient, RoleName } from "@prisma/client";

import { permissionKeys, rolePermissionMap } from "../src/server/identity/permissions";

const prisma = new PrismaClient();

async function main() {
  const organization = await prisma.organization.upsert({ where: { slug: "dr-dolly-skintech-nagpur" }, update: {}, create: { name: "Dr Dolly's Skintech Clinic, Nagpur", slug: "dr-dolly-skintech-nagpur" } });
  const location = await prisma.clinicLocation.upsert({ where: { organizationId_code: { organizationId: organization.id, code: "NAGPUR" } }, update: {}, create: { organizationId: organization.id, name: "Nagpur", code: "NAGPUR" } });
  const permissions = await Promise.all(permissionKeys.map((key) => prisma.permission.upsert({ where: { key }, update: {}, create: { key, description: key } })));
  const permissionByKey = new Map(permissions.map((permission) => [permission.key, permission.id]));
  for (const name of Object.values(RoleName)) {
    const role = await prisma.role.upsert({ where: { name }, update: {}, create: { name, description: name.replaceAll("_", " ") } });
    for (const permission of rolePermissionMap[name]) {
      await prisma.rolePermission.upsert({ where: { roleId_permissionId: { roleId: role.id, permissionId: permissionByKey.get(permission)! } }, update: {}, create: { roleId: role.id, permissionId: permissionByKey.get(permission)! } });
    }
  }
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const passwordHash = process.env.ADMIN_PASSWORD_HASH;
  if (!email || !passwordHash) return;
  const admin = await prisma.user.upsert({ where: { email }, update: { passwordHash, isActive: true }, create: { email, passwordHash, isActive: true } });
  await prisma.staffProfile.upsert({ where: { userId: admin.id }, update: { isActive: true }, create: { userId: admin.id, organizationId: organization.id, clinicLocationId: location.id,scopeKey: location.id, jobTitle: "Administrator" } });
  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: RoleName.ADMIN } });
  await prisma.userRole.upsert({ where: { userId_roleId_organizationId_clinicLocationId: { userId: admin.id, roleId: adminRole.id, organizationId: organization.id, clinicLocationId: location.id,},}, update: {}, create: { userId: admin.id, roleId: adminRole.id, organizationId: organization.id, clinicLocationId: location.id,} });
}

main().finally(() => prisma.$disconnect());
