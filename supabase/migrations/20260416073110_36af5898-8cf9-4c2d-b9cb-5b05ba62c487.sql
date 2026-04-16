
-- Helper function to check if user has any role in a company
CREATE OR REPLACE FUNCTION public.user_has_company_access(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND company_id = _company_id
  );
$$;

-- COMPANIES: allow team members to SELECT
DROP POLICY IF EXISTS "Users can view own companies" ON public.companies;
CREATE POLICY "Users can view own companies"
ON public.companies FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.user_has_company_access(auth.uid(), id)
);

-- INVOICES: allow team members to SELECT (with role-based filtering)
DROP POLICY IF EXISTS "Users can view own invoices filtered by role" ON public.invoices;
CREATE POLICY "Users can view own invoices filtered by role"
ON public.invoices FOR SELECT TO authenticated
USING (
  (
    company_id IN (SELECT c.id FROM companies c WHERE c.user_id = auth.uid())
    OR public.user_has_company_access(auth.uid(), company_id)
  )
  AND (
    get_user_company_role(auth.uid(), company_id) IS NULL
    OR get_user_company_role(auth.uid(), company_id) = 'admin'
    OR (get_user_company_role(auth.uid(), company_id) = 'księgowy' AND invoice_type = 'kosztowa')
    OR (get_user_company_role(auth.uid(), company_id) = 'handlowiec' AND invoice_type = 'przychodowa')
  )
);

-- CLIENTS: allow team members to SELECT
DROP POLICY IF EXISTS "Users manage own clients" ON public.clients;
CREATE POLICY "Users can view clients"
ON public.clients FOR SELECT TO authenticated
USING (
  company_id IN (SELECT c.id FROM companies c WHERE c.user_id = auth.uid())
  OR public.user_has_company_access(auth.uid(), company_id)
);
CREATE POLICY "Users can manage own clients"
ON public.clients FOR ALL TO authenticated
USING (company_id IN (SELECT c.id FROM companies c WHERE c.user_id = auth.uid()))
WITH CHECK (company_id IN (SELECT c.id FROM companies c WHERE c.user_id = auth.uid()));

-- EXPENSES: allow team members to SELECT
DROP POLICY IF EXISTS "Users manage own expenses" ON public.expenses;
CREATE POLICY "Users can view expenses"
ON public.expenses FOR SELECT TO authenticated
USING (
  company_id IN (SELECT c.id FROM companies c WHERE c.user_id = auth.uid())
  OR public.user_has_company_access(auth.uid(), company_id)
);
CREATE POLICY "Users can manage own expenses"
ON public.expenses FOR ALL TO authenticated
USING (company_id IN (SELECT c.id FROM companies c WHERE c.user_id = auth.uid()))
WITH CHECK (company_id IN (SELECT c.id FROM companies c WHERE c.user_id = auth.uid()));

-- PROJECTS: allow team members to SELECT
DROP POLICY IF EXISTS "Users manage own projects" ON public.projects;
CREATE POLICY "Users can view projects"
ON public.projects FOR SELECT TO authenticated
USING (
  company_id IN (SELECT c.id FROM companies c WHERE c.user_id = auth.uid())
  OR public.user_has_company_access(auth.uid(), company_id)
);
CREATE POLICY "Users can manage own projects"
ON public.projects FOR ALL TO authenticated
USING (company_id IN (SELECT c.id FROM companies c WHERE c.user_id = auth.uid()))
WITH CHECK (company_id IN (SELECT c.id FROM companies c WHERE c.user_id = auth.uid()));

-- PAYMENT_ALERTS: allow team members to SELECT
DROP POLICY IF EXISTS "Users manage own alerts" ON public.payment_alerts;
CREATE POLICY "Users can view alerts"
ON public.payment_alerts FOR SELECT TO authenticated
USING (
  company_id IN (SELECT c.id FROM companies c WHERE c.user_id = auth.uid())
  OR public.user_has_company_access(auth.uid(), company_id)
);
CREATE POLICY "Users can manage own alerts"
ON public.payment_alerts FOR ALL TO authenticated
USING (company_id IN (SELECT c.id FROM companies c WHERE c.user_id = auth.uid()))
WITH CHECK (company_id IN (SELECT c.id FROM companies c WHERE c.user_id = auth.uid()));

-- INVOICE_ITEMS: allow team members to SELECT
DROP POLICY IF EXISTS "Users can view own invoice items" ON public.invoice_items;
CREATE POLICY "Users can view invoice items"
ON public.invoice_items FOR SELECT TO authenticated
USING (
  invoice_id IN (
    SELECT i.id FROM invoices i
    JOIN companies c ON i.company_id = c.id
    WHERE c.user_id = auth.uid()
  )
  OR invoice_id IN (
    SELECT i.id FROM invoices i
    WHERE public.user_has_company_access(auth.uid(), i.company_id)
  )
);
