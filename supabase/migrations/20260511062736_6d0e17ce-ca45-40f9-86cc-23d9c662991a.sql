
CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  category text,
  file_path text NOT NULL,
  file_size integer,
  mime_type text,
  sent_to_portal_at timestamptz,
  sent_to_portal_by uuid,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view documents in their companies"
ON public.documents FOR SELECT TO authenticated
USING (
  company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  OR public.user_has_company_access(auth.uid(), company_id)
);

CREATE POLICY "Users can insert documents in their companies"
ON public.documents FOR INSERT TO authenticated
WITH CHECK (
  company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  OR public.user_has_company_access(auth.uid(), company_id)
);

CREATE POLICY "Users can update documents in their companies"
ON public.documents FOR UPDATE TO authenticated
USING (
  company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  OR public.user_has_company_access(auth.uid(), company_id)
);

CREATE POLICY "Users can delete documents in their companies"
ON public.documents FOR DELETE TO authenticated
USING (
  company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  OR public.user_has_company_access(auth.uid(), company_id)
);

CREATE TRIGGER update_documents_updated_at
BEFORE UPDATE ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_documents_company ON public.documents(company_id, created_at DESC);
