# Permissions

Stored roles: `buyer` and `admin` on `public.profiles.role`.
`customer` is only a legacy alias for buyer. `staff` and `superadmin` are not privileged.

The only admin is the auth email in `src/lib/security/store-admin.ts`, and only when `profiles.role` is `admin`. The database trigger forces that. Clients cannot change `role`.

Code: `src/lib/permissions.ts` `can(role, permission)`
Server: `src/lib/admin/require-admin.ts` (admin UI and admin actions) and `src/lib/admin/require-permission.ts`.

Do not authorize from `user_metadata` / `raw_user_meta_data`.
