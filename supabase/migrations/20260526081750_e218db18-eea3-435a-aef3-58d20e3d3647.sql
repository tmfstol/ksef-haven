-- Align INSERT/DELETE policies for invoice-uploads with SELECT policy
DROP POLICY IF EXISTS "Users can upload own company invoice PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own company invoice PDFs" ON storage.objects;

CREATE POLICY "Users can upload own company invoice PDFs"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'invoice-uploads'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR public.user_has_company_access(auth.uid(), ((storage.foldername(name))[1])::uuid)
    OR public.user_has_company_access(auth.uid(), ((storage.foldername(name))[2])::uuid)
  )
);

CREATE POLICY "Users can delete own company invoice PDFs"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'invoice-uploads'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR public.user_has_company_access(auth.uid(), ((storage.foldername(name))[1])::uuid)
    OR public.user_has_company_access(auth.uid(), ((storage.foldername(name))[2])::uuid)
  )
);
