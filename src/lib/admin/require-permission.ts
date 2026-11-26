import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { can, normalizeRole, type Permission } from "@/lib/permissions";
import { isStoreAdmin } from "@/lib/security/store-admin";

export const getSessionRole = cache(async () => {
 const supabase = await createClient();
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) return { ok: false as const, error: "login_required" as const };
 const admin = createServiceClient();
 const { data: profile, error } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
 if (error) {
 console.error("[getSessionRole]", error);
 return { ok: false as const, error: "server" as const };
 }
 const stored = normalizeRole((profile as { role?: string } | null)?.role);
 const email = user.email ?? null;
 // A profiles.role of admin is ignored unless the auth email is the store admin.
 const role = stored === "admin" && !isStoreAdmin({ email, role: stored }) ? "buyer" : stored;
 return { ok: true as const, userId: user.id, email, role };
});

export async function requirePermission(permission: Permission) {
 const session = await getSessionRole();
 if (!session.ok) return session;
 if (permission.startsWith("admin.") && !isStoreAdmin({ email: session.email, role: session.role })) {
 return { ok: false as const, error: "forbidden" as const };
 }
 if (!can(session.role, permission)) return { ok: false as const, error: "forbidden" as const };
 return session;
}
