-- Allow any user with workspace module permission to read credentials (so UI status works for non-owners)
CREATE POLICY "Module users can read google credentials"
ON public.google_workspace_credentials
FOR SELECT
TO authenticated
USING (
  public.has_module_permission(auth.uid(), company_id, 'workspace')
);