import { describe, expect, it } from "vitest";
import {
 canSelfChangeRole,
 isProfilePrivilegeField,
 sanitizeProfileSelfPatch,
} from "@/lib/security/profile-privileges";

describe("profile privilege escalation guards", () => {
  it("strips role from self-update payloads", () => {
    const { patch, stripped } = sanitizeProfileSelfPatch({
      full_name: "علی",
      phone: "09121234567",
      role: "admin",
      is_active: false,
      id: "attacker-id",
    });
    expect(patch).toEqual({ full_name: "علی", phone: "09121234567" });
    expect(stripped).toEqual(
      expect.arrayContaining(["role", "is_active", "id"]),
    );
    expect(patch).not.toHaveProperty("role");
  });

  it("rejects unknown / privilege keys", () => {
    expect(isProfilePrivilegeField("role")).toBe(true);
    expect(isProfilePrivilegeField("ROLE")).toBe(true);
    expect(isProfilePrivilegeField("full_name")).toBe(false);
    const { patch } = sanitizeProfileSelfPatch({
      role: "superadmin",
      evil: "x",
    });
    expect(patch).toEqual({});
  });

  it("customers cannot change anyone's role", () => {
    expect(
      canSelfChangeRole({
        actorUserId: "u1",
        targetUserId: "u1",
        actorIsAdmin: false,
      }),
    ).toBe(false);
    expect(
      canSelfChangeRole({
        actorUserId: "u1",
        targetUserId: "u2",
        actorIsAdmin: false,
      }),
    ).toBe(false);
  });

  it("admins can change other users but not themselves", () => {
    expect(
      canSelfChangeRole({
        actorUserId: "admin1",
        targetUserId: "u2",
        actorIsAdmin: true,
      }),
    ).toBe(true);
    expect(
      canSelfChangeRole({
        actorUserId: "admin1",
        targetUserId: "admin1",
        actorIsAdmin: true,
      }),
    ).toBe(false);
  });
});
