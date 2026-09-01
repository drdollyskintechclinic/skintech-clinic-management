import type { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { verify } from "argon2";
import { z } from "zod";

import { db } from "@/server/db/prisma";
import { getServerEnvironment } from "@/server/env";
import { logger } from "@/server/observability/logger";

const credentialsSchema = z.object({ email: z.string().email().max(320), password: z.string().min(12).max(128) });

export const authOptions: NextAuthOptions = {
  secret: getServerEnvironment().AUTH_SECRET,
  session: { strategy: "jwt", maxAge: 8 * 60 * 60, updateAge: 15 * 60 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "Staff credentials",
      credentials: { email: { label: "Email", type: "email" }, password: { label: "Password", type: "password" } },
      async authorize(rawCredentials) {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;
        const email = parsed.data.email.toLowerCase();
        const user = await db.user.findUnique({
          where: { email },
          include: { staffProfile: true, userRoles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } }
        });
        if (!user?.isActive || !user.staffProfile?.isActive || !user.passwordHash) return null;
        if (!(await verify(user.passwordHash, parsed.data.password))) return null;
        const assignment = user.userRoles[0];
        if (!assignment) return null;
        const permissions = [...new Set(user.userRoles.flatMap((entry) => entry.role.permissions.map(({ permission }) => permission.key)))];
        logger.info("Staff authentication succeeded", { userId: user.id, organizationId: assignment.organizationId });
        return { id: user.id, email: user.email, name: user.name, organizationId: assignment.organizationId, clinicLocationId: assignment.clinicLocationId, permissions };
      }
    })
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id && user.organizationId && user.permissions) {
        token.userId = user.id;
        token.organizationId = user.organizationId;
        token.clinicLocationId = user.clinicLocationId ?? null;
        token.permissions = user.permissions;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.userId;
      session.user.organizationId = token.organizationId;
      session.user.clinicLocationId = token.clinicLocationId;
      session.user.permissions = token.permissions;
      return session;
    }
  }
};
