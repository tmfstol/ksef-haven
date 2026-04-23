-- Drop recursive policies on companies
DROP POLICY IF EXISTS "Owners and admins can view full company data" ON public.companies;

-- Recreate using SECURITY DEFINER function (no recursion)
CREATE POLICY "Owners and admins can view full company data"
ON public.companies
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_company_owner_or_admin(auth.uid(), id)
);

-- Drop recursive policies on user_roles that reference companies
DROP POLICY IF EXISTS "Users can view roles in own companies" ON public.user_roles;
DROP POLICY IF EXISTS "Company owners can view roles" ON public.user_roles;
DROP POLICY IF EXISTS "Company owners can insert team roles" ON public.user_roles;
DROP POLICY IF EXISTS "Company owners can update team roles" ON public.user_roles;
DROP POLICY IF EXISTS "Company owners can delete team roles" ON public.user_roles;

-- Helper: check if user owns a company without triggering RLS
CREATE OR REPLACE FUNCTION public.is_company_owner(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.companies
    WHERE id = _company_id AND user_id = _user_id
  );
$$;

-- SELECT: own row OR owner of the company
CREATE POLICY "View roles for own or owned companies"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_company_owner(auth.uid(), company_id)
);

-- INSERT: only company owner, cannot self-assign, target user must have profile
CREATE POLICY "Owners insert team roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_company_owner(auth.uid(), company_id)
  AND user_id <> auth.uid()
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = user_roles.user_id)
);

-- UPDATE: only company owner, cannot modify own role
CREATE POLICY "Owners update team roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (
  public.is_company_owner(auth.uid(), company_id)
  AND user_id <> auth.uid()
)
WITH CHECK (
  public.is_company_owner(auth.uid(), company_id)
  AND user_id <> auth.uid()
);

-- DELETE: only company owner, cannot delete own role
CREATE POLICY "Owners delete team roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (
  public.is_company_owner(auth.uid(), company_id)
  AND user_id <> auth.uid()
);