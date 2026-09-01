import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User { organizationId?: string; clinicLocationId?: string | null; permissions?: string[]; }
  interface Session { user: DefaultSession["user"] & { id: string; organizationId: string; clinicLocationId: string | null; permissions: string[]; }; }
}

declare module "next-auth/jwt" {
  interface JWT { userId: string; organizationId: string; clinicLocationId: string | null; permissions: string[]; }
}

