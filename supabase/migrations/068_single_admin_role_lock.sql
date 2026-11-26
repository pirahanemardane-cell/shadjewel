-- 068 Single store admin + buyer role lock
-- Idempotent. Apply on the shadjewel database after review.
--
-- Authorization model:
--   * public.profiles.role is only 'admin' or 'buyer'.
--   * The only admin is the auth.users email alvandmarketing.com@gmail.com.
--   * Every other account, including former staff / superadmin / customer rows,
--     is forced to buyer. Clients cannot choose a role.
--   * raw_user_meta_data is never read. A role claim is copied into
--     raw_app_meta_data (users cannot edit that) but the server still checks
--     profiles + auth.users.email, not the JWT claim.
--
-- public.is_admin() stays executable by anon and authenticated. Catalog
-- policies call it while also allowing published products and active
-- categories (including گوشواره) without being an admin. Do not revoke
-- those catalog SELECT policies.

BEGIN;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO postgres, service_role, authenticated;

-- Constant kept in the database so triggers and is_admin() cannot drift.
CREATE OR REPLACE FUNCTION private.store_admin_email()
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT lower(btrim('alvandmarketing.com@gmail.com'))::text;
$$;

REVOKE ALL ON FUNCTION private.store_admin_email() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS p
    INNER JOIN auth.users AS u ON u.id = p.id
    WHERE p.id = (SELECT auth.uid())
      AND p.role = 'admin'
      AND lower(btrim(u.email)) = private.store_admin_email()
  );
$$;

COMMENT ON FUNCTION public.is_admin() IS
  'True only for the signed-in store admin. anon/authenticated keep EXECUTE because catalog RLS calls this function; a false result still allows published products and active categories.';

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated, service_role;

