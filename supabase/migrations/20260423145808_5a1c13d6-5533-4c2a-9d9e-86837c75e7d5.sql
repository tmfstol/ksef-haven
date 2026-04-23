-- ============ EMPLOYEE GROUPS ============
CREATE TABLE public.employee_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  owner_user_id uuid NULL, -- NULL = global (company-wide), NOT NULL = private
  name text NOT NULL,
  color text NOT NULL DEFAULT '#8b5cf6',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_emp_groups_company ON public.employee_groups(company_id);
CREATE INDEX idx_emp_groups_owner ON public.employee_groups(owner_user_id);

ALTER TABLE public.employee_groups ENABLE ROW LEVEL SECURITY;

-- Anyone with company access can see company groups; private groups only the owner sees
CREATE POLICY "View groups (company or own)"
  ON public.employee_groups FOR SELECT TO authenticated
  USING (
    (
      owner_user_id IS NULL
      AND (
        company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
        OR public.user_has_company_access(auth.uid(), company_id)
      )
    )
    OR owner_user_id = auth.uid()
  );

-- Global groups: only owner/admin can manage. Private groups: only the owner.
CREATE POLICY "Manage groups"
  ON public.employee_groups FOR ALL TO authenticated
  USING (
    (owner_user_id IS NULL AND public.is_company_owner_or_admin(auth.uid(), company_id))
    OR owner_user_id = auth.uid()
  )
  WITH CHECK (
    (owner_user_id IS NULL AND public.is_company_owner_or_admin(auth.uid(), company_id))
    OR owner_user_id = auth.uid()
  );

CREATE TRIGGER update_employee_groups_updated_at
  BEFORE UPDATE ON public.employee_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ GROUP MEMBERS ============
CREATE TABLE public.employee_group_members (
  group_id uuid NOT NULL REFERENCES public.employee_groups(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, employee_id)
);

CREATE INDEX idx_egm_group ON public.employee_group_members(group_id);
CREATE INDEX idx_egm_employee ON public.employee_group_members(employee_id);

ALTER TABLE public.employee_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View group members"
  ON public.employee_group_members FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employee_groups g
      WHERE g.id = group_id
        AND (
          (g.owner_user_id IS NULL
            AND (g.company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
                 OR public.user_has_company_access(auth.uid(), g.company_id)))
          OR g.owner_user_id = auth.uid()
        )
    )
  );

CREATE POLICY "Manage group members"
  ON public.employee_group_members FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employee_groups g
      WHERE g.id = group_id
        AND (
          (g.owner_user_id IS NULL AND public.is_company_owner_or_admin(auth.uid(), g.company_id))
          OR g.owner_user_id = auth.uid()
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.employee_groups g
      WHERE g.id = group_id
        AND (
          (g.owner_user_id IS NULL AND public.is_company_owner_or_admin(auth.uid(), g.company_id))
          OR g.owner_user_id = auth.uid()
        )
    )
  );