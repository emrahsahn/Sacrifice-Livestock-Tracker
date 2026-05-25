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
}

export interface AssertExcludeBuyukbas {
  source: "buyukbas";
  number: string;
}

/**
 * Küçükbaş ↔ büyükbaş arasında hayvan numarası çakışması kontrolü.
 * @returns null = uygun; string = Türkçe hata mesajı
 */
export async function assertNumbersAvailable(
  supabase: SupabaseClient,
  tokens: string[],
  source: AnimalNumberSource,
  exclude?: AssertExcludeKucukbas | AssertExcludeBuyukbas
): Promise<string | null> {
  const unique = [...new Set(tokens.map((t) => t.trim()).filter(Boolean))];
  if (unique.length === 0) return "Geçerli bir hayvan numarası girin.";

  if (source === "kucukbas") {
    const { data, error } = await supabase
      .from(BUYUKBAS_TABLE)
      .select("number")
      .in("number", unique);
    if (error) return error.message;
    const conflicts = (data ?? []).map((r) => r.number as string);
    if (conflicts.length > 0) {
      return `${conflicts.join(", ")} numarası büyükbaşta kayıtlı; küçükbaşta kullanılamaz.`;
    }
    return null;
  }

  // buyukbas: tek token beklenir; her biri küçükbaşta var mı?
  const { data: kucukRows, error: kErr } = await supabase.from(TABLE).select("number");
  if (kErr) return kErr.message;

  for (const token of unique) {
    if (exclude?.source === "buyukbas" && exclude.number === token) continue;

    const hit = (kucukRows ?? []).some((row) =>
      animalNumbersInclude(row.number as string, token)
    );
    if (hit) {
      return `${token} numarası küçükbaşta kayıtlı; büyükbaşta kullanılamaz.`;
    }
  }
  return null;
}

/** Küçükbaş number alanı güncellenirken mevcut kaydı hariç tut. */
export function tokensFromKucukbasNumber(raw: string): string[] {
  return parseAnimalNumbers(raw);
}

export function excludeForKucukbasUpdate(key: CustomerKey): AssertExcludeKucukbas {
  return { source: "kucukbas", random_id: key.random_id, number: key.number };
}
