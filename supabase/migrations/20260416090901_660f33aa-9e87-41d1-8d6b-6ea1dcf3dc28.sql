
-- Create storage bucket for invoice PDF uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoice-uploads', 'invoice-uploads', false);

-- Allow authenticated users to upload files
CREATE POLICY "Users can upload invoice PDFs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'invoice-uploads');

-- Allow authenticated users to view their uploads
CREATE POLICY "Users can view invoice PDFs"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'invoice-uploads');

-- Allow authenticated users to delete their uploads
CREATE POLICY "Users can delete invoice PDFs"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'invoice-uploads');

-- Service role full access
CREATE POLICY "Service role full access invoice-uploads"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'invoice-uploads')
WITH CHECK (bucket_id = 'invoice-uploads');
