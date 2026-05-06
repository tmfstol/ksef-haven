-- Allow team members (not only company owners) to update invoices they can access,
-- respecting role-based filtering (księgowy → kosztowa, handlowiec → przychodowa, admin → all).
CREATE POLICY "Team members can update invoices by role"
ON public.invoices
FOR UPDATE
TO authenticated
USING (
  user_has_company_access(auth.uid(), company_id)
  AND (
    get_user_company_role(auth.uid(), company_id) IS NULL
    OR get_user_company_role(auth.uid(), company_id) = 'admin'
    OR (get_user_company_role(auth.uid(), company_id) = 'księgowy' AND invoice_type = 'kosztowa')
    OR (get_user_company_role(auth.uid(), company_id) = 'handlowiec' AND invoice_type = 'przychodowa')
  )
)
WITH CHECK (
  user_has_company_access(auth.uid(), company_id)
  AND (
    get_user_company_role(auth.uid(), company_id) IS NULL
    OR get_user_company_role(auth.uid(), company_id) = 'admin'
    OR (get_user_company_role(auth.uid(), company_id) = 'księgowy' AND invoice_type = 'kosztowa')
    OR (get_user_company_role(auth.uid(), company_id) = 'handlowiec' AND invoice_type = 'przychodowa')
  )
);