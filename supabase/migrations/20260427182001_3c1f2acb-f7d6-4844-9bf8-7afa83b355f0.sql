-- ===== KNR / Norma PRO model extension =====

-- 1) master_catalog: rozszerzenie o KNR i pełne nakłady RMS
ALTER TABLE public.master_catalog
  ADD COLUMN IF NOT EXISTS knr_number text,
  ADD COLUMN IF NOT EXISTS knr_chapter text,
  ADD COLUMN IF NOT EXISTS opis_pelny text,
  ADD COLUMN IF NOT EXISTS naklad_robocizny numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS naklad_materialu numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS naklad_sprzetu numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cena_sprzetu_netto numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stawka_rg numeric NOT NULL DEFAULT 25.00;

CREATE INDEX IF NOT EXISTS idx_master_catalog_knr ON public.master_catalog(company_id, knr_number);

-- 2) estimate_items: rozszerzenie o KNR + denormalizacja wartości RMS
ALTER TABLE public.estimate_items
  ADD COLUMN IF NOT EXISTS knr_number text,
  ADD COLUMN IF NOT EXISTS opis_pelny text,
  ADD COLUMN IF NOT EXISTS naklad_robocizny numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS naklad_materialu numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS naklad_sprzetu numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stawka_rg numeric NOT NULL DEFAULT 25.00,
  ADD COLUMN IF NOT EXISTS cena_sprz numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wartosc_r numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wartosc_m numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wartosc_s numeric NOT NULL DEFAULT 0;

-- 3) estimates: dane inwestora/wykonawcy + narzuty
ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS inwestor_nazwa text,
  ADD COLUMN IF NOT EXISTS inwestor_adres text,
  ADD COLUMN IF NOT EXISTS wykonawca_nazwa text,
  ADD COLUMN IF NOT EXISTS wykonawca_adres text,
  ADD COLUMN IF NOT EXISTS lokalizacja_obiektu text,
  ADD COLUMN IF NOT EXISTS podstawa_opracowania text DEFAULT 'KNR - Katalog Nakładów Rzeczowych',
  ADD COLUMN IF NOT EXISTS narzut_kp_proc numeric NOT NULL DEFAULT 65,
  ADD COLUMN IF NOT EXISTS narzut_zysk_proc numeric NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS vat_proc numeric NOT NULL DEFAULT 23,
  ADD COLUMN IF NOT EXISTS suma_sprzet numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS data_kosztorysu date DEFAULT CURRENT_DATE;
