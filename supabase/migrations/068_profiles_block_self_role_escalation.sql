-- 068: Block privilege escalation via profiles.role / is_active
-- Authenticated clients may update their own profile, but MUST NOT change
-- privilege columns. Role changes only through service_role (admin server actions).

CREATE OR REPLACE FUNCTION public.profiles_preserve_privilege_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_role text := coalesce(auth.jwt() ->> 'role', '');
BEGIN
  -- service_role: admin server paths (createServiceClient) may change privileges
  IF jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'cannot change profiles.role'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    RAISE EXCEPTION 'cannot change profiles.is_active'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_profiles_preserve_privilege ON public.profiles;
CREATE TRIGGER tr_profiles_preserve_privilege
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_preserve_privilege_columns();

-- INSERT: force customer role unless service_role
CREATE OR REPLACE FUNCTION public.profiles_force_customer_on_self_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_role text := coalesce(auth.jwt() ->> 'role', '');
BEGIN
  IF jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;
  NEW.role := 'customer';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_profiles_force_customer_insert ON public.profiles;
CREATE TRIGGER tr_profiles_force_customer_insert
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_force_customer_on_self_insert();

-- Own UPDATE: identity only (privilege columns enforced by trigger; RLS cannot
-- safely compare OLD.role in WITH CHECK against the same table).
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Own INSERT must be role=customer (trigger also forces it)
DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
CREATE POLICY profiles_insert_own ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id AND role = 'customer');

COMMENT ON FUNCTION public.profiles_preserve_privilege_columns() IS
  'Blocks non-service_role clients from changing profiles.role / is_active (anti privilege-escalation)';
