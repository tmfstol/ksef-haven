ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS vat_whitelist_status text NOT NULL DEFAULT 'not_checked',
  ADD COLUMN IF NOT EXISTS vat_whitelist_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS vat_whitelist_account text,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_invoices_payment_status ON public.invoices(company_id, payment_status);
CREATE INDEX IF NOT EXISTS idx_invoices_vat_whitelist ON public.invoices(company_id, vat_whitelist_status);