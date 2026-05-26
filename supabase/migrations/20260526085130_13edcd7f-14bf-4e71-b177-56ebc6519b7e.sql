
-- 1) Fix storage policies: unify on path[1] as canonical company segment
DROP POLICY IF EXISTS "Users can view own company invoice PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own company invoice PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own company invoice PDFs" ON storage.objects;

CREATE POLICY "Users can view own company invoice PDFs"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'invoice-uploads'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR public.user_has_company_access(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
);

CREATE POLICY "Users can upload own company invoice PDFs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'invoice-uploads'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR public.user_has_company_access(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
);

CREATE POLICY "Users can delete own company invoice PDFs"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'invoice-uploads'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR public.user_has_company_access(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
);

CREATE POLICY "Users can update own company invoice PDFs"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'invoice-uploads'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR public.user_has_company_access(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
)
WITH CHECK (
  bucket_id = 'invoice-uploads'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR public.user_has_company_access(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
);

-- 2) Invoices: allow role-scoped INSERT by team members
DROP POLICY IF EXISTS "Team members can insert invoices by role" ON public.invoices;
CREATE POLICY "Team members can insert invoices by role"
ON public.invoices FOR INSERT TO authenticated
WITH CHECK (
  public.user_has_company_access(auth.uid(), company_id)
  AND (
    public.get_user_company_role(auth.uid(), company_id) IS NULL
    OR public.get_user_company_role(auth.uid(), company_id) = 'admin'
    OR (public.get_user_company_role(auth.uid(), company_id) = 'księgowy' AND invoice_type = 'kosztowa')
    OR (public.get_user_company_role(auth.uid(), company_id) = 'handlowiec' AND invoice_type = 'przychodowa')
  )
);

-- 3) Expenses: allow team members to manage expenses
DROP POLICY IF EXISTS "Team members can manage expenses" ON public.expenses;
CREATE POLICY "Team members can manage expenses"
ON public.expenses FOR ALL TO authenticated
USING (public.user_has_company_access(auth.uid(), company_id))
WITH CHECK (public.user_has_company_access(auth.uid(), company_id));
