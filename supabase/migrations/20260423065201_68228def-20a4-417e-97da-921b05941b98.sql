
-- 1. Remove non-admin member access to companies table (sensitive columns).
-- Non-admin members must use the companies_safe view instead.
DROP POLICY IF EXISTS "Members can view companies they belong to" ON public.companies;

-- 2. Restrict invoice_items SELECT by role mirroring invoices policy.
DROP POLICY IF EXISTS "Users can view invoice items" ON public.invoice_items;

CREATE POLICY "Users can view invoice items by role"
ON public.invoice_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.invoices i
    WHERE i.id = invoice_items.invoice_id
      AND (
        -- Owner of company sees all
        i.company_id IN (SELECT c.id FROM public.companies c WHERE c.user_id = auth.uid())
        OR (
          public.user_has_company_access(auth.uid(), i.company_id)
          AND (
            public.get_user_company_role(auth.uid(), i.company_id) IS NULL
            OR public.get_user_company_role(auth.uid(), i.company_id) = 'admin'
            OR (public.get_user_company_role(auth.uid(), i.company_id) = 'księgowy' AND i.invoice_type = 'kosztowa')
            OR (public.get_user_company_role(auth.uid(), i.company_id) = 'handlowiec' AND i.invoice_type = 'przychodowa')
          )
        )
      )
  )
);

-- 3. Restrict user_roles INSERT/UPDATE: prevent assigning a role to self via this path
-- and require the target user already has a profile (i.e. they exist).
DROP POLICY IF EXISTS "Company owners can manage roles" ON public.user_roles;

CREATE POLICY "Company owners can view roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  company_id IN (SELECT companies.id FROM public.companies WHERE companies.user_id = auth.uid())
);

CREATE POLICY "Company owners can insert team roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  company_id IN (SELECT companies.id FROM public.companies WHERE companies.user_id = auth.uid())
  AND user_id <> auth.uid()
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = user_roles.user_id)
);

CREATE POLICY "Company owners can update team roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (
  company_id IN (SELECT companies.id FROM public.companies WHERE companies.user_id = auth.uid())
  AND user_id <> auth.uid()
)
WITH CHECK (
  company_id IN (SELECT companies.id FROM public.companies WHERE companies.user_id = auth.uid())
  AND user_id <> auth.uid()
);

CREATE POLICY "Company owners can delete team roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (
  company_id IN (SELECT companies.id FROM public.companies WHERE companies.user_id = auth.uid())
  AND user_id <> auth.uid()
);

-- 4. Restrict blog-images bucket: prevent bucket-wide listing while keeping per-object reads.
-- Drop any existing broad SELECT policy on blog-images.
DROP POLICY IF EXISTS "Public read blog-images" ON storage.objects;
DROP POLICY IF EXISTS "Public can read blog-images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view blog images" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;

-- Allow reading individual files only when the object name is provided (no bucket listing).
CREATE POLICY "Public read individual blog-images"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'blog-images'
  AND name IS NOT NULL
  AND length(name) > 0
);

-- Make the bucket itself non-public so the storage API requires the per-object policy
-- (signed/direct object URLs still work; bucket listing is blocked).
UPDATE storage.buckets SET public = false WHERE id = 'blog-images';
