-- Fix: team members (non-owners) couldn't read their companies because companies_safe view
-- was using security_invoker which requires SELECT permission on base table.
-- Switch back to SECURITY DEFINER mode; view already filters rows by user access
-- and excludes sensitive columns (ksef_token, make_webhook_url, bank_account).

ALTER VIEW public.companies_safe SET (security_invoker = off);

-- Ensure the view filter uses safe access check (already in place, recreate to be explicit)
CREATE OR REPLACE VIEW public.companies_safe
WITH (security_invoker = off) AS
SELECT
  id, name, nip, street, city, postal_code, country_code,
  email, phone, invoice_pattern, tax_type, default_vat_rate,
  is_active, client_portal_email, storage_path,
  created_at, updated_at, user_id
FROM public.companies c
WHERE user_id = auth.uid()
   OR public.user_has_company_access(auth.uid(), id);

GRANT SELECT ON public.companies_safe TO authenticated;