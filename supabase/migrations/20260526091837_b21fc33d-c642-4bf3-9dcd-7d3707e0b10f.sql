-- 1) Helper: can the current user access a given invoice-uploads file?
CREATE OR REPLACE FUNCTION public.can_access_invoice_file(_user_id uuid, _name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH parts AS (
    SELECT (storage.foldername(_name))[1] AS company_folder
  )
  SELECT
    -- Owner of the company
    EXISTS (
      SELECT 1 FROM public.companies c, parts
      WHERE c.id::text = parts.company_folder AND c.user_id = _user_id
    )
    OR (
      -- Team member with role check
      EXISTS (
        SELECT 1 FROM parts
        WHERE public.user_has_company_access(_user_id, parts.company_folder::uuid)
      )
      AND (
        -- Admin or legacy NULL role: full access
        (SELECT public.get_user_company_role(_user_id, parts.company_folder::uuid) FROM parts) IS NULL
        OR (SELECT public.get_user_company_role(_user_id, parts.company_folder::uuid) FROM parts) = 'admin'
        -- Role matches an invoice that references this file
        OR EXISTS (
          SELECT 1
          FROM public.invoices i, parts
          WHERE (i.pdf_path = _name OR i.xml_path = _name)
            AND i.company_id::text = parts.company_folder
            AND (
              (public.get_user_company_role(_user_id, i.company_id) = 'księgowy'   AND i.invoice_type = 'kosztowa')
              OR (public.get_user_company_role(_user_id, i.company_id) = 'handlowiec' AND i.invoice_type = 'przychodowa')
            )
        )
      )
    );
$$;

-- 2) Replace storage policies on invoice-uploads
DROP POLICY IF EXISTS "Users can view own company invoice PDFs"   ON storage.objects;
DROP POLICY IF EXISTS "Users can update own company invoice PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own company invoice PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own company invoice PDFs" ON storage.objects;

-- SELECT: role-scoped
CREATE POLICY "Users can view own company invoice PDFs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'invoice-uploads'
  AND public.can_access_invoice_file(auth.uid(), name)
);

-- INSERT: owners and admins only
CREATE POLICY "Users can upload own company invoice PDFs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'invoice-uploads'
  AND (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id::text = (storage.foldername(name))[1] AND c.user_id = auth.uid()
    )
    OR public.get_user_company_role(auth.uid(), ((storage.foldername(name))[1])::uuid) IN ('admin')
  )
);

-- UPDATE: owners and admins only
CREATE POLICY "Users can update own company invoice PDFs"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'invoice-uploads'
  AND (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id::text = (storage.foldername(name))[1] AND c.user_id = auth.uid()
    )
    OR public.get_user_company_role(auth.uid(), ((storage.foldername(name))[1])::uuid) IN ('admin')
  )
)
WITH CHECK (
  bucket_id = 'invoice-uploads'
  AND (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id::text = (storage.foldername(name))[1] AND c.user_id = auth.uid()
    )
    OR public.get_user_company_role(auth.uid(), ((storage.foldername(name))[1])::uuid) IN ('admin')
  )
);

-- DELETE: owners and admins only
CREATE POLICY "Users can delete own company invoice PDFs"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'invoice-uploads'
  AND (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id::text = (storage.foldername(name))[1] AND c.user_id = auth.uid()
    )
    OR public.get_user_company_role(auth.uid(), ((storage.foldername(name))[1])::uuid) IN ('admin')
  )
);

-- 3) Restrict module_permissions admin escalation
-- Add CHECK constraint listing allowed modules
ALTER TABLE public.module_permissions DROP CONSTRAINT IF EXISTS module_permissions_module_check;
ALTER TABLE public.module_permissions
  ADD CONSTRAINT module_permissions_module_check
  CHECK (module IN (
    'invoices_cost','invoices_revenue','expenses','projects','analytics',
    'taxes','bank','contacts','calendar','drive','sheets','gmail','meet','workspace'
  ));

-- Replace admin policy with stricter version: admin must themselves have the module
DROP POLICY IF EXISTS "Admins manage permissions for other users" ON public.module_permissions;
CREATE POLICY "Admins manage permissions for other users"
ON public.module_permissions
FOR ALL
TO authenticated
USING (
  user_id <> auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.company_id = module_permissions.company_id
      AND ur.role = 'admin'::company_role
  )
  AND public.has_module_permission(auth.uid(), module_permissions.company_id, module_permissions.module)
)
WITH CHECK (
  user_id <> auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.company_id = module_permissions.company_id
      AND ur.role = 'admin'::company_role
  )
  AND public.has_module_permission(auth.uid(), module_permissions.company_id, module_permissions.module)
);