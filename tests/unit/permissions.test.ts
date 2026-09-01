import { describe, expect, it } from "vitest";

import { hasPermission, rolePermissionMap } from "@/server/identity/permissions";

describe("permission foundation", () => {
  it("gives the Admin bundle all foundation permissions", () => expect(rolePermissionMap.ADMIN).toContain("staff.manage"));
  it("does not grant a therapist accounting access", () => expect(hasPermission(rolePermissionMap.THERAPIST, "finance.basic")).toBe(false));
  it("allows platform administrators through server-side permission checks", () => expect(hasPermission(["platform.manage"], "audit.read")).toBe(true));
});

