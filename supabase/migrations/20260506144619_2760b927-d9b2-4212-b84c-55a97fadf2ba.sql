ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS bookkeeper_note_by uuid,
  ADD COLUMN IF NOT EXISTS bookkeeper_note_at timestamptz;