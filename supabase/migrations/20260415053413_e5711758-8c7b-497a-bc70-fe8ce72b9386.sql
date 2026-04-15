
CREATE TABLE public.invoice_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL DEFAULT 1,
  name TEXT NOT NULL DEFAULT '',
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit TEXT DEFAULT 'szt.',
  unit_price_net NUMERIC NOT NULL DEFAULT 0,
  net_amount NUMERIC NOT NULL DEFAULT 0,
  vat_rate TEXT DEFAULT '23%',
  vat_amount NUMERIC NOT NULL DEFAULT 0,
  gross_amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own invoice items"
ON public.invoice_items
FOR SELECT
USING (
  invoice_id IN (
    SELECT i.id FROM public.invoices i
    JOIN public.companies c ON i.company_id = c.id
    WHERE c.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert own invoice items"
ON public.invoice_items
FOR INSERT
WITH CHECK (
  invoice_id IN (
    SELECT i.id FROM public.invoices i
    JOIN public.companies c ON i.company_id = c.id
    WHERE c.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete own invoice items"
ON public.invoice_items
FOR DELETE
USING (
  invoice_id IN (
    SELECT i.id FROM public.invoices i
    JOIN public.companies c ON i.company_id = c.id
    WHERE c.user_id = auth.uid()
  )
);

CREATE POLICY "Service role full access invoice_items"
ON public.invoice_items
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE INDEX idx_invoice_items_invoice_id ON public.invoice_items(invoice_id);
