/**
 * Profile self-update allowlist — never accept role / privilege fields
 * from the client. Admin role changes go through adminUpdateUserRoleAction
 * + service_role only.
 */

export const PROFILE_SELF_UPDATE_FIELDS = [
  "full_name",
  "phone",
  "avatar_url",
] as const;

export type ProfileSelfUpdateField = (typeof PROFILE_SELF_UPDATE_FIELDS)[number];

/** Fields that must never be set by a self-service profile write. */
export const PROFILE_PRIVILEGE_FIELDS = [
  "role",
  "is_active",
  "id",
] as const;

export function isProfilePrivilegeField(key: string): boolean {
  const k = String(key || "").trim().toLowerCase();
  return (PROFILE_PRIVILEGE_FIELDS as readonly string[]).includes(k);
}

/**
 * Strip privilege keys from an arbitrary input object.
 * Returns { ok, patch } for allowed keys only.
 */
export function sanitizeProfileSelfPatch(
  input: Record<string, unknown> | null | undefined,
): {
  ok: true;
  patch: Partial<Record<ProfileSelfUpdateField, unknown>>;
  stripped: string[];
} {
  const patch: Partial<Record<ProfileSelfUpdateField, unknown>> = {};
  const stripped: string[] = [];
  if (!input || typeof input !== "object") {
    return { ok: true, patch, stripped };
  }
  for (const [key, value] of Object.entries(input)) {
    if (isProfilePrivilegeField(key)) {
      stripped.push(key);
      continue;
    }
    if ((PROFILE_SELF_UPDATE_FIELDS as readonly string[]).includes(key)) {
      patch[key as ProfileSelfUpdateField] = value;
    } else {
      stripped.push(key);
    }
  }
  return { ok: true, patch, stripped };
}

/** True if a non-admin actor may change another user's role (always false). */
export function canSelfChangeRole(opts: {
  actorUserId: string;
  targetUserId: string;
  actorIsAdmin: boolean;
}): boolean {
  if (!opts.actorIsAdmin) return false;
  // Admins change *other* users' roles via server + service_role — not self.
  return opts.actorUserId !== opts.targetUserId;
}
