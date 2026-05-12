DROP POLICY IF EXISTS "Users can manage own projects" ON public.projects;

CREATE POLICY "Members can view projects"
ON public.projects FOR SELECT
TO authenticated
USING (
  company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  OR public.user_has_company_access(auth.uid(), company_id)
);

CREATE POLICY "Members can insert projects"
ON public.projects FOR INSERT
TO authenticated
WITH CHECK (
  company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  OR public.user_has_company_access(auth.uid(), company_id)
);

CREATE POLICY "Members can update projects"
ON public.projects FOR UPDATE
TO authenticated
USING (
  company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  OR public.user_has_company_access(auth.uid(), company_id)
)
WITH CHECK (
  company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  OR public.user_has_company_access(auth.uid(), company_id)
);

CREATE POLICY "Owners and admins can delete projects"
ON public.projects FOR DELETE
TO authenticated
USING (public.is_company_owner_or_admin(auth.uid(), company_id));