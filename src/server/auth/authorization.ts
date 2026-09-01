import "server-only";

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/auth";
import { hasPermission, type PermissionKey } from "@/server/identity/permissions";

export class AuthorizationError extends Error {
  constructor(message = "You do not have permission to perform this action.") { super(message); this.name = "AuthorizationError"; }
}

export async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  return session.user;
}

export async function requirePermission(permission: PermissionKey) {
  const user = await requireAuth();
  if (!hasPermission(user.permissions, permission)) throw new AuthorizationError();
  return user;
}
