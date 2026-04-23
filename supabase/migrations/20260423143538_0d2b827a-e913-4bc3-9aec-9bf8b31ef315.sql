-- Recreate companies_safe so invited members (księgowy/handlowiec) can see their companies
-- The view excludes ksef_token, so it's safe to expose to all team members.
-- Use security_invoker=off so the view bypasses base table RLS, but filter inside
-- the view using user_has_company_access() to scope rows to the caller.

DROP VIEW IF EXISTS public.companies_safe;

CREATE VIEW public.companies_safe
WITH (security_invoker=off) AS
SELECT
  c.id,
  c.name,
  c.nip,
  c.street,
  c.city,
  c.postal_code,
  c.country_code,
  c.email,
  c.phone,
  c.invoice_pattern,
  c.tax_type,
  c.default_vat_rate,
  c.is_active,
  c.client_portal_email,
  c.storage_path,
  c.created_at,
  c.updated_at,
  c.user_id
FROM public.companies c
WHERE
  c.user_id = auth.uid()
  OR public.user_has_company_access(auth.uid(), c.id);

GRANT SELECT ON public.companies_safe TO authenticated;