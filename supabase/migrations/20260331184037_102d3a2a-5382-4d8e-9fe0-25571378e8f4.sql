
-- Add seller details to companies
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS street text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS country_code text NOT NULL DEFAULT 'PL',
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS bank_account text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS invoice_pattern text NOT NULL DEFAULT 'FV/{NNN}/{MM}/{RRRR}';

-- Invoice sequences table for auto-numbering
CREATE TABLE public.invoice_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  year integer NOT NULL,
  month integer NOT NULL,
  last_number integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, year, month)
);

ALTER TABLE public.invoice_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own sequences"
  ON public.invoice_sequences
  FOR ALL
  TO authenticated
  USING (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()))
  WITH CHECK (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()));

CREATE POLICY "Service role full access invoice_sequences"
  ON public.invoice_sequences
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
