
-- Bank accounts table
CREATE TABLE public.bank_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL,
  iban TEXT NOT NULL,
  holder_name TEXT,
  provider TEXT NOT NULL DEFAULT 'manual',
  provider_account_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  last_synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bank accounts"
  ON public.bank_accounts FOR SELECT TO authenticated
  USING (
    company_id IN (SELECT c.id FROM companies c WHERE c.user_id = auth.uid())
    OR user_has_company_access(auth.uid(), company_id)
  );

CREATE POLICY "Users can manage own bank accounts"
  ON public.bank_accounts FOR ALL TO authenticated
  USING (company_id IN (SELECT c.id FROM companies c WHERE c.user_id = auth.uid()))
  WITH CHECK (company_id IN (SELECT c.id FROM companies c WHERE c.user_id = auth.uid()));

CREATE TRIGGER update_bank_accounts_updated_at
  BEFORE UPDATE ON public.bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Bank transactions table
CREATE TABLE public.bank_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  transaction_id TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'PLN',
  date DATE NOT NULL,
  counterparty_name TEXT,
  counterparty_iban TEXT,
  description TEXT,
  reference TEXT,
  type TEXT NOT NULL DEFAULT 'credit',
  matched_invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  match_confidence NUMERIC,
  match_status TEXT NOT NULL DEFAULT 'unmatched',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bank transactions"
  ON public.bank_transactions FOR SELECT TO authenticated
  USING (
    company_id IN (SELECT c.id FROM companies c WHERE c.user_id = auth.uid())
    OR user_has_company_access(auth.uid(), company_id)
  );

CREATE POLICY "Users can manage own bank transactions"
  ON public.bank_transactions FOR ALL TO authenticated
  USING (company_id IN (SELECT c.id FROM companies c WHERE c.user_id = auth.uid()))
  WITH CHECK (company_id IN (SELECT c.id FROM companies c WHERE c.user_id = auth.uid()));

CREATE TRIGGER update_bank_transactions_updated_at
  BEFORE UPDATE ON public.bank_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_bank_transactions_company ON public.bank_transactions(company_id);
CREATE INDEX idx_bank_transactions_date ON public.bank_transactions(date);
CREATE INDEX idx_bank_transactions_matched ON public.bank_transactions(matched_invoice_id);
CREATE INDEX idx_bank_transactions_status ON public.bank_transactions(match_status);
