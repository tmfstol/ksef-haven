
-- Restrict full companies row read to owner only (admins/team members use companies_safe view)
DROP POLICY IF EXISTS "Owners and admins can view full company data" ON public.companies;

CREATE POLICY "Only owner can view full company data"
ON public.companies
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Restrict google_workspace_credentials read to owner only (edge functions use service_role)
DROP POLICY IF EXISTS "Owners read credentials" ON public.google_workspace_credentials;
DROP POLICY IF EXISTS "Owners manage credentials" ON public.google_workspace_credentials;

CREATE POLICY "Owner reads google credentials"
ON public.google_workspace_credentials
FOR SELECT
TO authenticated
USING (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()));

CREATE POLICY "Owner manages google credentials"
ON public.google_workspace_credentials
FOR ALL
TO authenticated
USING (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()))
WITH CHECK (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()));
