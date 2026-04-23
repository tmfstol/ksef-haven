
-- Make blog-images bucket public so images are accessible
UPDATE storage.buckets SET public = true WHERE id = 'blog-images';

-- Clear cover_image_url for all posts so they get regenerated
UPDATE public.blog_posts SET cover_image_url = NULL;

-- Public read policy for blog-images bucket
DROP POLICY IF EXISTS "Public read blog images" ON storage.objects;
CREATE POLICY "Public read blog images" ON storage.objects FOR SELECT USING (bucket_id = 'blog-images');

-- Service role can manage blog images
DROP POLICY IF EXISTS "Service role manages blog images" ON storage.objects;
CREATE POLICY "Service role manages blog images" ON storage.objects FOR ALL TO service_role USING (bucket_id = 'blog-images') WITH CHECK (bucket_id = 'blog-images');
