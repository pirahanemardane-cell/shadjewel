/**
 * Store admin identity. Must match private.store_admin_email() in
 * supabase/migrations/068_single_admin_role_lock.sql.
 *
 * Authorization uses the Auth user's email (auth.users), never user_metadata
 * or raw_user_meta_data. Role still has to be the profiles.role value 'admin';
 * the database trigger is what keeps that row in sync with this email.
 */
export const STORE_ADMIN_EMAIL = "alvandmarketing.com@gmail.com";

export function isStoreAdminEmail(email: string | null | undefined): boolean {
  return (email || "").trim().toLowerCase() === STORE_ADMIN_EMAIL;
}

export function isStoreAdmin(input: {
  email?: string | null;
  role?: string | null;
}): boolean {
  return (
    isStoreAdminEmail(input.email) &&
    String(input.role || "").trim().toLowerCase() === "admin"
  );
}

/** Role written for a new profile. The database trigger overwrites this. */
export function canonicalRoleForEmail(
  email: string | null | undefined,
): "admin" | "buyer" {
  return isStoreAdminEmail(email) ? "admin" : "buyer";
}
