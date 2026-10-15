-- =====================================================================
-- 20261015120000_add_yearly_seasons.sql
-- Yıllık Sezon (Arşiv) Sistemi
-- 1. sezon tablosu oluşturulur (2026 varsayılan olarak eklenir)
-- 2. kurbanlık_hesap, buyukbas_hayvan, buyukbas_hissedar ve tarihçe tablolarına yil kolonu eklenir
-- 3. buyukbas_hayvan PK'si (yil, number) composite yapılır, hissedar FK'si güncellenir
-- 4. Kapalı sezona yazmayı engelleyen veritabanı tetikleyicisi eklenir
-- =====================================================================

-- ─── 1. SEZON TABLOSU ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sezon (
  yil         integer PRIMARY KEY CHECK (yil BETWEEN 2000 AND 2100),
  ad          text NOT NULL DEFAULT '',
  durum       text NOT NULL DEFAULT 'acik' CHECK (durum IN ('acik', 'kapali')),
  is_default  boolean NOT NULL DEFAULT false,
  notlar      text DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  closed_at   timestamptz
);

COMMENT ON TABLE public.sezon IS 'Kurban bayramı sezonları/yılları ve durumları (acik/kapali).';

-- Tek bir varsayılan sezon olabilir
CREATE UNIQUE INDEX IF NOT EXISTS sezon_single_default
  ON public.sezon (is_default)
  WHERE is_default = true;

-- 2026 sezonunu varsayılan olarak ekle
INSERT INTO public.sezon (yil, ad, durum, is_default, notlar)
VALUES (2026, '2026 Kurban Sezonu', 'acik', true, 'Mevcut veriler 2026 sezonuna aktarıldı.')
ON CONFLICT (yil) DO UPDATE SET is_default = EXCLUDED.is_default;

ALTER TABLE public.sezon ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anon sezon okuyabilir" ON public.sezon;
CREATE POLICY "Anon sezon okuyabilir"
  ON public.sezon FOR SELECT TO anon USING (true);

GRANT SELECT ON public.sezon TO anon;


-- ─── 2. KÜÇÜKBAŞ (kurbanlık_hesap) YIL KOLONU ─────────────────────────────────

ALTER TABLE public."kurbanlık_hesap"
  ADD COLUMN IF NOT EXISTS yil integer DEFAULT 2026;

UPDATE public."kurbanlık_hesap"
   SET yil = 2026
 WHERE yil IS NULL;

ALTER TABLE public."kurbanlık_hesap"
  ALTER COLUMN yil SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_kurbanlik_hesap_sezon'
  ) THEN
    ALTER TABLE public."kurbanlık_hesap"
      ADD CONSTRAINT fk_kurbanlik_hesap_sezon
      FOREIGN KEY (yil) REFERENCES public.sezon (yil);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS kurbanlik_hesap_yil_number_idx
  ON public."kurbanlık_hesap" (yil, number);


-- ─── 3. BÜYÜKBAŞ TABLOLARI (buyukbas_hayvan & buyukbas_hissedar) ──────────────

ALTER TABLE public.buyukbas_hayvan
  ADD COLUMN IF NOT EXISTS yil integer DEFAULT 2026;

UPDATE public.buyukbas_hayvan
   SET yil = 2026
 WHERE yil IS NULL;

ALTER TABLE public.buyukbas_hayvan
  ALTER COLUMN yil SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_buyukbas_hayvan_sezon'
  ) THEN
    ALTER TABLE public.buyukbas_hayvan
      ADD CONSTRAINT fk_buyukbas_hayvan_sezon
      FOREIGN KEY (yil) REFERENCES public.sezon (yil);
  END IF;
END $$;

ALTER TABLE public.buyukbas_hissedar
  ADD COLUMN IF NOT EXISTS yil integer DEFAULT 2026;

UPDATE public.buyukbas_hissedar
   SET yil = 2026
 WHERE yil IS NULL;

ALTER TABLE public.buyukbas_hissedar
  ALTER COLUMN yil SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_buyukbas_hissedar_sezon'
  ) THEN
    ALTER TABLE public.buyukbas_hissedar
      ADD CONSTRAINT fk_buyukbas_hissedar_sezon
      FOREIGN KEY (yil) REFERENCES public.sezon (yil);
  END IF;
END $$;

-- Hissedar tablosundaki eski tekil FK'yı kaldır
ALTER TABLE public.buyukbas_hissedar
  DROP CONSTRAINT IF EXISTS buyukbas_hissedar_hayvan_number_fkey;

