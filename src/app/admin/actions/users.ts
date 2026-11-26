"use server";

import { requireAdmin } from "@/lib/admin/require-admin";


export async function adminListUsersAction(
 limit = 50,
 opts?: { q?: string; role?: string },
) {
 const gate = await requireAdmin();
 if (!gate.ok) return { ok: false as const, error: gate.error, items: [] };
 try {
 let query = gate.supabase
 .from("profiles")
 .select("id, full_name, phone, role, created_at, updated_at")
 .order("created_at", { ascending: false })
 .limit(Math.min(200, Math.max(1, Number(limit) || 50)));

 const role = (opts?.role || "").trim().toLowerCase();
 if (role === "admin") {
 query = query.eq("role", "admin");
 } else if (role === "buyer" || role === "customer") {
 // customer is the pre-migration buyer value
 query = query.or("role.eq.buyer,role.eq.customer");
 }
 const q = (opts?.q || "").trim().slice(0, 80);
 if (q) {
 const safe = q.replace(/[%_,]/g, " ").replace(/\s+/g, " ").trim();
 if (safe) {
 query = query.or(`full_name.ilike.%${safe}%,phone.ilike.%${safe}%`);
 }
 }

 const { data, error } = await query;
 if (error) throw error;
 return { ok: true as const, items: data ?? [] };
 } catch (e) {
 console.error("[adminListUsers]", e);
 return { ok: false as const, error: "server", items: [] };
 }
}

/** Roles are database-owned. This action cannot grant or change them. */
export async function adminUpdateUserRoleAction(_userId: string, _role: string) {
 const gate = await requireAdmin();
 if (!gate.ok) return { ok: false as const, error: gate.error };
 return { ok: false as const, error: "role_locked" as const };
}
