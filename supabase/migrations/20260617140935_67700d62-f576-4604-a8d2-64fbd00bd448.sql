
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- mail_accounts
CREATE TABLE public.mail_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  provider text NOT NULL CHECK (provider IN ('gmail','imap')),
  email text NOT NULL,
  display_name text,
  imap_host text,
  imap_port integer,
  imap_secure boolean DEFAULT true,
  smtp_host text,
  smtp_port integer,
  smtp_secure boolean DEFAULT true,
  encrypted_password bytea,
  encrypted_refresh_token bytea,
  encrypted_access_token bytea,
  token_expires_at timestamptz,
  last_sync_at timestamptz,
  status text NOT NULL DEFAULT 'active',
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, email)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mail_accounts TO authenticated;
GRANT ALL ON public.mail_accounts TO service_role;

ALTER TABLE public.mail_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own mail accounts"
ON public.mail_accounts FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_mail_accounts_updated_at
BEFORE UPDATE ON public.mail_accounts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- mail_messages
CREATE TABLE public.mail_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.mail_accounts(id) ON DELETE CASCADE,
  folder text NOT NULL DEFAULT 'INBOX',
  uid text NOT NULL,
  message_id text,
  thread_id text,
  from_addr text,
  to_addrs text[],
  cc_addrs text[],
  subject text,
  snippet text,
  body_text text,
  body_html text,
  is_read boolean NOT NULL DEFAULT false,
  is_starred boolean NOT NULL DEFAULT false,
  has_attachments boolean NOT NULL DEFAULT false,
  received_at timestamptz,
  raw_size integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, folder, uid)
);

CREATE INDEX idx_mail_messages_account_folder_received
  ON public.mail_messages (account_id, folder, received_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mail_messages TO authenticated;
GRANT ALL ON public.mail_messages TO service_role;

ALTER TABLE public.mail_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own mail messages"
ON public.mail_messages FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.mail_accounts a
  WHERE a.id = mail_messages.account_id AND a.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.mail_accounts a
  WHERE a.id = mail_messages.account_id AND a.user_id = auth.uid()
));

CREATE TRIGGER trg_mail_messages_updated_at
BEFORE UPDATE ON public.mail_messages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- mail_attachments
CREATE TABLE public.mail_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.mail_messages(id) ON DELETE CASCADE,
  filename text NOT NULL,
  mime_type text,
  size integer,
  storage_path text,
  content_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mail_attachments TO authenticated;
GRANT ALL ON public.mail_attachments TO service_role;

ALTER TABLE public.mail_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own mail attachments"
ON public.mail_attachments FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.mail_messages m
  JOIN public.mail_accounts a ON a.id = m.account_id
  WHERE m.id = mail_attachments.message_id AND a.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.mail_messages m
  JOIN public.mail_accounts a ON a.id = m.account_id
  WHERE m.id = mail_attachments.message_id AND a.user_id = auth.uid()
));
