/**
 * Permission matrix — single source for role capabilities
 */
export const ROLES = ["guest", "buyer", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
 "catalog.view","cart.manage","checkout.place","order.view_own","order.cancel_own",
 "return.request","review.create","review.report","profile.manage","ticket.create",
 "admin.access","admin.products","admin.orders","admin.customers","admin.content",
 "admin.discounts","admin.shipping","admin.reviews","admin.returns","admin.settings",
 "admin.users","admin.reports","admin.media",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ALL_ADMIN = PERMISSIONS.filter((p) => p.startsWith("admin."));

const BUYER: readonly Permission[] = [
 "catalog.view","cart.manage","checkout.place","order.view_own","order.cancel_own",
 "return.request","review.create","review.report","profile.manage","ticket.create",
];

const ROLE_MAP: Record<Role, readonly Permission[]> = {
 guest: ["catalog.view", "cart.manage"],
 buyer: BUYER,
 admin: [
 "catalog.view","cart.manage","checkout.place","order.view_own","order.cancel_own",
 "return.request","review.create","review.report","profile.manage","ticket.create",
 ...ALL_ADMIN,
 ],
};

export function normalizeRole(raw: string | null | undefined): Role {
 const r = String(raw || "").toLowerCase().trim();
 if (r === "admin") return "admin";
 // customer is the pre-lock buyer value. staff/superadmin are not privileged.
 if (r === "buyer" || r === "customer" || r === "staff" || r === "superadmin") return "buyer";
 if (!r) return "guest";
 return "buyer";
}

export function can(role: Role | string | null | undefined, permission: Permission): boolean {
 const r = normalizeRole(typeof role === "string" ? role : role);
 return (ROLE_MAP[r] as readonly string[]).includes(permission);
}

export function permissionsFor(role: Role | string | null | undefined): readonly Permission[] {
 return ROLE_MAP[normalizeRole(typeof role === "string" ? role : role)];
}
