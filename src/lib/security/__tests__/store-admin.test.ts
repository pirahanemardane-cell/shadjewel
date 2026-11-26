import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { can, normalizeRole } from "@/lib/permissions";
import {
  canAccessOrder,
  isAdminRole,
} from "@/lib/security/access-control";
import {
  STORE_ADMIN_EMAIL,
  canonicalRoleForEmail,
  isStoreAdmin,
} from "@/lib/security/store-admin";

const ADMIN = STORE_ADMIN_EMAIL;

describe("store admin identity", () => {
  it("accepts only the store admin email with role admin", () => {
    expect(isStoreAdmin({ email: ADMIN, role: "admin" })).toBe(true);
    expect(isStoreAdmin({ email: `  ${ADMIN.toUpperCase()}  `, role: "admin" })).toBe(
      true,
    );
  });

  it("rejects other emails, staff, superadmin, and buyer", () => {
    expect(isStoreAdmin({ email: "other@example.com", role: "admin" })).toBe(false);
    expect(isStoreAdmin({ email: ADMIN, role: "buyer" })).toBe(false);
    expect(isStoreAdmin({ email: ADMIN, role: "superadmin" })).toBe(false);
    expect(isStoreAdmin({ email: ADMIN, role: "staff" })).toBe(false);
    expect(isStoreAdmin({ email: ADMIN, role: "customer" })).toBe(false);
    expect(isStoreAdmin({ email: null, role: "admin" })).toBe(false);
  });

  it("assigns buyer to every other signup email", () => {
    expect(canonicalRoleForEmail(ADMIN)).toBe("admin");
    expect(canonicalRoleForEmail("shopper@example.com")).toBe("buyer");
    expect(canonicalRoleForEmail("")).toBe("buyer");
  });

  it("pins the same email in the database migration and keeps anon catalog execute", () => {
    const sql = readFileSync(
      resolve(process.cwd(), "supabase/migrations/068_single_admin_role_lock.sql"),
      "utf8",
    );
    expect(sql).toContain(`'${STORE_ADMIN_EMAIL}'`);
    expect(sql).toContain(
      "GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated, service_role",
    );
    expect(sql).toContain(
      "REVOKE UPDATE (role) ON TABLE public.profiles FROM authenticated",
    );
    expect(sql).not.toContain("products_public_published");
    expect(sql).not.toContain("categories_public_active");
  });
});

describe("permission matrix cannot elevate staff or superadmin", () => {
  it("maps legacy shop roles to buyer and keeps admin permissions off them", () => {
    expect(normalizeRole("customer")).toBe("buyer");
    expect(normalizeRole("buyer")).toBe("buyer");
    expect(normalizeRole("staff")).toBe("buyer");
    expect(normalizeRole("superadmin")).toBe("buyer");
    expect(normalizeRole("admin")).toBe("admin");
    expect(can("staff", "admin.access")).toBe(false);
    expect(can("superadmin", "admin.users")).toBe(false);
    expect(can("customer", "checkout.place")).toBe(true);
    expect(can("buyer", "order.view_own")).toBe(true);
    expect(can("admin", "admin.users")).toBe(true);
  });
});

describe("order access uses email and role together", () => {
  it("lets the store admin open another user's order", () => {
    expect(
      canAccessOrder(
        { userId: "a", role: "admin", email: ADMIN },
        { user_id: "b", session_id: null },
      ),
    ).toBe(true);
  });

  it("does not treat a different admin-role email as admin", () => {
    expect(
      canAccessOrder(
        { userId: "a", role: "admin", email: "other@example.com" },
        { user_id: "b", session_id: null },
      ),
    ).toBe(false);
    expect(isAdminRole("superadmin")).toBe(false);
    expect(isAdminRole("staff")).toBe(false);
    expect(isAdminRole("admin")).toBe(true);
  });
});
