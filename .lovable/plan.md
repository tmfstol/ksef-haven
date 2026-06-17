
# Klient poczty — MVP

Nowy moduł **Poczta** w aplikacji: jeden zunifikowany inbox dla Gmail, WP i home.pl. Wysyłka, odbiór, foldery (INBOX/Wysłane/Wersje robocze/Kosz), wątki podstawowe.

## Co użytkownik zobaczy

- Nowa pozycja **Poczta** w sidebarze (`/mail`).
- Lewa kolumna: lista kont (z możliwością dodania), pod nią foldery wybranego konta.
- Środkowa kolumna: lista wiadomości (od kogo, temat, fragment, data, znacznik nieprzeczytane).
- Prawa: podgląd wybranej wiadomości + akcje (Odpowiedz, Prześlij dalej, Usuń, Oznacz przeczytane).
- Przycisk **Napisz** → modal z odbiorcą, tematem, treścią (plain text + prosty markdown).
- Modal **Dodaj konto** z dwiema zakładkami:
  - **Gmail** — przycisk „Połącz z Google" (OAuth, scope `gmail.modify` + `gmail.send`).
  - **WP / home.pl / inne IMAP** — formularz: e-mail, hasło, opcjonalnie serwer/port (presety: WP `imap.wp.pl:993` / `smtp.wp.pl:465`, home.pl `imap.home.pl:993` / `smtp.home.pl:465`).

## Architektura

### Tabele (nowe)
- `mail_accounts` — `id, user_id, company_id, provider ('gmail'|'imap'), email, display_name, imap_host, imap_port, smtp_host, smtp_port, encrypted_password (pgcrypto), oauth_refresh_token (enc), oauth_access_token (enc), token_expires_at, last_sync_at, status, created_at`.
  - RLS: tylko właściciel (`user_id = auth.uid()`). GRANT-y dla `authenticated` + `service_role`.
- `mail_messages` — cache wiadomości: `id, account_id, folder, uid, message_id, thread_id, from_addr, to_addrs[], cc_addrs[], subject, snippet, body_text, body_html, is_read, is_starred, has_attachments, received_at, raw_size`.
  - RLS przez `account_id → mail_accounts.user_id`.
- `mail_attachments` — `id, message_id, filename, mime_type, size, storage_path`.
- Storage bucket prywatny `mail-attachments` z politykami per `user_id` w pierwszym segmencie ścieżki.

Hasła IMAP/SMTP i tokeny OAuth szyfrowane przez `pgcrypto` (`pgp_sym_encrypt`) kluczem `MAIL_ENC_KEY` (nowy secret). Odszyfrowanie wyłącznie w edge functions po stronie serwera.

### Edge functions (nowe)
- `mail-accounts` — CRUD kont (dodaj IMAP/usuń/test connection). Test: próbne IMAP LOGIN + SMTP `verify()`.
- `mail-oauth-gmail-start` / `mail-oauth-gmail-callback` — OAuth Google (per-user) ze scope `gmail.readonly gmail.send gmail.modify`. Zapisuje refresh token w `mail_accounts`.
- `mail-sync` — synchronizacja folderu:
  - Gmail: REST API `users.messages.list` + `get` (format `metadata` → przy otwarciu `full`).
  - IMAP: `npm:imapflow` — `FETCH UID 1:* (ENVELOPE FLAGS RFC822.SIZE)`, body lazy on open.
- `mail-message` — pobranie pełnej treści (Gmail `messages.get?format=full`, IMAP `download`), oznaczanie przeczytane / usuwanie / przenoszenie.
- `mail-send` — wysyłka:
  - Gmail: `users.messages.send` (raw RFC2822 base64url) używając OAuth tokena (auto-refresh).
  - IMAP/SMTP: `npm:nodemailer` z STARTTLS/SSL.

### Frontend
- `src/pages/Mail.tsx` (lazy route w `App.tsx`).
- Komponenty: `MailSidebar`, `AccountList`, `FolderList`, `MessageList`, `MessagePreview`, `ComposeDialog`, `AddAccountDialog`.
- Hook `useMail` (React Query): `useAccounts`, `useFolders`, `useMessages(accountId, folder)`, `useMessage(id)`, mutacje `sendMail`, `markRead`, `deleteMessage`, `syncFolder`.
- Wpis w `MobileBottomNav` + `AppSidebar`.

### Sekrety
- Już są: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`.
- Dodam: `MAIL_ENC_KEY` (32-bajtowy losowy, do `pgp_sym_encrypt`).

## Co MVP **nie** obejmuje (na potem)
- Wątki konwersacji (poza grupowaniem po `thread_id` z Gmail).
- Full-text search po treści w bazie.
- Etykiety/foldery własne, reguły, podpisy, szablony.
- Push (IMAP IDLE, Gmail watch); na razie sync on-demand + przy otwarciu folderu (z TTL 60 s).
- PGP, S/MIME, kalendarz/zaproszenia .ics.

## Kolejność prac

1. Migracja: tabele + `pgcrypto` + RLS + GRANT-y + bucket `mail-attachments`.
2. Dodanie sekretu `MAIL_ENC_KEY`.
3. Edge functions (`mail-accounts`, `mail-oauth-gmail-*`, `mail-sync`, `mail-message`, `mail-send`).
4. Frontend: routing, sidebar, strona `/mail` z trójkolumnowym layoutem, dialogi dodania konta i compose.
5. Test end-to-end na realnym Gmail + jednej skrzynce WP/home.pl.

## Uwagi techniczne

- `imapflow` i `nodemailer` działają w Deno przez `npm:` specifier (node-compat).
- Hasła aplikacji nie są wymagane dla WP/home.pl (zwykłe hasło IMAP OK), ale jeśli użytkownik ma 2FA na koncie e-mail (rzadko w WP), trzeba wygenerować hasło aplikacji.
- Per-user OAuth dla Gmail wymaga, by w Google Cloud Console URL `https://<project>.supabase.co/functions/v1/mail-oauth-gmail-callback` był w „Authorized redirect URIs" — pokażę dokładny URL po wdrożeniu.

Po zatwierdzeniu zaczynam od migracji i edge functions.
