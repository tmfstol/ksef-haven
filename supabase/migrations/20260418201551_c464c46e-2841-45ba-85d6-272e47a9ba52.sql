-- ============================================
-- ETAP 1: MODULE PERMISSIONS (on/off per modul)
-- ============================================

CREATE TABLE public.module_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  module text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, company_id, module)
);

CREATE INDEX idx_module_permissions_lookup ON public.module_permissions (user_id, company_id, module);

ALTER TABLE public.module_permissions ENABLE ROW LEVEL SECURITY;

-- Helper function (SECURITY DEFINER - bypasses RLS to avoid recursion)
CREATE OR REPLACE FUNCTION public.has_module_permission(_user_id uuid, _company_id uuid, _module text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.module_permissions
    WHERE user_id = _user_id
      AND company_id = _company_id
      AND module = _module
      AND enabled = true
  )
  OR EXISTS (
    -- admin always has access
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND company_id = _company_id
      AND role = 'admin'
  );
$$;

-- Users can view their own module permissions; admins can view all in their company
CREATE POLICY "Users view own permissions"
ON public.module_permissions
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND company_id = module_permissions.company_id
      AND role = 'admin'
  )
);

-- Only company owner or admin can manage permissions
CREATE POLICY "Admins manage permissions"
ON public.module_permissions
FOR ALL
TO authenticated
USING (
  company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND company_id = module_permissions.company_id
      AND role = 'admin'
  )
)
WITH CHECK (
  company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND company_id = module_permissions.company_id
      AND role = 'admin'
  )
);

-- updated_at trigger
CREATE TRIGGER trg_module_permissions_updated_at
BEFORE UPDATE ON public.module_permissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger: assign default modules per role on user_roles insert
CREATE OR REPLACE FUNCTION public.assign_default_module_permissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  default_modules text[];
BEGIN
  IF NEW.role = 'admin' THEN
    default_modules := ARRAY['invoices_cost','invoices_revenue','expenses','projects','analytics','taxes','bank','contacts','calendar','drive','sheets','gmail','meet','workspace'];
  ELSIF NEW.role = 'księgowy' THEN
    default_modules := ARRAY['invoices_cost','expenses','analytics','taxes','bank','contacts','projects'];
  ELSIF NEW.role = 'handlowiec' THEN
    default_modules := ARRAY['invoices_revenue','analytics','contacts','projects','calendar'];
  ELSE
    default_modules := ARRAY[]::text[];
  END IF;

  INSERT INTO public.module_permissions (user_id, company_id, module, enabled)
  SELECT NEW.user_id, NEW.company_id, m, true
  FROM unnest(default_modules) AS m
  ON CONFLICT (user_id, company_id, module) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_assign_default_permissions
AFTER INSERT ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.assign_default_module_permissions();

-- Backfill defaults for existing users
DO $$
DECLARE
  r RECORD;
  default_modules text[];
BEGIN
  FOR r IN SELECT user_id, company_id, role FROM public.user_roles LOOP
    IF r.role = 'admin' THEN
      default_modules := ARRAY['invoices_cost','invoices_revenue','expenses','projects','analytics','taxes','bank','contacts','calendar','drive','sheets','gmail','meet','workspace'];
    ELSIF r.role = 'księgowy' THEN
      default_modules := ARRAY['invoices_cost','expenses','analytics','taxes','bank','contacts','projects'];
    ELSIF r.role = 'handlowiec' THEN
      default_modules := ARRAY['invoices_revenue','analytics','contacts','projects','calendar'];
    ELSE
      default_modules := ARRAY[]::text[];
    END IF;

    INSERT INTO public.module_permissions (user_id, company_id, module, enabled)
    SELECT r.user_id, r.company_id, m, true
    FROM unnest(default_modules) AS m
    ON CONFLICT (user_id, company_id, module) DO NOTHING;
  END LOOP;
END $$;

-- ============================================
-- ETAP 2: GOOGLE WORKSPACE CREDENTIALS
-- ============================================

CREATE TABLE public.google_workspace_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  connected_email text NOT NULL,
  refresh_token text NOT NULL,
  access_token text,
  token_expires_at timestamp with time zone,
  scopes text[] NOT NULL DEFAULT '{}',
  connected_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.google_workspace_credentials ENABLE ROW LEVEL SECURITY;

-- Members can check if company has Google connected (read connected_email + scopes only via view)
-- but only admins/owners can read full credentials
CREATE POLICY "Owners read credentials"
ON public.google_workspace_credentials
FOR SELECT
TO authenticated
USING (
  company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND company_id = google_workspace_credentials.company_id
      AND role = 'admin'
  )
);

CREATE POLICY "Owners manage credentials"
ON public.google_workspace_credentials
FOR ALL
TO authenticated
USING (
  company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND company_id = google_workspace_credentials.company_id
      AND role = 'admin'
  )
)
WITH CHECK (
  company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND company_id = google_workspace_credentials.company_id
      AND role = 'admin'
  )
);

CREATE POLICY "Service role full access google_credentials"
ON public.google_workspace_credentials
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE TRIGGER trg_google_credentials_updated_at
BEFORE UPDATE ON public.google_workspace_credentials
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();