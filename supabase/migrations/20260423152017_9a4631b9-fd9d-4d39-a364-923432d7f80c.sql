-- 1. Master catalog (cennik bazowy per firma)
CREATE TABLE public.master_catalog (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branza TEXT NOT NULL CHECK (branza IN ('Budowlanka', 'Instalacje', 'Meble')),
  kategoria TEXT NOT NULL DEFAULT 'Ogólne',
  nazwa TEXT NOT NULL,
  jednostka TEXT NOT NULL DEFAULT 'szt',
  cena_zakupu_materialu NUMERIC NOT NULL DEFAULT 0,
  cena_robocizny_netto NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_master_catalog_company ON public.master_catalog(company_id);
CREATE INDEX idx_master_catalog_branza ON public.master_catalog(company_id, branza);
CREATE INDEX idx_master_catalog_search ON public.master_catalog USING gin (to_tsvector('simple', nazwa || ' ' || COALESCE(kategoria, '')));

ALTER TABLE public.master_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members manage master_catalog"
  ON public.master_catalog FOR ALL TO authenticated
  USING (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()) OR public.user_has_company_access(auth.uid(), company_id))
  WITH CHECK (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()) OR public.user_has_company_access(auth.uid(), company_id));

CREATE TRIGGER update_master_catalog_updated_at
  BEFORE UPDATE ON public.master_catalog
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Estimates (nagłówki kosztorysów)
CREATE TABLE public.estimates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  nazwa_kosztorysu TEXT NOT NULL,
  branza TEXT NOT NULL CHECK (branza IN ('Budowlanka', 'Instalacje', 'Meble')),
  marza_material NUMERIC NOT NULL DEFAULT 20,
  marza_robocizna NUMERIC NOT NULL DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'archived')),
  client_name TEXT,
  notes TEXT,
  suma_material NUMERIC NOT NULL DEFAULT 0,
  suma_robocizna NUMERIC NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_estimates_company ON public.estimates(company_id);
CREATE INDEX idx_estimates_project ON public.estimates(project_id);

ALTER TABLE public.estimates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members manage estimates"
  ON public.estimates FOR ALL TO authenticated
  USING (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()) OR public.user_has_company_access(auth.uid(), company_id))
  WITH CHECK (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()) OR public.user_has_company_access(auth.uid(), company_id));

CREATE TRIGGER update_estimates_updated_at
  BEFORE UPDATE ON public.estimates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Estimate stages (etapy)
CREATE TABLE public.estimate_stages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  estimate_id UUID NOT NULL REFERENCES public.estimates(id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL DEFAULT 1,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_estimate_stages_estimate ON public.estimate_stages(estimate_id, ordinal);

ALTER TABLE public.estimate_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members manage estimate_stages"
  ON public.estimate_stages FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.estimates e WHERE e.id = estimate_stages.estimate_id AND (e.company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()) OR public.user_has_company_access(auth.uid(), e.company_id))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.estimates e WHERE e.id = estimate_stages.estimate_id AND (e.company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()) OR public.user_has_company_access(auth.uid(), e.company_id))));

CREATE TRIGGER update_estimate_stages_updated_at
  BEFORE UPDATE ON public.estimate_stages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Estimate items (pozycje)
CREATE TABLE public.estimate_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  estimate_id UUID NOT NULL REFERENCES public.estimates(id) ON DELETE CASCADE,
  stage_id UUID REFERENCES public.estimate_stages(id) ON DELETE SET NULL,
  catalog_id UUID REFERENCES public.master_catalog(id) ON DELETE SET NULL,
  ordinal INTEGER NOT NULL DEFAULT 1,
  nazwa TEXT NOT NULL,
  jednostka TEXT NOT NULL DEFAULT 'szt',
  ilosc NUMERIC NOT NULL DEFAULT 1,
  cena_mat NUMERIC NOT NULL DEFAULT 0,
  cena_rob NUMERIC NOT NULL DEFAULT 0,
  wymiary TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_estimate_items_estimate ON public.estimate_items(estimate_id, ordinal);
CREATE INDEX idx_estimate_items_stage ON public.estimate_items(stage_id);

ALTER TABLE public.estimate_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members manage estimate_items"
  ON public.estimate_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.estimates e WHERE e.id = estimate_items.estimate_id AND (e.company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()) OR public.user_has_company_access(auth.uid(), e.company_id))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.estimates e WHERE e.id = estimate_items.estimate_id AND (e.company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()) OR public.user_has_company_access(auth.uid(), e.company_id))));

CREATE TRIGGER update_estimate_items_updated_at
  BEFORE UPDATE ON public.estimate_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();