
-- Extend invoices table
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'ksef',
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS payment_due_date DATE,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_invoices_payment_status ON public.invoices(payment_status);
CREATE INDEX IF NOT EXISTS idx_invoices_payment_due ON public.invoices(payment_due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_source ON public.invoices(source);
CREATE INDEX IF NOT EXISTS idx_invoices_tags ON public.invoices USING GIN(tags);

-- Extend companies with tax settings
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS tax_type TEXT NOT NULL DEFAULT 'liniowy',
  ADD COLUMN IF NOT EXISTS default_vat_rate TEXT NOT NULL DEFAULT '23%';

-- Contacts table (auto-built from invoice data)
CREATE TABLE IF NOT EXISTS public.contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  nip TEXT,
  street TEXT,
  city TEXT,
  postal_code TEXT,
  email TEXT,
  phone TEXT,
  total_revenue NUMERIC NOT NULL DEFAULT 0,
  total_cost NUMERIC NOT NULL DEFAULT 0,
  invoice_count INTEGER NOT NULL DEFAULT 0,
  last_invoice_date DATE,
  payment_reliability TEXT NOT NULL DEFAULT 'unknown',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, nip)
);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own contacts"
  ON public.contacts FOR SELECT TO authenticated
  USING (
    company_id IN (SELECT c.id FROM companies c WHERE c.user_id = auth.uid())
    OR user_has_company_access(auth.uid(), company_id)
  );

CREATE POLICY "Users can manage own contacts"
  ON public.contacts FOR ALL TO authenticated
  USING (company_id IN (SELECT c.id FROM companies c WHERE c.user_id = auth.uid()))
  WITH CHECK (company_id IN (SELECT c.id FROM companies c WHERE c.user_id = auth.uid()));

CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_contacts_company ON public.contacts(company_id);
CREATE INDEX idx_contacts_nip ON public.contacts(nip);

-- Function to sync contacts from invoices
CREATE OR REPLACE FUNCTION public.sync_contacts_from_invoices(_company_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.contacts (company_id, name, nip, total_revenue, total_cost, invoice_count, last_invoice_date)
  SELECT
    _company_id,
    i.vendor,
    i.nip,
    COALESCE(SUM(CASE WHEN i.invoice_type = 'przychodowa' THEN i.gross_amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN i.invoice_type = 'kosztowa' THEN i.gross_amount ELSE 0 END), 0),
    COUNT(*),
    MAX(i.date)
  FROM public.invoices i
  WHERE i.company_id = _company_id
  GROUP BY i.vendor, i.nip
  ON CONFLICT (company_id, nip) DO UPDATE SET
    name = EXCLUDED.name,
    total_revenue = EXCLUDED.total_revenue,
    total_cost = EXCLUDED.total_cost,
    invoice_count = EXCLUDED.invoice_count,
    last_invoice_date = EXCLUDED.last_invoice_date,
    updated_at = now();
END;
$$;