-- Hayvan tablosundaki eski PK'yı kaldırıp composite (yil, number) yap
ALTER TABLE public.buyukbas_hayvan
  DROP CONSTRAINT IF EXISTS buyukbas_hayvan_pkey CASCADE;

ALTER TABLE public.buyukbas_hayvan
  ADD CONSTRAINT buyukbas_hayvan_pkey PRIMARY KEY (yil, number);

-- Hissedar tablosuna composite FK bağla (ON UPDATE CASCADE ON DELETE CASCADE)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_buyukbas_hissedar_hayvan_composite'
  ) THEN
    ALTER TABLE public.buyukbas_hissedar
      ADD CONSTRAINT fk_buyukbas_hissedar_hayvan_composite
      FOREIGN KEY (yil, hayvan_number)
      REFERENCES public.buyukbas_hayvan (yil, number)
      ON UPDATE CASCADE
      ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS buyukbas_hissedar_yil_hayvan_idx
  ON public.buyukbas_hissedar (yil, hayvan_number);


-- ─── 4. AUDIT / GEÇMİŞ TABLOSU (kurbanlik_hesap_history) ──────────────────────

ALTER TABLE public.kurbanlik_hesap_history
  ADD COLUMN IF NOT EXISTS yil integer DEFAULT 2026;

UPDATE public.kurbanlik_hesap_history
   SET yil = 2026
 WHERE yil IS NULL;

ALTER TABLE public.kurbanlik_hesap_history
  ALTER COLUMN yil SET NOT NULL;

CREATE INDEX IF NOT EXISTS kurbanlik_hesap_history_yil_hayvan_idx
  ON public.kurbanlik_hesap_history (yil, hayvan_number);

-- Tetikleyicileri yil bilgisini de kaydedecek şekilde güncelle
CREATE OR REPLACE FUNCTION public.log_kurbanlik_hesap_history_ud()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO public.kurbanlik_hesap_history (hayvan_number, random_id, yil, snapshot, action)
    VALUES (OLD.number, OLD.random_id, OLD.yil, to_jsonb(row_to_json(OLD)), 'update');
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.kurbanlik_hesap_history (hayvan_number, random_id, yil, snapshot, action)
    VALUES (OLD.number, OLD.random_id, OLD.yil, to_jsonb(row_to_json(OLD)), 'delete');
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_kurbanlik_hesap_history_ins()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.kurbanlik_hesap_history (hayvan_number, random_id, yil, snapshot, action)
  VALUES (NEW.number, NEW.random_id, NEW.yil, to_jsonb(row_to_json(NEW)), 'create');
  RETURN NEW;
END;
$$;


-- ─── 5. KAPALI SEZONA YAZMAYI ENGELLEYEN TETİKLEYİCİ ──────────────────────────

CREATE OR REPLACE FUNCTION public.check_sezon_acik_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_yil integer;
  sezon_durum text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_yil := OLD.yil;
  ELSE
    target_yil := NEW.yil;
  END IF;

  IF target_yil IS NOT NULL THEN
    SELECT durum INTO sezon_durum FROM public.sezon WHERE yil = target_yil;
    IF sezon_durum = 'kapali' THEN
      RAISE EXCEPTION 'İşlem reddedildi: % sezonu kapatılmıştır (salt-okunur).', target_yil;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS check_sezon_acik_kurbanlik_hesap ON public."kurbanlık_hesap";
CREATE TRIGGER check_sezon_acik_kurbanlik_hesap
  BEFORE INSERT OR UPDATE OR DELETE ON public."kurbanlık_hesap"
  FOR EACH ROW EXECUTE FUNCTION public.check_sezon_acik_trigger();

DROP TRIGGER IF EXISTS check_sezon_acik_buyukbas_hayvan ON public.buyukbas_hayvan;
CREATE TRIGGER check_sezon_acik_buyukbas_hayvan
  BEFORE INSERT OR UPDATE OR DELETE ON public.buyukbas_hayvan
  FOR EACH ROW EXECUTE FUNCTION public.check_sezon_acik_trigger();

DROP TRIGGER IF EXISTS check_sezon_acik_buyukbas_hissedar ON public.buyukbas_hissedar;
CREATE TRIGGER check_sezon_acik_buyukbas_hissedar
  BEFORE INSERT OR UPDATE OR DELETE ON public.buyukbas_hissedar
  FOR EACH ROW EXECUTE FUNCTION public.check_sezon_acik_trigger();
