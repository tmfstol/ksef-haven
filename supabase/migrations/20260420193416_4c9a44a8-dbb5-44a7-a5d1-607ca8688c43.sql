CREATE OR REPLACE FUNCTION public.sync_contacts_from_invoices(_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Agreguj po NIP (lub po vendor jeśli NIP NULL/pusty), aby uniknąć duplikatów na (company_id, nip)
  WITH agg AS (
    SELECT
      _company_id AS company_id,
      COALESCE(NULLIF(i.nip, ''), 'BRAK-' || i.vendor) AS nip_key,
      MAX(i.vendor) AS name,
      COALESCE(SUM(CASE WHEN i.invoice_type = 'przychodowa' THEN i.gross_amount ELSE 0 END), 0) AS total_revenue,
      COALESCE(SUM(CASE WHEN i.invoice_type = 'kosztowa' THEN i.gross_amount ELSE 0 END), 0) AS total_cost,
      COUNT(*)::int AS invoice_count,
      MAX(i.date) AS last_invoice_date
    FROM public.invoices i
    WHERE i.company_id = _company_id
    GROUP BY COALESCE(NULLIF(i.nip, ''), 'BRAK-' || i.vendor)
  )
  INSERT INTO public.contacts (company_id, name, nip, total_revenue, total_cost, invoice_count, last_invoice_date)
  SELECT company_id, name, nip_key, total_revenue, total_cost, invoice_count, last_invoice_date
  FROM agg
  ON CONFLICT (company_id, nip) DO UPDATE SET
    name = EXCLUDED.name,
    total_revenue = EXCLUDED.total_revenue,
    total_cost = EXCLUDED.total_cost,
    invoice_count = EXCLUDED.invoice_count,
    last_invoice_date = EXCLUDED.last_invoice_date,
    updated_at = now();
END;
$function$;