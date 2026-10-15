import type { SupabaseClient } from "@supabase/supabase-js";
import {
  BUYUKBAS_TABLE,
  TABLE,
  type CustomerKey,
} from "@/lib/types";
import { animalNumbersInclude, parseAnimalNumbers } from "@/lib/utils";

export type AnimalNumberSource = "kucukbas" | "buyukbas";

export interface AssertExcludeKucukbas {
  source: "kucukbas";
  random_id: string;
  number: string;
  yil?: number;
}

export interface AssertExcludeBuyukbas {
  source: "buyukbas";
  number: string;
  yil?: number;
}

/**
 * Küçükbaş ↔ büyükbaş arasında hayvan numarası çakışması kontrolü.
 * Çakışma kontrolü aynı yıl içinde yapılır.
 * @returns null = uygun; string = Türkçe hata mesajı
 */
export async function assertNumbersAvailable(
  supabase: SupabaseClient,
  tokens: string[],
  source: AnimalNumberSource,
  exclude?: AssertExcludeKucukbas | AssertExcludeBuyukbas,
  yil?: number
): Promise<string | null> {
  const unique = [...new Set(tokens.map((t) => t.trim()).filter(Boolean))];
  if (unique.length === 0) return "Geçerli bir hayvan numarası girin.";

  const targetYil = yil ?? exclude?.yil;

  if (source === "kucukbas") {
    let query = supabase
      .from(BUYUKBAS_TABLE)
      .select("number")
      .in("number", unique);

    if (targetYil !== undefined) {
      query = query.eq("yil", targetYil);
    }

    const { data, error } = await query;
    if (error) return error.message;
    const conflicts = (data ?? []).map((r) => r.number as string);
    if (conflicts.length > 0) {
      const yilMetni = targetYil ? ` (${targetYil} sezonu)` : "";
      return `${conflicts.join(", ")} numarası büyükbaşta kayıtlı${yilMetni}; küçükbaşta kullanılamaz.`;
    }
    return null;
  }

  // buyukbas: tek token beklenir; her biri küçükbaşta var mı?
  let kbQuery = supabase.from(TABLE).select("number, random_id, yil");
  if (targetYil !== undefined) {
    kbQuery = kbQuery.eq("yil", targetYil);
  }
  const { data: kucukRows, error: kErr } = await kbQuery;
  if (kErr) return kErr.message;

  for (const token of unique) {
    if (
      exclude?.source === "buyukbas" &&
      exclude.number === token &&
      (targetYil === undefined || exclude.yil === undefined || exclude.yil === targetYil)
    ) {
      continue;
    }

    const hit = (kucukRows ?? []).some((row) => {
      if (
        exclude?.source === "kucukbas" &&
        row.random_id === exclude.random_id
      ) {
        return false;
      }
      return animalNumbersInclude(row.number as string, token);
    });

    if (hit) {
      const yilMetni = targetYil ? ` (${targetYil} sezonu)` : "";
      return `${token} numarası küçükbaşta kayıtlı${yilMetni}; büyükbaşta kullanılamaz.`;
    }
  }
  return null;
}

/** Küçükbaş number alanı güncellenirken mevcut kaydı hariç tut. */
export function tokensFromKucukbasNumber(raw: string): string[] {
  return parseAnimalNumbers(raw);
}

export function excludeForKucukbasUpdate(key: CustomerKey): AssertExcludeKucukbas {
  return {
    source: "kucukbas",
    random_id: key.random_id,
    number: key.number,
    yil: key.yil,
  };
}
