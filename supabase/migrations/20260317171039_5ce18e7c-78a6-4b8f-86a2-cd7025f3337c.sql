-- Add user_id to companies table
ALTER TABLE public.companies ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update existing RLS policies for companies
DROP POLICY IF EXISTS "Allow all access to companies" ON public.companies;

CREATE POLICY "Users can view own companies"
ON public.companies FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own companies"
ON public.companies FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own companies"
ON public.companies FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own companies"
ON public.companies FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- Update existing RLS policies for invoices
DROP POLICY IF EXISTS "Allow all access to invoices" ON public.invoices;

CREATE POLICY "Users can view own invoices"
ON public.invoices FOR SELECT TO authenticated
USING (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own invoices"
ON public.invoices FOR INSERT TO authenticated
WITH CHECK (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own invoices"
ON public.invoices FOR UPDATE TO authenticated
USING (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()))
WITH CHECK (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own invoices"
ON public.invoices FOR DELETE TO authenticated
USING (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()));

-- Also allow service_role (edge functions) full access
CREATE POLICY "Service role full access companies"
ON public.companies FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access invoices"
ON public.invoices FOR ALL TO service_role
USING (true) WITH CHECK (true);