
-- Expense categories
CREATE TABLE public.expense_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  icon TEXT DEFAULT 'receipt',
  color TEXT DEFAULT '#6366f1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own categories" ON public.expense_categories FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Expenses
CREATE TABLE public.expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'PLN',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  vendor_name TEXT,
  description TEXT,
  document_path TEXT,
  ocr_status TEXT NOT NULL DEFAULT 'none',
  ocr_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own expenses" ON public.expenses FOR ALL TO authenticated
  USING (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()))
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()));
CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Clients (CRM)
CREATE TABLE public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  nip TEXT,
  email TEXT,
  phone TEXT,
  street TEXT,
  city TEXT,
  postal_code TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own clients" ON public.clients FOR ALL TO authenticated
  USING (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()))
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()));
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tax declarations
CREATE TABLE public.tax_declarations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'PIT', 'JPK-V7M', etc.
  period_from DATE NOT NULL,
  period_to DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft', -- draft, generated, submitted
  file_path TEXT,
  xml_content TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tax_declarations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own declarations" ON public.tax_declarations FOR ALL TO authenticated
  USING (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()))
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()));
CREATE TRIGGER update_tax_declarations_updated_at BEFORE UPDATE ON public.tax_declarations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Payment alerts
CREATE TABLE public.payment_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'new_transaction', -- new_transaction, payment_matched, overdue
  title TEXT NOT NULL,
  description TEXT,
  amount NUMERIC,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own alerts" ON public.payment_alerts FOR ALL TO authenticated
  USING (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()))
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()));

-- AI chat messages
CREATE TABLE public.ai_chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  role TEXT NOT NULL, -- 'user', 'assistant'
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own messages" ON public.ai_chat_messages FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
