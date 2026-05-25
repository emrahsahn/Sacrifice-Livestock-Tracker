-- Büyükbaş hayvan ve hissedar tabloları (küçükbaş kurbanlık_hesap tablosundan bağımsız).

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

-- buyukbas_hayvan policies
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

-- buyukbas_hissedar policies
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