-- Returns the caller's canonical role, or another user's role only when the
-- caller is the store admin. NULL when the caller is anonymous or is asking
-- about someone else without being admin.
CREATE OR REPLACE FUNCTION private.canonical_profile_role(target uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN (SELECT auth.uid()) IS NULL THEN NULL
    WHEN (SELECT auth.uid()) IS DISTINCT FROM target
         AND NOT public.is_admin() THEN NULL
    WHEN EXISTS (
      SELECT 1
      FROM auth.users AS u
      WHERE u.id = target
        AND lower(btrim(u.email)) = private.store_admin_email()
    ) THEN 'admin'
    ELSE 'buyer'
  END;
$$;

REVOKE ALL ON FUNCTION private.canonical_profile_role(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.canonical_profile_role(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.force_profile_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  user_email text;
BEGIN
  SELECT lower(btrim(u.email)) INTO user_email
  FROM auth.users AS u
  WHERE u.id = NEW.id;

  -- Client-supplied role, user_metadata, and raw_user_meta_data are ignored.
  IF user_email IS NOT DISTINCT FROM private.store_admin_email() THEN
    NEW.role := 'admin';
  ELSE
    NEW.role := 'buyer';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.force_profile_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.force_profile_role() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.prevent_store_admin_profile_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM auth.users AS u
    WHERE u.id = OLD.id
      AND lower(btrim(u.email)) = private.store_admin_email()
  ) THEN
    RAISE EXCEPTION 'store admin profile cannot be deleted'
      USING ERRCODE = '42501';
  END IF;
  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION private.prevent_store_admin_profile_delete() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.prevent_store_admin_profile_delete() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.guard_store_admin_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  admin_email text := private.store_admin_email();
  new_email text := lower(btrim(coalesce(NEW.email, '')));
  old_email text := '';
  forced text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.email IS DISTINCT FROM OLD.email THEN
    old_email := lower(btrim(coalesce(OLD.email, '')));
    IF old_email = admin_email AND new_email IS DISTINCT FROM admin_email THEN
      RAISE EXCEPTION 'store admin email cannot be changed'
        USING ERRCODE = '42501';
    END IF;
    IF new_email = admin_email AND old_email IS DISTINCT FROM admin_email THEN
      RAISE EXCEPTION 'store admin email is reserved'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  forced := CASE WHEN new_email = admin_email THEN 'admin' ELSE 'buyer' END;

  -- Users cannot edit raw_app_meta_data. This claim is a hint only.
  NEW.raw_app_meta_data := jsonb_set(
    coalesce(NEW.raw_app_meta_data, '{}'::jsonb),
    '{role}',
    to_jsonb(forced),
    true
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.guard_store_admin_email() FROM PUBLIC;

CREATE OR REPLACE FUNCTION private.sync_profile_role_from_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  forced text;
BEGIN
  IF lower(btrim(coalesce(NEW.email, ''))) = private.store_admin_email() THEN
    forced := 'admin';
  ELSE
    forced := 'buyer';
  END IF;

  INSERT INTO public.profiles (id, role)
  VALUES (NEW.id, forced)
  ON CONFLICT (id) DO UPDATE
    SET role = EXCLUDED.role
    WHERE public.profiles.role IS DISTINCT FROM EXCLUDED.role;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.sync_profile_role_from_auth() FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    GRANT USAGE ON SCHEMA private TO supabase_auth_admin;
    GRANT EXECUTE ON FUNCTION private.store_admin_email() TO supabase_auth_admin;
    GRANT EXECUTE ON FUNCTION private.force_profile_role() TO supabase_auth_admin;
    GRANT EXECUTE ON FUNCTION private.prevent_store_admin_profile_delete() TO supabase_auth_admin;
    GRANT EXECUTE ON FUNCTION private.guard_store_admin_email() TO supabase_auth_admin;
    GRANT EXECUTE ON FUNCTION private.sync_profile_role_from_auth() TO supabase_auth_admin;
  END IF;
END $$;

-- Allow 'buyer' before rewriting rows. Live databases may use a check or an enum.
DO $$
DECLARE
  r record;
  typ text;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'public.profiles'::regclass
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%role%'
  LOOP
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', r.conname);
  END LOOP;

  SELECT c.data_type INTO typ
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'profiles'
    AND c.column_name = 'role';

  IF typ = 'USER-DEFINED' THEN
    ALTER TABLE public.profiles ALTER COLUMN role DROP DEFAULT;
    ALTER TABLE public.profiles
      ALTER COLUMN role TYPE text USING role::text;
  END IF;
END $$;

ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'buyer';
ALTER TABLE public.profiles ALTER COLUMN role SET NOT NULL;

DROP TRIGGER IF EXISTS tr_profiles_force_role ON public.profiles;
CREATE TRIGGER tr_profiles_force_role
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION private.force_profile_role();

DROP TRIGGER IF EXISTS tr_profiles_protect_store_admin ON public.profiles;
CREATE TRIGGER tr_profiles_protect_store_admin
  BEFORE DELETE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION private.prevent_store_admin_profile_delete();

DROP TRIGGER IF EXISTS tr_auth_users_guard_store_admin ON auth.users;
CREATE TRIGGER tr_auth_users_guard_store_admin
  BEFORE INSERT OR UPDATE OF email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION private.guard_store_admin_email();

DROP TRIGGER IF EXISTS tr_auth_users_sync_profile_role ON auth.users;
CREATE TRIGGER tr_auth_users_sync_profile_role
  AFTER INSERT OR UPDATE OF email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION private.sync_profile_role_from_auth();

-- Rewrite every profile. The BEFORE trigger forces the same value.
UPDATE public.profiles AS p
SET role = CASE
  WHEN lower(btrim(coalesce(u.email, ''))) = private.store_admin_email() THEN 'admin'
  ELSE 'buyer'
END
FROM auth.users AS u
WHERE u.id = p.id
  AND p.role IS DISTINCT FROM CASE
    WHEN lower(btrim(coalesce(u.email, ''))) = private.store_admin_email() THEN 'admin'
    ELSE 'buyer'
  END;

UPDATE public.profiles AS p
SET role = 'buyer'
WHERE NOT EXISTS (SELECT 1 FROM auth.users AS u WHERE u.id = p.id)
  AND p.role IS DISTINCT FROM 'buyer';

UPDATE auth.users AS u
SET raw_app_meta_data = jsonb_set(
  coalesce(u.raw_app_meta_data, '{}'::jsonb),
  '{role}',
  to_jsonb(
    CASE
      WHEN lower(btrim(coalesce(u.email, ''))) = private.store_admin_email() THEN 'admin'
      ELSE 'buyer'
    END
  ),
  true
)
WHERE coalesce(u.raw_app_meta_data->>'role', '') IS DISTINCT FROM CASE
  WHEN lower(btrim(coalesce(u.email, ''))) = private.store_admin_email() THEN 'admin'
  ELSE 'buyer'
END;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_buyer_or_admin;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_buyer_or_admin
  CHECK (role IN ('buyer', 'admin'));

CREATE UNIQUE INDEX IF NOT EXISTS profiles_single_admin_idx
  ON public.profiles ((1))
  WHERE role = 'admin';

COMMENT ON COLUMN public.profiles.role IS
  'buyer or admin. Trigger-forced from auth.users.email. Not client-writable.';

-- Column privilege: authenticated and anon cannot include role in UPDATE.
-- service_role can still send the column; the trigger overwrites it.
REVOKE UPDATE (role) ON TABLE public.profiles FROM PUBLIC;
REVOKE UPDATE (role) ON TABLE public.profiles FROM anon;
REVOKE UPDATE (role) ON TABLE public.profiles FROM authenticated;

-- ENABLE is enough for anon/authenticated. Do not FORCE: the auth trigger
-- inserts profiles as the function owner, and FORCE would subject that owner
-- to these policies whenever it is not a superuser.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', r.policyname);
  END LOOP;
END $$;

CREATE POLICY profiles_select_own_or_admin
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) = id
    OR (SELECT public.is_admin())
  );

CREATE POLICY profiles_insert_own
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = id
    AND role = (SELECT private.canonical_profile_role(id))
  );

