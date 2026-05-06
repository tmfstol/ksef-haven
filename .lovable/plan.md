## Co zrobię teraz w kodzie

### 1. Badge Lovable (już zrobione w poprzedniej turze)
- Badge ukryty przez `publish_settings`. W kodzie aplikacji nigdy go nie było — wstrzykuje go hosting na publikacji. Po opublikowaniu nie pojawi się na facturo.info. **Status: gotowe.**

### 3. Meta tagi i OG image
- Wygeneruję porządny OG image 1200x630 (logo + claim + cena 15 zł/mies.) i zapiszę jako `public/og-image.jpg`.
- Zaktualizuję `index.html` i komponent `Seo.tsx`: `og:image`, `twitter:image`, `apple-touch-icon` 180x180, link do `manifest.json`.
- Dodam `public/manifest.json` + ikony 192/512 (z istniejącego favicon).

### 4. Wydajność (częściowo)
- Code-splitting: zamienię importy stron w `App.tsx` na `React.lazy` + `Suspense`, żeby landing nie ciągnął całego CRM/KSeF/kosztorysów.
- `loading="lazy"` na `<img>` poza viewportem na landingu.
- Konwersji obrazów do WebP nie zrobię automatycznie — Lovable nie ma do tego pipeline'u; zostawię jako zalecenie.

### 5. Zaufanie i zgodność
- Stopka publiczna: dodam linki Polityka Prywatności, Regulamin, RODO, dane firmy (NIP, adres, kontakt) z `legal-config.ts`.
- Strona `/bezpieczenstwo` — opis szyfrowania, regionu hostingu (EU/Supabase), backupów, KSeF, RODO.
- Strona `/status` — prosta strona z linkiem/info; pełny statuspage wymaga zewnętrznego serwisu.
- Baner cookie RODO (kategorie: niezbędne / analityczne / marketingowe), zapis zgody w `localStorage`.

### 8. Landing
- Sprawdzę obecny `Landing.tsx` — jeśli brakuje sekcji (Dla kogo, Funkcje z ikonami, FAQ, Sekcja zaufania, Stopka), dodam je.
- JSON-LD `FAQPage` na sekcji FAQ; `Organization` w `index.html`.

---

## Czego NIE zrobię (i dlaczego)

### 2. Prerender / SSR landing page
**Niewykonalne w Lovable bez większej rearchitektury.** Lovable hostuje SPA (Vite). `vite-plugin-prerender`, `react-snap` ani migracja na Next.js nie są wspierane w tym środowisku — build jest zarządzany. Crawlery Google'a od dawna renderują JS, więc SEO SPA działa, ale nie tak dobrze jak SSG.

**Realna alternatywa do rozważenia:**
- Wystawić landing jako oddzielny statyczny projekt (Next.js / Astro) na innym hostingu (Vercel/Cloudflare Pages) pod `facturo.info`, a aplikację przenieść na `app.facturo.info`. To trzeba zrobić poza Lovable.

### 6. Nagłówki bezpieczeństwa (HSTS, CSP, X-Content-Type-Options, Referrer-Policy, Permissions-Policy)
**Nie ustawia się ich z poziomu kodu Vite/React.** Trzeba je skonfigurować na warstwie hostingu/CDN (Cloudflare, Vercel, Netlify). Lovable hosting na `*.lovable.app` nie eksponuje konfiguracji nagłówków — to musisz zrobić po stronie Cloudflare nakładki na `facturo.info`. Dam Ci gotowy zestaw reguł CSP do wklejenia.

### 7. Sentry + Analityka
- Sentry: wymaga konta i DSN — daj DSN, to wepnę.
- Plausible/Umami/GA4: wymaga konta. Powiedz, którą platformę i ID, to wepnę z consent mode v2 (powiązane z banerem cookie z punktu 5).

---

## Pytania zanim ruszę

Czy mam:
1. Iść z całą listą "co zrobię teraz" w jednej iteracji (duża zmiana, kilkanaście plików)?
2. Czy podzielić na mniejsze etapy i zacząć od konkretnego (np. landing + stopka + cookie banner najpierw)?
3. Czy przekazujesz teraz DSN Sentry / ID analityki, żeby od razu wpiąć?

Po Twoim "ok" zaczynam od punktów 3, 4, 5, 8 — to są realne zmiany w kodzie. Punkty 2, 6, 7 wymagają działań po Twojej stronie (hosting / konta zewnętrzne) i opiszę je w finalnym podsumowaniu.