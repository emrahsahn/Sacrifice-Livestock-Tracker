-- Mevcut tabloları temizleyelim (çakışmaları önlemek için)
DROP TABLE IF EXISTS public.sezon CASCADE;
DROP TABLE IF EXISTS public."kurbanlık_hesap" CASCADE;
DROP TABLE IF EXISTS public.kurbanlik_hesap_history CASCADE;
DROP TABLE IF EXISTS public.buyukbas_hayvan CASCADE;
DROP TABLE IF EXISTS public.buyukbas_hissedar CASCADE;

-- =====================================================================
-- 20260501145500_create_kurbanlik_hesap.sql
-- =====================================================================
-- Generated from current Supabase project for account migration
create table if not exists public."kurbanlık_hesap" (
  number text primary key,
  type text,
  special text,
  color_of_earring text,
  color_of_animal text,
  whose text,
  from_whom text,
  price double precision,
  phone_number text,
  payment_method text
);

alter table public."kurbanlık_hesap" enable row level security;

-- =====================================================================
-- 20260501160000_add_payment_status.sql
-- =====================================================================
-- Ödeme durumu kolonunu kurbanlık_hesap tablosuna ekler.
ALTER TABLE public."kurbanlık_hesap"
  ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'Belirsiz';

-- =====================================================================
-- 20260501170000_add_rls_policies.sql
-- =====================================================================
-- kurbanlık_hesap tablosu için RLS policy'leri
DROP POLICY IF EXISTS "Anon okuyabilir" ON public."kurbanlık_hesap";
DROP POLICY IF EXISTS "Anon ekleyebilir" ON public."kurbanlık_hesap";
DROP POLICY IF EXISTS "Anon güncelleyebilir" ON public."kurbanlık_hesap";
DROP POLICY IF EXISTS "Anon silebilir" ON public."kurbanlık_hesap";

create policy "Anon okuyabilir"
  on public."kurbanlık_hesap"
  for select
  to anon
  using (true);

create policy "Anon ekleyebilir"
  on public."kurbanlık_hesap"
  for insert
  to anon
  with check (true);

create policy "Anon güncelleyebilir"
  on public."kurbanlık_hesap"
  for update
  to anon
  using (true)
  with check (true);

create policy "Anon silebilir"
  on public."kurbanlık_hesap"
  for delete
  to anon
  using (true);

-- =====================================================================
-- 20260503120000_add_group_category_address_spray.sql
-- =====================================================================
ALTER TABLE public."kurbanlık_hesap"
  ADD COLUMN IF NOT EXISTS group_category text DEFAULT '';

ALTER TABLE public."kurbanlık_hesap"
  ADD COLUMN IF NOT EXISTS address text DEFAULT '';

ALTER TABLE public."kurbanlık_hesap"
  ADD COLUMN IF NOT EXISTS spray_paint_color text DEFAULT '';

-- =====================================================================
-- 20260503180000_kurbanlik_hesap_history.sql
-- =====================================================================
CREATE TABLE public.kurbanlik_hesap_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hayvan_number text NOT NULL,
  snapshot jsonb NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  action text NOT NULL CHECK (action IN ('create', 'update', 'delete'))
);

CREATE INDEX kurbanlik_hesap_history_hayvan_number_recorded_at_idx
  ON public.kurbanlik_hesap_history (hayvan_number, recorded_at DESC);

COMMENT ON TABLE public.kurbanlik_hesap_history IS
  'kurbanlık_hesap satırlarının geçmiş snapshotları; tetikleyici ile dolar.';

