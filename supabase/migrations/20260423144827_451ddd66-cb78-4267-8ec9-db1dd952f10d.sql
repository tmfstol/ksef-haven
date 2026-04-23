-- ============ EMPLOYEES ============
CREATE TABLE public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NULL,
  name text NOT NULL,
  order_number integer NULL,
  color text NOT NULL DEFAULT '#6366f1',
  phone text NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_employees_company ON public.employees(company_id);
CREATE INDEX idx_employees_order ON public.employees(company_id, order_number);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View employees in own companies"
  ON public.employees FOR SELECT TO authenticated
  USING (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
    OR public.user_has_company_access(auth.uid(), company_id)
  );

CREATE POLICY "Owners/admins manage employees"
  ON public.employees FOR ALL TO authenticated
  USING (public.is_company_owner_or_admin(auth.uid(), company_id))
  WITH CHECK (public.is_company_owner_or_admin(auth.uid(), company_id));

CREATE TRIGGER update_employees_updated_at
  BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ VEHICLES ============
CREATE TABLE public.vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  registration text NULL,
  color text NOT NULL DEFAULT '#64748b',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_vehicles_company ON public.vehicles(company_id);

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View vehicles in own companies"
  ON public.vehicles FOR SELECT TO authenticated
  USING (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
    OR public.user_has_company_access(auth.uid(), company_id)
  );

CREATE POLICY "Owners/admins manage vehicles"
  ON public.vehicles FOR ALL TO authenticated
  USING (public.is_company_owner_or_admin(auth.uid(), company_id))
  WITH CHECK (public.is_company_owner_or_admin(auth.uid(), company_id));

CREATE TRIGGER update_vehicles_updated_at
  BEFORE UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ ASSIGNMENTS ============
CREATE TABLE public.assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  vehicle_id uuid NULL REFERENCES public.vehicles(id) ON DELETE SET NULL,
  task_type text NOT NULL DEFAULT 'wyjazd',
  -- wyjazd | rozbiorka | serwis | montaz
  location text NULL,
  description text NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assignments_dates_chk CHECK (end_date >= start_date),
  CONSTRAINT assignments_task_type_chk CHECK (task_type IN ('wyjazd','rozbiorka','serwis','montaz'))
);

CREATE INDEX idx_assignments_company_date ON public.assignments(company_id, start_date, end_date);
CREATE INDEX idx_assignments_employee ON public.assignments(employee_id);

ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View assignments in own companies"
  ON public.assignments FOR SELECT TO authenticated
  USING (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
    OR public.user_has_company_access(auth.uid(), company_id)
  );

CREATE POLICY "Owners/admins manage assignments"
  ON public.assignments FOR ALL TO authenticated
  USING (public.is_company_owner_or_admin(auth.uid(), company_id))
  WITH CHECK (public.is_company_owner_or_admin(auth.uid(), company_id));

CREATE TRIGGER update_assignments_updated_at
  BEFORE UPDATE ON public.assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();