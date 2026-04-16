
# Plan: Dodanie nawigacji z zakładkami na stronach publicznych

## Co robimy
Dodajemy spójną nawigację (Strona główna, Blog) na wszystkich stronach publicznych: Landing, Blog i BlogPost. Obecnie każda strona ma własny header — ujednolicimy je wspólnym komponentem.

## Szczegóły techniczne

### 1. Komponent `PublicNav.tsx`
Nowy komponent nawigacji z zakładkami:
- Logo + nazwa "KSeF Archiwum" (link do `/`)
- Zakładki: **Strona główna** (`/`), **Blog** (`/blog`)
- Aktywna zakładka podświetlona (na podstawie bieżącej ścieżki)
- Przyciski "Zaloguj się" / "Rozpocznij" po prawej
- Responsywny — na mobile hamburger menu lub uproszczona nawigacja
- Sticky header z backdrop-blur (zachowujemy obecny styl glassmorphism)

### 2. Aktualizacja stron
- **Landing.tsx** — zastąpienie obecnego inline headera (linie 112-138) komponentem `PublicNav`
- **Blog.tsx** — zastąpienie headera z "Strona główna" linkiem na `PublicNav` z aktywną zakładką "Blog"
- **BlogPost.tsx** — dodanie `PublicNav` z aktywną zakładką "Blog" (zamiast samego "Wróć do bloga")

### 3. Styl zakładek
- Zakładki w stylu Apple — minimalistyczne, podkreślenie lub zmiana koloru dla aktywnej
- Na mobile: kompaktowy layout z ikonami
