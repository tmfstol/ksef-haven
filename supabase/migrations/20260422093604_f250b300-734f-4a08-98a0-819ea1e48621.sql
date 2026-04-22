-- =========================================================
-- 1. PROFILES — restrict SELECT to self + same-company members
-- =========================================================
DROP POLICY IF EXISTS "Profiles viewable by authenticated users" ON public.profiles;

CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can view profiles of company members"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.user_roles ur1
    JOIN public.user_roles ur2 ON ur1.company_id = ur2.company_id
    WHERE ur1.user_id = auth.uid()
      AND ur2.user_id = profiles.user_id
  )
  OR EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.user_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.company_id = c.id AND ur.user_id = profiles.user_id
      )
  )
);

-- =========================================================
-- 2. COMPANIES — hide sensitive fields from non-owner roles
-- =========================================================
DROP POLICY IF EXISTS "Users can view own companies" ON public.companies;

-- Owner & admin: full access
CREATE POLICY "Owners and admins can view full company data"
ON public.companies
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.company_id = companies.id
      AND ur.role = 'admin'::company_role
  )
);

-- Other members: limited access through view (policy still allows row read,
-- view masks sensitive columns)
CREATE POLICY "Members can view companies they belong to"
ON public.companies
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.company_id = companies.id
      AND ur.role <> 'admin'::company_role
  )
);

-- Safe view exposing only non-sensitive columns to all members
CREATE OR REPLACE VIEW public.companies_safe
WITH (security_invoker = true)
AS
SELECT
  id,
  name,
  nip,
  street,
  city,
  postal_code,
  country_code,
  email,
  phone,
  invoice_pattern,
  tax_type,
  default_vat_rate,
  is_active,
  client_portal_email,
  storage_path,
  created_at,
  updated_at,
  user_id
FROM public.companies;

GRANT SELECT ON public.companies_safe TO authenticated;

-- Helper function: returns true only for owner/admin
CREATE OR REPLACE FUNCTION public.is_company_owner_or_admin(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.companies WHERE id = _company_id AND user_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND company_id = _company_id AND role = 'admin'::company_role
  );
$$;

-- =========================================================
-- 3. GOOGLE WORKSPACE CREDENTIALS — owner/admin only
-- =========================================================
DROP POLICY IF EXISTS "Module users can read google credentials" ON public.google_workspace_credentials;

-- "Owners read credentials" already exists for owner/admin.
-- Module users will use a server-side function instead of reading raw tokens.

-- =========================================================
-- 4. INVOICE_ITEMS — restrict to authenticated role
-- =========================================================
DROP POLICY IF EXISTS "Users can insert own invoice items" ON public.invoice_items;
DROP POLICY IF EXISTS "Users can delete own invoice items" ON public.invoice_items;

CREATE POLICY "Users can insert own invoice items"
ON public.invoice_items
FOR INSERT
TO authenticated
WITH CHECK (
  invoice_id IN (
    SELECT i.id FROM public.invoices i
    JOIN public.companies c ON i.company_id = c.id
    WHERE c.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete own invoice items"
ON public.invoice_items
FOR DELETE
TO authenticated
USING (
  invoice_id IN (
    SELECT i.id FROM public.invoices i
    JOIN public.companies c ON i.company_id = c.id
    WHERE c.user_id = auth.uid()
  )
);

-- =========================================================
-- 5. STORAGE: invoice-uploads — verify company ownership via path
-- Path structure: {user_id}/{company_id}/{filename}
-- =========================================================
DROP POLICY IF EXISTS "Users can view invoice PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload invoice PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete invoice PDFs" ON storage.objects;

CREATE POLICY "Users can view own company invoice PDFs"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'invoice-uploads'
  AND (
    -- File path starts with auth user id
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    -- Or user has access to the company in path[2]
    public.user_has_company_access(
      auth.uid(),
      ((storage.foldername(name))[2])::uuid
    )
  )
);

CREATE POLICY "Users can upload own company invoice PDFs"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'invoice-uploads'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete own company invoice PDFs"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'invoice-uploads'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- =========================================================
-- 6. STORAGE: blog-images — restrict INSERT to service_role
-- =========================================================
DROP POLICY IF EXISTS "Service role write blog images" ON storage.objects;

CREATE POLICY "Service role write blog images"
ON storage.objects
FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'blog-images');