CREATE POLICY profiles_update_own
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK (
    (SELECT auth.uid()) = id
    AND role = (SELECT private.canonical_profile_role(id))
  );

CREATE POLICY profiles_admin_all
  ON public.profiles
  FOR ALL
  TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK (
    (SELECT public.is_admin())
    AND role = (SELECT private.canonical_profile_role(id))
  );

-- Ownership updates must not be able to reassign user_id.
DO $$
BEGIN
  IF to_regclass('public.stock_alerts') IS NOT NULL THEN
    DROP POLICY IF EXISTS stock_alerts_update_own ON public.stock_alerts;
    CREATE POLICY stock_alerts_update_own
      ON public.stock_alerts
      FOR UPDATE
      TO authenticated
      USING ((SELECT auth.uid()) = user_id)
      WITH CHECK ((SELECT auth.uid()) = user_id);
  END IF;

  IF to_regclass('public.price_alerts') IS NOT NULL THEN
    DROP POLICY IF EXISTS price_alerts_update_own ON public.price_alerts;
    CREATE POLICY price_alerts_update_own
      ON public.price_alerts
      FOR UPDATE
      TO authenticated
      USING ((SELECT auth.uid()) = user_id)
      WITH CHECK ((SELECT auth.uid()) = user_id);
  END IF;

  IF to_regclass('public.notifications') IS NOT NULL THEN
    DROP POLICY IF EXISTS notifications_own_update ON public.notifications;
    CREATE POLICY notifications_own_update
      ON public.notifications
      FOR UPDATE
      TO authenticated
      USING ((SELECT auth.uid()) = user_id)
      WITH CHECK ((SELECT auth.uid()) = user_id);
  END IF;

  IF to_regclass('public.user_sessions') IS NOT NULL THEN
    DROP POLICY IF EXISTS "user update own sessions" ON public.user_sessions;
    CREATE POLICY "user update own sessions"
      ON public.user_sessions
      FOR UPDATE
      TO authenticated
      USING ((SELECT auth.uid()) = user_id)
      WITH CHECK ((SELECT auth.uid()) = user_id);
  END IF;

  IF to_regclass('public.product_complements') IS NOT NULL THEN
    DROP POLICY IF EXISTS product_complements_admin_all ON public.product_complements;
    CREATE POLICY product_complements_admin_all
      ON public.product_complements
      FOR ALL
      TO authenticated
      USING ((SELECT public.is_admin()))
      WITH CHECK ((SELECT public.is_admin()));
  END IF;
END $$;

COMMIT;