CREATE OR REPLACE FUNCTION public.log_kurbanlik_hesap_history_ud()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO public.kurbanlik_hesap_history (hayvan_number, snapshot, action)
    VALUES (
      OLD.number,
      to_jsonb(row_to_json(OLD)),
      'update'
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.kurbanlik_hesap_history (hayvan_number, snapshot, action)
    VALUES (
      OLD.number,
      to_jsonb(row_to_json(OLD)),
      'delete'
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS kurbanlik_hesap_history_ud ON public."kurbanlık_hesap";
CREATE TRIGGER kurbanlik_hesap_history_ud
  BEFORE UPDATE OR DELETE ON public."kurbanlık_hesap"
  FOR EACH ROW
  EXECUTE FUNCTION public.log_kurbanlik_hesap_history_ud();

CREATE OR REPLACE FUNCTION public.log_kurbanlik_hesap_history_ins()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.kurbanlik_hesap_history (hayvan_number, snapshot, action)
  VALUES (
    NEW.number,
    to_jsonb(row_to_json(NEW)),
    'create'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS kurbanlik_hesap_history_ins ON public."kurbanlık_hesap";
CREATE TRIGGER kurbanlik_hesap_history_ins
  AFTER INSERT ON public."kurbanlık_hesap"
  FOR EACH ROW
  EXECUTE FUNCTION public.log_kurbanlik_hesap_history_ins();

ALTER TABLE public.kurbanlik_hesap_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon geçmişi okuyabilir"
  ON public.kurbanlik_hesap_history
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Authenticated geçmişi okuyabilir"
  ON public.kurbanlik_hesap_history
  FOR SELECT
  TO authenticated
  USING (true);

GRANT SELECT ON public.kurbanlik_hesap_history TO anon;
GRANT SELECT ON public.kurbanlik_hesap_history TO authenticated;

-- =====================================================================
-- 20260504100000_add_agreed_total.sql
-- =====================================================================
ALTER TABLE public."kurbanlık_hesap"
  ADD COLUMN IF NOT EXISTS agreed_total double precision;

UPDATE public."kurbanlık_hesap"
SET agreed_total = price
WHERE agreed_total IS NULL;

-- =====================================================================
-- 20260504120000_add_customer_note.sql
-- =====================================================================
ALTER TABLE public."kurbanlık_hesap"
  ADD COLUMN IF NOT EXISTS note text DEFAULT '';

-- =====================================================================
-- 20260507200000_composite_pk_and_string_animals.sql
-- =====================================================================
ALTER TABLE public."kurbanlık_hesap"
  ADD COLUMN IF NOT EXISTS random_id text;

UPDATE public."kurbanlık_hesap"
   SET random_id = substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)
 WHERE random_id IS NULL;

ALTER TABLE public."kurbanlık_hesap"
  ALTER COLUMN random_id SET NOT NULL,
  ALTER COLUMN random_id SET DEFAULT substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);

UPDATE public."kurbanlık_hesap"
   SET phone_number = CASE
     WHEN phone_number IS NULL THEN '00000000000'
     WHEN length(regexp_replace(phone_number, '\D', '', 'g')) = 11
          AND regexp_replace(phone_number, '\D', '', 'g') ~ '^0'
       THEN regexp_replace(phone_number, '\D', '', 'g')
     WHEN length(regexp_replace(phone_number, '\D', '', 'g')) = 10
       THEN '0' || regexp_replace(phone_number, '\D', '', 'g')
     WHEN length(regexp_replace(phone_number, '\D', '', 'g')) = 12
          AND regexp_replace(phone_number, '\D', '', 'g') ~ '^90'
       THEN '0' || substring(regexp_replace(phone_number, '\D', '', 'g') from 3)
     ELSE '00000000000'
   END;

ALTER TABLE public."kurbanlık_hesap"
  ALTER COLUMN phone_number SET NOT NULL;

DROP TRIGGER IF EXISTS kurbanlik_hesap_history_ud ON public."kurbanlık_hesap";
DROP TRIGGER IF EXISTS kurbanlik_hesap_history_ins ON public."kurbanlık_hesap";

ALTER TABLE public."kurbanlık_hesap"
  DROP CONSTRAINT IF EXISTS "kurbanlık_hesap_pkey";

ALTER TABLE public."kurbanlık_hesap"
  ADD CONSTRAINT "kurbanlık_hesap_pkey"
  PRIMARY KEY (random_id, number);

ALTER TABLE public.kurbanlik_hesap_history
  ADD COLUMN IF NOT EXISTS random_id text;

CREATE INDEX IF NOT EXISTS kurbanlik_hesap_history_random_id_recorded_at_idx
  ON public.kurbanlik_hesap_history (random_id, recorded_at DESC);

CREATE OR REPLACE FUNCTION public.log_kurbanlik_hesap_history_ud()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO public.kurbanlik_hesap_history (hayvan_number, random_id, snapshot, action)
    VALUES (OLD.number, OLD.random_id, to_jsonb(row_to_json(OLD)), 'update');
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.kurbanlik_hesap_history (hayvan_number, random_id, snapshot, action)
    VALUES (OLD.number, OLD.random_id, to_jsonb(row_to_json(OLD)), 'delete');
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER kurbanlik_hesap_history_ud
  BEFORE UPDATE OR DELETE ON public."kurbanlık_hesap"
  FOR EACH ROW
  EXECUTE FUNCTION public.log_kurbanlik_hesap_history_ud();

CREATE OR REPLACE FUNCTION public.log_kurbanlik_hesap_history_ins()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.kurbanlik_hesap_history (hayvan_number, random_id, snapshot, action)
  VALUES (NEW.number, NEW.random_id, to_jsonb(row_to_json(NEW)), 'create');
  RETURN NEW;
END;
$$;

CREATE TRIGGER kurbanlik_hesap_history_ins
  AFTER INSERT ON public."kurbanlık_hesap"
  FOR EACH ROW
  EXECUTE FUNCTION public.log_kurbanlik_hesap_history_ins();

-- =====================================================================
-- 20260507203000_remove_phone_from_customer_pk.sql
-- =====================================================================
ALTER TABLE public."kurbanlık_hesap"
  DROP CONSTRAINT IF EXISTS "kurbanlık_hesap_pkey";

ALTER TABLE public."kurbanlık_hesap"
  ADD CONSTRAINT "kurbanlık_hesap_pkey"
  PRIMARY KEY (random_id, number);

-- =====================================================================
-- 20260507210000_make_phone_optional.sql
-- =====================================================================
UPDATE public."kurbanlık_hesap"
   SET phone_number = ''
 WHERE phone_number = '00000000000';

ALTER TABLE public."kurbanlık_hesap"
  ALTER COLUMN phone_number DROP NOT NULL;

-- =====================================================================
-- 20260520120000_buyukbas_tables.sql
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.buyukbas_hayvan (
  number text PRIMARY KEY,
  toplam_hisse integer NOT NULL CHECK (toplam_hisse >= 1),
  hayvan_fiyati double precision NOT NULL DEFAULT 0,
  hisse_birim_fiyat double precision NOT NULL DEFAULT 0,
  type text DEFAULT '',
  special text DEFAULT '',
  color_of_earring text DEFAULT '',
  color_of_animal text DEFAULT '',
  spray_paint_color text DEFAULT '',
  from_whom text DEFAULT '',
  group_category text DEFAULT '',
  note text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.buyukbas_hissedar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hayvan_number text NOT NULL REFERENCES public.buyukbas_hayvan (number) ON DELETE CASCADE,
  whose text DEFAULT '',
  phone_number text DEFAULT '',
  alinan_hisse integer NOT NULL CHECK (alinan_hisse >= 1),
  agreed_total double precision NOT NULL DEFAULT 0,
  price double precision NOT NULL DEFAULT 0,
  payment_method text DEFAULT '',
  payment_status text NOT NULL DEFAULT 'Belirsiz',
  address text DEFAULT '',
  note text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS buyukbas_hissedar_hayvan_number_idx
  ON public.buyukbas_hissedar (hayvan_number);

ALTER TABLE public.buyukbas_hayvan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buyukbas_hissedar ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anon buyukbas hayvan okuyabilir" ON public.buyukbas_hayvan;
DROP POLICY IF EXISTS "Anon buyukbas hayvan ekleyebilir" ON public.buyukbas_hayvan;
DROP POLICY IF EXISTS "Anon buyukbas hayvan guncelleyebilir" ON public.buyukbas_hayvan;
DROP POLICY IF EXISTS "Anon buyukbas hayvan silebilir" ON public.buyukbas_hayvan;

CREATE POLICY "Anon buyukbas hayvan okuyabilir"
  ON public.buyukbas_hayvan FOR SELECT TO anon USING (true);

CREATE POLICY "Anon buyukbas hayvan ekleyebilir"
  ON public.buyukbas_hayvan FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Anon buyukbas hayvan guncelleyebilir"
  ON public.buyukbas_hayvan FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Anon buyukbas hayvan silebilir"
  ON public.buyukbas_hayvan FOR DELETE TO anon USING (true);

DROP POLICY IF EXISTS "Anon buyukbas hissedar okuyabilir" ON public.buyukbas_hissedar;
DROP POLICY IF EXISTS "Anon buyukbas hissedar ekleyebilir" ON public.buyukbas_hissedar;
DROP POLICY IF EXISTS "Anon buyukbas hissedar guncelleyebilir" ON public.buyukbas_hissedar;
DROP POLICY IF EXISTS "Anon buyukbas hissedar silebilir" ON public.buyukbas_hissedar;

CREATE POLICY "Anon buyukbas hissedar okuyabilir"
  ON public.buyukbas_hissedar FOR SELECT TO anon USING (true);

CREATE POLICY "Anon buyukbas hissedar ekleyebilir"
  ON public.buyukbas_hissedar FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Anon buyukbas hissedar guncelleyebilir"
  ON public.buyukbas_hissedar FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Anon buyukbas hissedar silebilir"
  ON public.buyukbas_hissedar FOR DELETE TO anon USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.buyukbas_hayvan TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.buyukbas_hissedar TO anon;

-- =====================================================================
-- 20261015120000_add_yearly_seasons.sql
-- Yıllık Sezon (Arşiv) Sistemi
-- =====================================================================

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

CREATE UNIQUE INDEX IF NOT EXISTS sezon_single_default
  ON public.sezon (is_default)
  WHERE is_default = true;

INSERT INTO public.sezon (yil, ad, durum, is_default, notlar)
VALUES (2026, '2026 Kurban Sezonu', 'acik', true, 'Mevcut veriler 2026 sezonuna aktarıldı.')
ON CONFLICT (yil) DO UPDATE SET is_default = EXCLUDED.is_default;

ALTER TABLE public.sezon ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anon sezon okuyabilir" ON public.sezon;
CREATE POLICY "Anon sezon okuyabilir"
  ON public.sezon FOR SELECT TO anon USING (true);

GRANT SELECT ON public.sezon TO anon;

-- KÜÇÜKBAŞ YIL KOLONU
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

-- BÜYÜKBAŞ TABLOLARI
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

ALTER TABLE public.buyukbas_hissedar
  DROP CONSTRAINT IF EXISTS buyukbas_hissedar_hayvan_number_fkey;

ALTER TABLE public.buyukbas_hayvan
  DROP CONSTRAINT IF EXISTS buyukbas_hayvan_pkey CASCADE;

ALTER TABLE public.buyukbas_hayvan
  ADD CONSTRAINT buyukbas_hayvan_pkey PRIMARY KEY (yil, number);

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

-- AUDIT / GEÇMİŞ TABLOSU
ALTER TABLE public.kurbanlik_hesap_history
  ADD COLUMN IF NOT EXISTS yil integer DEFAULT 2026;

UPDATE public.kurbanlik_hesap_history
   SET yil = 2026
 WHERE yil IS NULL;

ALTER TABLE public.kurbanlik_hesap_history
  ALTER COLUMN yil SET NOT NULL;

CREATE INDEX IF NOT EXISTS kurbanlik_hesap_history_yil_hayvan_idx
  ON public.kurbanlik_hesap_history (yil, hayvan_number);

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

-- KAPALI SEZONA YAZMAYI ENGELLEYEN TETİKLEYİCİ
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

