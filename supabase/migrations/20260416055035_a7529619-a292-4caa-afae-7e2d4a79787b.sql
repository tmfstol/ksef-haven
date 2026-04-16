
-- Add invoice_type to invoices
ALTER TABLE public.invoices 
ADD COLUMN invoice_type text NOT NULL DEFAULT 'kosztowa';

-- Create role enum
CREATE TYPE public.company_role AS ENUM ('admin', 'księgowy', 'handlowiec');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  role company_role NOT NULL DEFAULT 'admin',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, company_id)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check role
CREATE OR REPLACE FUNCTION public.get_user_company_role(_user_id uuid, _company_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text
  FROM public.user_roles
  WHERE user_id = _user_id
    AND company_id = _company_id
  LIMIT 1;
$$;

-- RLS for user_roles: only company owner (admin) or the user themselves can see roles
CREATE POLICY "Users can view roles in own companies"
ON public.user_roles FOR SELECT TO authenticated
USING (
  company_id IN (SELECT id FROM companies WHERE user_id = auth.uid())
  OR user_id = auth.uid()
);

CREATE POLICY "Company owners can manage roles"
ON public.user_roles FOR ALL TO authenticated
USING (
  company_id IN (SELECT id FROM companies WHERE user_id = auth.uid())
)
WITH CHECK (
  company_id IN (SELECT id FROM companies WHERE user_id = auth.uid())
);

-- Update invoices RLS to filter by role and invoice_type
DROP POLICY IF EXISTS "Users can view own invoices" ON public.invoices;

CREATE POLICY "Users can view own invoices filtered by role"
ON public.invoices FOR SELECT TO authenticated
USING (
  company_id IN (
    SELECT c.id FROM companies c WHERE c.user_id = auth.uid()
  )
  AND (
    -- Company owner always sees everything
    company_id IN (SELECT id FROM companies WHERE user_id = auth.uid())
    AND (
      public.get_user_company_role(auth.uid(), company_id) IS NULL -- owner without role = full access
      OR public.get_user_company_role(auth.uid(), company_id) = 'admin'
      OR (public.get_user_company_role(auth.uid(), company_id) = 'księgowy' AND invoice_type = 'kosztowa')
      OR (public.get_user_company_role(auth.uid(), company_id) = 'handlowiec' AND invoice_type = 'przychodowa')
    )
  )
);

-- Auto-assign admin role to company owner on company creation
CREATE OR REPLACE FUNCTION public.auto_assign_admin_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, company_id, role)
    VALUES (NEW.user_id, NEW.id, 'admin')
    ON CONFLICT (user_id, company_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_admin_role
AFTER INSERT ON public.companies
FOR EACH ROW
EXECUTE FUNCTION public.auto_assign_admin_role();

-- Assign admin role to existing company owners
INSERT INTO public.user_roles (user_id, company_id, role)
SELECT user_id, id, 'admin'
FROM public.companies
WHERE user_id IS NOT NULL
ON CONFLICT (user_id, company_id) DO NOTHING;
