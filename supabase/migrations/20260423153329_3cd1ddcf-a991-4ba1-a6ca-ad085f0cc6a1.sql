
-- Tabela: timesheet_scans (historia zeskanowanych kart)
CREATE TABLE public.timesheet_scans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  uploaded_by UUID,
  image_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | processing | completed | failed
  ai_response JSONB,
  rows_count INTEGER NOT NULL DEFAULT 0,
  rows_assigned INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.timesheet_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members manage timesheet_scans"
ON public.timesheet_scans FOR ALL TO authenticated
USING (
  company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  OR public.user_has_company_access(auth.uid(), company_id)
)
WITH CHECK (
  company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  OR public.user_has_company_access(auth.uid(), company_id)
);

CREATE TRIGGER update_timesheet_scans_updated_at
BEFORE UPDATE ON public.timesheet_scans
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_timesheet_scans_company ON public.timesheet_scans(company_id, created_at DESC);

-- Tabela: employee_hours (godziny przypisane do projektów)
CREATE TABLE public.employee_hours (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  scan_id UUID REFERENCES public.timesheet_scans(id) ON DELETE SET NULL,
  employee_id UUID,
  employee_name_raw TEXT, -- co AI odczytało z kartki (gdy brak match)
  project_id UUID,
  work_date DATE NOT NULL,
  hours NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | confirmed
  raw_data JSONB,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.employee_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members manage employee_hours"
ON public.employee_hours FOR ALL TO authenticated
USING (
  company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  OR public.user_has_company_access(auth.uid(), company_id)
)
WITH CHECK (
  company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  OR public.user_has_company_access(auth.uid(), company_id)
);

CREATE TRIGGER update_employee_hours_updated_at
BEFORE UPDATE ON public.employee_hours
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_employee_hours_project ON public.employee_hours(project_id, work_date DESC);
CREATE INDEX idx_employee_hours_employee ON public.employee_hours(employee_id, work_date DESC);
CREATE INDEX idx_employee_hours_company ON public.employee_hours(company_id, work_date DESC);

-- Storage bucket: timesheet-scans (prywatny)
INSERT INTO storage.buckets (id, name, public)
VALUES ('timesheet-scans', 'timesheet-scans', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: członkowie firmy widzą i wgrywają (folder = company_id)
CREATE POLICY "Members read timesheet scans"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'timesheet-scans'
  AND (
    (storage.foldername(name))[1]::uuid IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
    OR public.user_has_company_access(auth.uid(), (storage.foldername(name))[1]::uuid)
  )
);

CREATE POLICY "Members upload timesheet scans"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'timesheet-scans'
  AND (
    (storage.foldername(name))[1]::uuid IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
    OR public.user_has_company_access(auth.uid(), (storage.foldername(name))[1]::uuid)
  )
);

CREATE POLICY "Members delete timesheet scans"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'timesheet-scans'
  AND (
    (storage.foldername(name))[1]::uuid IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
    OR public.user_has_company_access(auth.uid(), (storage.foldername(name))[1]::uuid)
  )
);
