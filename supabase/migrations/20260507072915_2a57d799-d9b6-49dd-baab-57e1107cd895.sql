ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.projects(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_projects_parent_id ON public.projects(parent_id);