-- Tabela rozdzielania kosztów faktur na projekty
CREATE TABLE public.project_costs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  invoice_item_id UUID REFERENCES public.invoice_items(id) ON DELETE SET NULL,
  item_name TEXT,
  net_amount NUMERIC NOT NULL DEFAULT 0,
  gross_amount NUMERIC NOT NULL DEFAULT 0,
  note TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_project_costs_invoice ON public.project_costs(invoice_id);
CREATE INDEX idx_project_costs_project ON public.project_costs(project_id);
CREATE INDEX idx_project_costs_company ON public.project_costs(company_id);

ALTER TABLE public.project_costs ENABLE ROW LEVEL SECURITY;

-- View policy: any user with company access
CREATE POLICY "View project costs in own companies"
ON public.project_costs
FOR SELECT
TO authenticated
USING (
  company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  OR public.user_has_company_access(auth.uid(), company_id)
);

-- Manage policy: owners or any company member with access (księgowy needs to allocate costs)
CREATE POLICY "Members manage project costs"
ON public.project_costs
FOR ALL
TO authenticated
USING (
  company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  OR public.user_has_company_access(auth.uid(), company_id)
)
WITH CHECK (
  company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  OR public.user_has_company_access(auth.uid(), company_id)
);

CREATE TRIGGER update_project_costs_updated_at
BEFORE UPDATE ON public.project_costs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();