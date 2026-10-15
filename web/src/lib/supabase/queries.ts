import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BuyukbasHayvan,
  BuyukbasHayvanWithHissedarlar,
  BuyukbasHissedar,
  Customer,
  CustomerKey,
  HistoryEntry,
} from "@/lib/types";
import { BUYUKBAS_HISSEDAR_TABLE, BUYUKBAS_TABLE, HISTORY_TABLE, TABLE } from "@/lib/types";
import {
  animalNumbersInclude,
  compareHayvanNumarasi,
  countAnimals,
  normalizePhone,
} from "@/lib/utils";

export async function getCustomers(
  supabase: SupabaseClient,
  yil?: number
): Promise<Customer[]> {
  let query = supabase.from(TABLE).select("*");
  if (yil !== undefined) {
    query = query.eq("yil", yil);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Customer[];
  rows.sort((x, y) => compareHayvanNumarasi(x.number, y.number));
  return rows;
}

/**
 * Composite key (random_id + number, opsiyonel yil) ile tek bir kaydı getirir.
 */
export async function getCustomerByCompositeKey(
  supabase: SupabaseClient,
  key: CustomerKey
): Promise<Customer | null> {
  let query = supabase
    .from(TABLE)
    .select("*")
    .eq("random_id", key.random_id)
    .eq("number", key.number);

  if (key.yil !== undefined) {
    query = query.eq("yil", key.yil);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  return data as Customer | null;
}

/**
 * Hayvan numarasıyla arama: virgülle ayrılmış string içinde tam token eşleşmesi.
 * Örn. "101" → "101, 102" eşleşir; "10" → "101, 102" eşleşmez.
 */
export async function searchByNumber(
  supabase: SupabaseClient,
  number: string,
  yil?: number
): Promise<Customer[]> {
  const tokens = number
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (tokens.length === 0) return [];

  let query = supabase
    .from(TABLE)
    .select("*")
    .ilike("number", `%${tokens[0]}%`);

  if (yil !== undefined) {
    query = query.eq("yil", yil);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Customer[];
  return rows.filter((c) => tokens.some((t) => animalNumbersInclude(c.number, t)));
}

export async function getCustomerHistory(
  supabase: SupabaseClient,
  hayvanNumber: string,
  randomId?: string | null,
  yil?: number
): Promise<HistoryEntry[]> {
  if (randomId) {
    let query = supabase
      .from(HISTORY_TABLE)
      .select("id, hayvan_number, random_id, yil, snapshot, recorded_at, action")
      .eq("random_id", randomId);

    if (yil !== undefined) {
      query = query.eq("yil", yil);
    }

    const { data, error } = await query.order("recorded_at", { ascending: false });
    if (!error) return (data ?? []) as HistoryEntry[];
    if (!isMissingHistoryTableError(error.message) && !isMissingRandomIdError(error.message)) {
      throw new Error(error.message);
    }
    if (isMissingHistoryTableError(error.message)) return [];
  }

  let fallbackQuery = supabase
    .from(HISTORY_TABLE)
    .select("id, hayvan_number, random_id, yil, snapshot, recorded_at, action")
    .eq("hayvan_number", hayvanNumber);

  if (yil !== undefined) {
    fallbackQuery = fallbackQuery.eq("yil", yil);
  }

  const { data, error } = await fallbackQuery.order("recorded_at", { ascending: false });
  if (error) {
    if (isMissingHistoryTableError(error.message)) return [];
    throw new Error(error.message);
  }
  return (data ?? []) as HistoryEntry[];
}

export async function searchByOwner(
  supabase: SupabaseClient,
  whose: string,
  yil?: number
): Promise<Customer[]> {
  let query = supabase
    .from(TABLE)
    .select("*")
    .ilike("whose", `%${whose}%`);

  if (yil !== undefined) {
    query = query.eq("yil", yil);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Customer[];
}

export async function searchByNumberAndOwner(
  supabase: SupabaseClient,
  number: string,
  whose: string,
  yil?: number
): Promise<Customer[]> {
  const byNum = await searchByNumber(supabase, number, yil);
  const w = whose.trim().toLocaleLowerCase("tr-TR");
  return byNum.filter((c) =>
    String(c.whose ?? "").toLocaleLowerCase("tr-TR").includes(w)
  );
}

export async function searchByType(
  supabase: SupabaseClient,
  kind: string,
  yil?: number
): Promise<Customer[]> {
  let query = supabase
    .from(TABLE)
    .select("*")
    .ilike("type", `%${kind}%`);

  if (yil !== undefined) {
    query = query.eq("yil", yil);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Customer[];
}

export async function searchByPhone(
  supabase: SupabaseClient,
  phone: string,
  yil?: number
): Promise<Customer[]> {
  const normalized = normalizePhone(phone);
  const target = normalized || String(phone ?? "").replace(/\D/g, "");
  if (!target) return [];

  let query = supabase
    .from(TABLE)
    .select("*")
    .ilike("phone_number", `%${target}%`);

  if (yil !== undefined) {
    query = query.eq("yil", yil);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Customer[];
}

function isMissingAgreedTotalError(message: string): boolean {
  return /agreed_total/i.test(message) && /does not exist|column/i.test(message);
}

function isMissingRandomIdError(message: string): boolean {
  return /random_id/i.test(message) && /does not exist|column/i.test(message);
}

function isMissingHistoryTableError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("kurbanlik_hesap_history") &&
    (m.includes("could not find") ||
      m.includes("schema cache") ||
      m.includes("does not exist") ||
      /relation.*does not exist/i.test(m))
  );
}

export async function getStats(supabase: SupabaseClient, yil?: number) {
  let rows: Array<{
    price?: unknown;
    payment_status?: unknown;
    agreed_total?: unknown;
    number?: unknown;
  }>;
  let count: number | null;

  let fullQuery = supabase
    .from(TABLE)
    .select("price, payment_status, agreed_total, number", { count: "exact" });

  if (yil !== undefined) {
    fullQuery = fullQuery.eq("yil", yil);
  }

  const full = await fullQuery;

  if (full.error && isMissingAgreedTotalError(full.error.message)) {
    let legacyQuery = supabase
      .from(TABLE)
      .select("price, payment_status, number", { count: "exact" });
    if (yil !== undefined) {
      legacyQuery = legacyQuery.eq("yil", yil);
    }
    const legacy = await legacyQuery;
    if (legacy.error) throw new Error(legacy.error.message);
    rows = legacy.data ?? [];
    count = legacy.count ?? null;
    const sumPriceAll = rows.reduce((sum, r) => sum + Number(r.price ?? 0), 0);
    const unpaidRows = rows.filter((r) => r.payment_status !== "Ödendi");
    const unpaidTotal = unpaidRows.reduce((sum, r) => sum + Number(r.price ?? 0), 0);
    const collectedTotal = Math.max(0, sumPriceAll - unpaidTotal);
    const animalCount = rows.reduce((sum, r) => sum + countAnimals(String(r.number ?? "")), 0);
    return {
      count: count ?? 0,
      animalCount,
      total: sumPriceAll,
      unpaidTotal,
      unpaidCount: unpaidRows.length,
      collectedTotal,
    };
  }

  if (full.error) throw new Error(full.error.message);

  rows = full.data ?? [];
  count = full.count ?? null;

  const agreedOf = (r: { agreed_total?: unknown; price?: unknown }) =>
    Number(r.agreed_total ?? r.price ?? 0);
  const total = rows.reduce((sum, r) => sum + agreedOf(r), 0);
  const unpaidRows = rows.filter((r) => r.payment_status !== "Ödendi");
  const unpaidTotal = unpaidRows.reduce((sum, r) => sum + Number(r.price ?? 0), 0);
  const collectedTotal = Math.max(0, total - unpaidTotal);
  /** Toplam hayvan sayısı: her kayıttaki virgülle ayrılmış numaraların toplamı. */
  const animalCount = rows.reduce((sum, r) => sum + countAnimals(String(r.number ?? "")), 0);

  return {
    count: count ?? 0,
    animalCount,
    total,
    unpaidTotal,
    unpaidCount: unpaidRows.length,
    collectedTotal,
  };
}

export async function getGroupStats(supabase: SupabaseClient, yil?: number) {
  let query = supabase.from(TABLE).select("group_category, price, number");
  if (yil !== undefined) {
    query = query.eq("yil", yil);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const groupMap: Record<string, { count: number; animalCount: number; total: number }> = {};

  for (const row of rows) {
    const key = (row.group_category as string) || "__grupsuz__";
    if (!groupMap[key]) groupMap[key] = { count: 0, animalCount: 0, total: 0 };
    groupMap[key].count += 1;
    groupMap[key].animalCount += countAnimals(String(row.number ?? ""));
    groupMap[key].total += Number(row.price ?? 0);
  }

  return groupMap;
}

// ─── Büyükbaş ─────────────────────────────────────────────────────────────────

export async function getBuyukbasHayvanlar(
  supabase: SupabaseClient,
  yil?: number
): Promise<BuyukbasHayvanWithHissedarlar[]> {
  let hQuery = supabase.from(BUYUKBAS_TABLE).select("*");
  if (yil !== undefined) {
    hQuery = hQuery.eq("yil", yil);
  }
  const { data: hayvanlar, error: hErr } = await hQuery;
  if (hErr) throw new Error(hErr.message);

  let hsQuery = supabase.from(BUYUKBAS_HISSEDAR_TABLE).select("*");
  if (yil !== undefined) {
    hsQuery = hsQuery.eq("yil", yil);
  }
  const { data: hissedarlar, error: hsErr } = await hsQuery;
  if (hsErr) throw new Error(hsErr.message);

  const byHayvan = new Map<string, BuyukbasHissedar[]>();
  for (const h of (hissedarlar ?? []) as BuyukbasHissedar[]) {
    const key = `${h.yil ?? ""}_${h.hayvan_number}`;
    const list = byHayvan.get(key) ?? [];
    list.push(h);
    byHayvan.set(key, list);
  }

  const rows = (hayvanlar ?? []) as BuyukbasHayvan[];
  rows.sort((a, b) => compareHayvanNumarasi(a.number, b.number));

  return rows.map((hayvan) => {
    const key = `${hayvan.yil ?? ""}_${hayvan.number}`;
    return {
      ...hayvan,
      hissedarlar: byHayvan.get(key) ?? [],
    };
  });
}

export async function getBuyukbasHayvanWithHissedarlar(
  supabase: SupabaseClient,
  number: string,
  yil?: number
): Promise<BuyukbasHayvanWithHissedarlar | null> {
  const token = number.trim();
  let query = supabase.from(BUYUKBAS_TABLE).select("*").eq("number", token);
  if (yil !== undefined) {
    query = query.eq("yil", yil);
  }
  const { data: hayvan, error: hErr } = await query.maybeSingle();
  if (hErr) throw new Error(hErr.message);
  if (!hayvan) return null;

  let hsQuery = supabase
    .from(BUYUKBAS_HISSEDAR_TABLE)
    .select("*")
    .eq("hayvan_number", token);

  const actualYil = yil ?? (hayvan as BuyukbasHayvan).yil;
  if (actualYil !== undefined) {
    hsQuery = hsQuery.eq("yil", actualYil);
  }

  const { data: hissedarlar, error: hsErr } = await hsQuery;
  if (hsErr) throw new Error(hsErr.message);

  return {
    ...(hayvan as BuyukbasHayvan),
    hissedarlar: (hissedarlar ?? []) as BuyukbasHissedar[],
  };
}

export async function searchBuyukbasByNumber(
  supabase: SupabaseClient,
  number: string,
  yil?: number
): Promise<BuyukbasHayvanWithHissedarlar[]> {
  const token = number.trim();
  if (!token) return [];
  const hayvan = await getBuyukbasHayvanWithHissedarlar(supabase, token, yil);
  return hayvan ? [hayvan] : [];
}

export async function searchBuyukbasByOwner(
  supabase: SupabaseClient,
  whose: string,
  yil?: number
): Promise<BuyukbasHayvanWithHissedarlar[]> {
  const w = whose.trim().toLocaleLowerCase("tr-TR");
  if (!w) return [];
  const all = await getBuyukbasHayvanlar(supabase, yil);
  return all.filter((h) =>
    h.hissedarlar.some((hs) =>
      String(hs.whose ?? "").toLocaleLowerCase("tr-TR").includes(w)
    )
  );
}

export async function searchBuyukbasByPhone(
  supabase: SupabaseClient,
  phone: string,
  yil?: number
): Promise<BuyukbasHayvanWithHissedarlar[]> {
  const normalized = normalizePhone(phone);
  const target = normalized || String(phone ?? "").replace(/\D/g, "");
  if (!target) return [];

  let query = supabase
    .from(BUYUKBAS_HISSEDAR_TABLE)
    .select("hayvan_number, yil")
    .ilike("phone_number", `%${target}%`);

  if (yil !== undefined) {
    query = query.eq("yil", yil);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  // Benzersiz (hayvan_number, yil) çiftlerini bul
  const uniqueItems = new Map<string, { num: string; y?: number }>();
  for (const r of data ?? []) {
    const key = `${r.yil ?? ""}_${r.hayvan_number}`;
    if (!uniqueItems.has(key)) {
      uniqueItems.set(key, { num: r.hayvan_number as string, y: r.yil as number | undefined });
    }
  }

  const results: BuyukbasHayvanWithHissedarlar[] = [];
  for (const item of uniqueItems.values()) {
    const h = await getBuyukbasHayvanWithHissedarlar(supabase, item.num, item.y ?? yil);
    if (h) results.push(h);
  }
  return results;
}

export async function getBuyukbasStats(supabase: SupabaseClient, yil?: number) {
  const all = await getBuyukbasHayvanlar(supabase, yil);
  let totalHisse = 0;
  let soldHisse = 0;
  let totalHayvanFiyati = 0;
  let unpaidTotal = 0;
  let unpaidCount = 0;

  for (const h of all) {
    totalHisse += Number(h.toplam_hisse ?? 0);
    totalHayvanFiyati += Number(h.hayvan_fiyati ?? 0);
    for (const hs of h.hissedarlar) {
      soldHisse += Number(hs.alinan_hisse ?? 0);
      if (hs.payment_status !== "Ödendi") {
        unpaidTotal += Number(hs.price ?? 0);
        unpaidCount += 1;
      }
    }
  }

  return {
    animalCount: all.length,
    totalHisse,
    soldHisse,
    freeHisse: Math.max(0, totalHisse - soldHisse),
    totalHayvanFiyati,
    unpaidTotal,
    unpaidCount,
    collectedTotal: Math.max(0, totalHayvanFiyati - unpaidTotal),
  };
}

export async function getBuyukbasGroupStats(supabase: SupabaseClient, yil?: number) {
  const all = await getBuyukbasHayvanlar(supabase, yil);
  const groupMap: Record<string, { count: number; animalCount: number; total: number }> = {};

  for (const h of all) {
    const key = h.group_category || "__grupsuz__";
    if (!groupMap[key]) groupMap[key] = { count: 0, animalCount: 0, total: 0 };
    groupMap[key].animalCount += 1;
    groupMap[key].count += h.hissedarlar.length;
    groupMap[key].total += Number(h.hayvan_fiyati ?? 0);
  }

  return groupMap;
}
