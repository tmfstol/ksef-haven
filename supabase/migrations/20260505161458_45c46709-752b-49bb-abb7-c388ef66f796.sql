-- Codzienne generowanie nowego artykułu blogowego dla SEO
SELECT cron.unschedule(jobname) FROM cron.job WHERE jobname IN ('generate-blog-post-weekly','generate-blog-post-daily','blog-post-generator');

SELECT cron.schedule(
  'generate-blog-post-daily',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://pcuizcypuczvqkaectfu.supabase.co/functions/v1/generate-blog-post',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);