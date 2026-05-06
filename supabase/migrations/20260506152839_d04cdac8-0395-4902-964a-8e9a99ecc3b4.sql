ALTER TABLE public.invoices 
  ADD COLUMN IF NOT EXISTS sent_to_portal_at timestamptz,
  ADD COLUMN IF NOT EXISTS sent_to_portal_by uuid;