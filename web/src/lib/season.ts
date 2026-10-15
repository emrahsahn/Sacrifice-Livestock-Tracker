import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SEZON_TABLE, type Sezon } from "@/lib/types";

export const SEASON_COOKIE = "ks_year";

export const DEFAULT_FALLBACK_YEAR = 2026;

/**
 * Tüm kayıtlı sezonları yıl azalan sırayla getirir.
 */
export async function getSeasons(supabase: SupabaseClient): Promise<Sezon[]> {
  try {
    const { data, error } = await supabase
      .from(SEZON_TABLE)
      .select("*")
      .order("yil", { ascending: false });

    if (error) {
      // Tablo henüz migrate edilmediyse güvenli fallback
      if (
        error.message.includes("does not exist") ||
        error.message.includes("relation") ||
        error.message.includes("schema cache") ||
        error.message.includes("Could not find")
      ) {
        return [
          {
            yil: DEFAULT_FALLBACK_YEAR,
            ad: `${DEFAULT_FALLBACK_YEAR} Kurban Sezonu`,
            durum: "acik",
            is_default: true,
          },
        ];
      }
      throw new Error(error.message);
    }

    const list = (data ?? []) as Sezon[];
    if (list.length === 0) {
      return [
        {
          yil: DEFAULT_FALLBACK_YEAR,
          ad: `${DEFAULT_FALLBACK_YEAR} Kurban Sezonu`,
          durum: "acik",
          is_default: true,
        },
      ];
    }
    return list;
  } catch (err) {
    console.error("getSeasons hatası:", err);
    return [
      {
        yil: DEFAULT_FALLBACK_YEAR,
        ad: `${DEFAULT_FALLBACK_YEAR} Kurban Sezonu`,
        durum: "acik",
        is_default: true,
      },
    ];
  }
}

/**
 * İstemcinin çerezindeki seçili yılı döner. Çerez yoksa veya geçersizse
 * varsayılan (is_default) veya en güncel sezona düşer.
 */
export async function getSelectedYear(
  supabase: SupabaseClient
): Promise<{ year: number; season: Sezon; allSeasons: Sezon[] }> {
  const allSeasons = await getSeasons(supabase);
  const cookieStore = await cookies();
  const rawCookie = cookieStore.get(SEASON_COOKIE)?.value;
  const cookieYear = rawCookie ? parseInt(rawCookie, 10) : NaN;

  if (Number.isFinite(cookieYear)) {
    const matched = allSeasons.find((s) => s.yil === cookieYear);
    if (matched) {
      return { year: matched.yil, season: matched, allSeasons };
    }
  }

  // Varsayılan sezon
  const defaultSeason = allSeasons.find((s) => s.is_default) ?? allSeasons[0];
  const year = defaultSeason ? defaultSeason.yil : DEFAULT_FALLBACK_YEAR;
  const season = defaultSeason ?? {
    yil: year,
    ad: `${year} Kurban Sezonu`,
    durum: "acik" as const,
    is_default: true,
  };

  return { year, season, allSeasons };
}

/**
 * Belirtilen sezonun yazılabilir (açık) olup olmadığını kontrol eder.
 * Kapalıysa veya sezon bulunamazsa Türkçe hata fırlatır.
 */
export async function assertYearWritable(
  supabase: SupabaseClient,
  yil: number
): Promise<void> {
  const { data, error } = await supabase
    .from(SEZON_TABLE)
    .select("yil, durum")
    .eq("yil", yil)
    .maybeSingle();

  if (error) {
    if (error.message.includes("does not exist")) return;
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error(`${yil} sezonu bulunamadı.`);
  }

  if (data.durum === "kapali") {
    throw new Error(
      `İşlem gerçekleştirilemez: ${yil} sezonu kapatılmıştır (salt-okunur).`
    );
  }
}
