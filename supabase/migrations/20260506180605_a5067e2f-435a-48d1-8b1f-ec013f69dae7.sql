ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS payment_method text;

-- Mark all cash invoices as paid automatically (existing data: best-effort - we'll mark via sync going forward)
-- For new column we don't know yet; just create it.