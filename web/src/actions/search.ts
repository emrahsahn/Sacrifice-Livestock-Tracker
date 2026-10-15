"use server";

import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/require-session";
import {
  getCustomerByCompositeKey,
  getCustomerHistory,
  searchByNumber,
  searchByNumberAndOwner,
  searchByOwner,
  searchByPhone,
  searchByType,
  searchBuyukbasByNumber,
  searchBuyukbasByOwner,
  searchBuyukbasByPhone,
} from "@/lib/supabase/queries";
import type {
  BuyukbasHayvanWithHissedarlar,
  Customer,
  CustomerKey,
  HistoryEntry,
} from "@/lib/types";
import { getSelectedYear } from "@/lib/season";

export type SearchQueryType =
  | "numara"
  | "sahip"
  | "numara_sahip"
  | "tur"
  | "telefon";

export async function runCustomerSearch(
  qType: SearchQueryType,
  params: {
    num?: string;
    owner?: string;
    kind?: string;
    phone?: string;
  },
  targetYil?: number
): Promise<
  | { customers: Customer[]; buyukbas: BuyukbasHayvanWithHissedarlar[]; year: number }
  | { error: string }
> {
  await requireSession();
  const supabase = await createClient();

  const { year: activeYear } = await getSelectedYear(supabase);
  const yil = targetYil ?? activeYear;

  try {
    let customers: Customer[] = [];
    let buyukbas: BuyukbasHayvanWithHissedarlar[] = [];

    if (qType === "numara") {
      const num = params.num?.trim() ?? "";
      if (!num) return { error: "Hayvan numarasını girin." };
      [customers, buyukbas] = await Promise.all([
        searchByNumber(supabase, num, yil),
        searchBuyukbasByNumber(supabase, num, yil),
      ]);
    } else if (qType === "sahip") {
      const owner = params.owner?.trim() ?? "";
      if (!owner) return { error: "Sahip adını girin." };
      [customers, buyukbas] = await Promise.all([
        searchByOwner(supabase, owner, yil),
        searchBuyukbasByOwner(supabase, owner, yil),
      ]);
    } else if (qType === "numara_sahip") {
      const num = params.num?.trim() ?? "";
      const owner = params.owner?.trim() ?? "";
      if (!num || !owner) return { error: "Her iki alanı da doldurun." };
      customers = await searchByNumberAndOwner(supabase, num, owner, yil);
      const bAll = await searchBuyukbasByOwner(supabase, owner, yil);
      buyukbas = bAll.filter((h) => h.number === num);
    } else if (qType === "tur") {
      const kind = params.kind?.trim() ?? "";
      if (!kind) return { error: "Hayvan türünü girin." };
      customers = await searchByType(supabase, kind, yil);
    } else if (qType === "telefon") {
      const clean = (params.phone ?? "").replace(/[\s\-]/g, "");
      const normalized =
        clean.length === 10 && !clean.startsWith("0") ? "0" + clean : clean;
      if (!/^\d{11}$/.test(normalized)) {
        return {
          error: "Geçerli bir telefon numarası girin. Örn: 0532 123 45 67",
        };
      }
      [customers, buyukbas] = await Promise.all([
        searchByPhone(supabase, normalized, yil),
        searchBuyukbasByPhone(supabase, normalized, yil),
      ]);
    }

    return { customers, buyukbas, year: yil };
  } catch (e: unknown) {
    return {
      error: e instanceof Error ? e.message : "Arama sırasında hata oluştu.",
    };
  }
}

/** Güncelle / sil sayfaları: hayvan numarasıyla önizleme araması. */
export async function searchByNumberPreview(
  number: string,
  targetYil?: number
): Promise<
  | {
      customers: Customer[];
      buyukbas: BuyukbasHayvanWithHissedarlar[];
      year: number;
    }
  | { error: string }
> {
  await requireSession();
  const token = number.trim();
  if (!token) return { error: "Hayvan numarası girin." };

  try {
    const supabase = await createClient();
    const { year: activeYear } = await getSelectedYear(supabase);
    const yil = targetYil ?? activeYear;

    const [customers, buyukbas] = await Promise.all([
      searchByNumber(supabase, token, yil),
      searchBuyukbasByNumber(supabase, token, yil),
    ]);
    return { customers, buyukbas, year: yil };
  } catch (e: unknown) {
    return {
      error: e instanceof Error ? e.message : "Arama sırasında hata oluştu.",
    };
  }
}

export async function fetchCustomerByKey(
  key: CustomerKey
): Promise<Customer | null> {
  await requireSession();
  const supabase = await createClient();
  return getCustomerByCompositeKey(supabase, key);
}

export async function fetchCustomerHistory(
  hayvanNumber: string,
  randomId?: string | null,
  targetYil?: number
): Promise<HistoryEntry[] | { error: string }> {
  await requireSession();
  try {
    const supabase = await createClient();
    return await getCustomerHistory(supabase, hayvanNumber, randomId ?? null, targetYil);
  } catch (e: unknown) {
    return {
      error: e instanceof Error ? e.message : "Geçmiş yüklenemedi.",
    };
  }
}
