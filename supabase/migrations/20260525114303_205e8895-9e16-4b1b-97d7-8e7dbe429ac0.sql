
-- 1) Invoice items: allow team members to INSERT/UPDATE/DELETE based on their role on the parent invoice
DROP POLICY IF EXISTS "Users can insert own invoice items" ON public.invoice_items;
DROP POLICY IF EXISTS "Users can delete own invoice items" ON public.invoice_items;
DROP POLICY IF EXISTS "Team members can insert invoice items by role" ON public.invoice_items;
DROP POLICY IF EXISTS "Team members can update invoice items by role" ON public.invoice_items;
DROP POLICY IF EXISTS "Team members can delete invoice items by role" ON public.invoice_items;

CREATE POLICY "Team members can insert invoice items by role"
ON public.invoice_items
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_items.invoice_id
      AND (
        i.company_id IN (SELECT c.id FROM public.companies c WHERE c.user_id = auth.uid())
        OR (
          public.user_has_company_access(auth.uid(), i.company_id) AND (
            public.get_user_company_role(auth.uid(), i.company_id) IS NULL
            OR public.get_user_company_role(auth.uid(), i.company_id) = 'admin'
            OR (public.get_user_company_role(auth.uid(), i.company_id) = 'księgowy' AND i.invoice_type = 'kosztowa')
            OR (public.get_user_company_role(auth.uid(), i.company_id) = 'handlowiec' AND i.invoice_type = 'przychodowa')
          )
        )
      )
  )
);

CREATE POLICY "Team members can update invoice items by role"
ON public.invoice_items
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_items.invoice_id
      AND (
        i.company_id IN (SELECT c.id FROM public.companies c WHERE c.user_id = auth.uid())
        OR (
          public.user_has_company_access(auth.uid(), i.company_id) AND (
            public.get_user_company_role(auth.uid(), i.company_id) IS NULL
            OR public.get_user_company_role(auth.uid(), i.company_id) = 'admin'
            OR (public.get_user_company_role(auth.uid(), i.company_id) = 'księgowy' AND i.invoice_type = 'kosztowa')
            OR (public.get_user_company_role(auth.uid(), i.company_id) = 'handlowiec' AND i.invoice_type = 'przychodowa')
          )
        )
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_items.invoice_id
      AND (
        i.company_id IN (SELECT c.id FROM public.companies c WHERE c.user_id = auth.uid())
        OR (
          public.user_has_company_access(auth.uid(), i.company_id) AND (
            public.get_user_company_role(auth.uid(), i.company_id) IS NULL
            OR public.get_user_company_role(auth.uid(), i.company_id) = 'admin'
            OR (public.get_user_company_role(auth.uid(), i.company_id) = 'księgowy' AND i.invoice_type = 'kosztowa')
            OR (public.get_user_company_role(auth.uid(), i.company_id) = 'handlowiec' AND i.invoice_type = 'przychodowa')
          )
        )
      )
  )
);

CREATE POLICY "Team members can delete invoice items by role"
ON public.invoice_items
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_items.invoice_id
      AND (
        i.company_id IN (SELECT c.id FROM public.companies c WHERE c.user_id = auth.uid())
        OR (
          public.user_has_company_access(auth.uid(), i.company_id) AND (
            public.get_user_company_role(auth.uid(), i.company_id) IS NULL
            OR public.get_user_company_role(auth.uid(), i.company_id) = 'admin'
            OR (public.get_user_company_role(auth.uid(), i.company_id) = 'księgowy' AND i.invoice_type = 'kosztowa')
            OR (public.get_user_company_role(auth.uid(), i.company_id) = 'handlowiec' AND i.invoice_type = 'przychodowa')
          )
        )
      )
  )
);

-- 2) Module permissions: prevent admins from changing their own permissions; only the company owner may do so
DROP POLICY IF EXISTS "Admins manage permissions" ON public.module_permissions;

CREATE POLICY "Owner manages all permissions"
ON public.module_permissions
FOR ALL
TO authenticated
USING (
  company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
)
WITH CHECK (
  company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
);

CREATE POLICY "Admins manage permissions for other users"
ON public.module_permissions
FOR ALL
TO authenticated
USING (
  user_id <> auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.company_id = module_permissions.company_id
      AND user_roles.role = 'admin'::company_role
  )
)
WITH CHECK (
  user_id <> auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.company_id = module_permissions.company_id
      AND user_roles.role = 'admin'::company_role
  )
);
