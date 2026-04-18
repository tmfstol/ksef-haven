
CREATE TABLE public.google_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  resource_type TEXT NOT NULL, -- 'sheet' | 'doc' | 'drive_file' | 'calendar_event'
  title TEXT NOT NULL,
  url TEXT,
  external_id TEXT, -- Google file id or event id
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_google_activity_company_created ON public.google_activity_log(company_id, created_at DESC);

ALTER TABLE public.google_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace users can read activity log"
ON public.google_activity_log
FOR SELECT TO authenticated
USING (public.has_module_permission(auth.uid(), company_id, 'workspace'));

CREATE POLICY "Workspace users can insert activity"
ON public.google_activity_log
FOR INSERT TO authenticated
WITH CHECK (public.has_module_permission(auth.uid(), company_id, 'workspace'));

CREATE POLICY "Workspace users can delete own activity"
ON public.google_activity_log
FOR DELETE TO authenticated
USING (
  public.has_module_permission(auth.uid(), company_id, 'workspace')
  AND created_by = auth.uid()
);

CREATE POLICY "Service role full access google_activity_log"
ON public.google_activity_log
FOR ALL TO service_role
USING (true) WITH CHECK (true);
