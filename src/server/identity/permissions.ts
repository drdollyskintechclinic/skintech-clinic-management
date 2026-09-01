export const permissionKeys = ["platform.manage", "staff.manage", "audit.read", "clinical.read", "clinical.write", "reception.manage", "treatment.record", "finance.basic"] as const;
export type PermissionKey = (typeof permissionKeys)[number];

export const rolePermissionMap: Record<string, readonly PermissionKey[]> = {
  ADMIN: permissionKeys,
  DOCTOR: ["clinical.read", "clinical.write"],
  RECEPTIONIST_TELECALLER: ["reception.manage", "finance.basic"],
  THERAPIST: ["treatment.record"]
};

export function hasPermission(granted: readonly string[], required: PermissionKey): boolean {
  return granted.includes("platform.manage") || granted.includes(required);
}

