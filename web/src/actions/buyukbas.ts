"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/require-session";
import { assertNumbersAvailable } from "@/lib/animal-number-check";
import { parseMoneyTR } from "@/lib/input-format";
import { buyukbasHayvanCreateSchema } from "@/lib/validations";
import {
  BUYUKBAS_HISSEDAR_TABLE,
  BUYUKBAS_TABLE,
  type PaymentStatus,
} from "@/lib/types";
import { computeHisseBirimFiyat } from "@/lib/buyukbas-utils";
import { normalizePhone } from "@/lib/utils";
import { assertYearWritable, getSelectedYear } from "@/lib/season";

const TL = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function revalidateBuyukbas() {
  revalidatePath("/musteriler");
  revalidatePath("/guncelle");
  revalidatePath("/sil");
  revalidatePath("/istatistikler");
  revalidatePath("/sorgula");
  revalidatePath("/ekle");
  revalidatePath("/sezonlar");
  revalidatePath("/analiz");
  revalidatePath("/");
}

async function getUsedShares(
  supabase: Awaited<ReturnType<typeof createClient>>,
  hayvanNumber: string,
  excludeHissedarId?: string,
  yil?: number
): Promise<number> {
  let query = supabase
    .from(BUYUKBAS_HISSEDAR_TABLE)
    .select("id, alinan_hisse, yil")
    .eq("hayvan_number", hayvanNumber);

  if (yil !== undefined) {
    query = query.eq("yil", yil);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? [])
    .filter((r) => r.id !== excludeHissedarId)
    .reduce((s, r) => s + Number(r.alinan_hisse ?? 0), 0);
}

export async function createBuyukbasHayvan(formData: unknown, targetYil?: number) {
  await requireSession();
  const parsed = buyukbasHayvanCreateSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  const data = parsed.data;
  const supabase = await createClient();

  const { year: activeYear } = await getSelectedYear(supabase);
  const yil = targetYil ?? activeYear;

  try {
    await assertYearWritable(supabase, yil);
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Sezon kapalı." };
  }

  const conflict = await assertNumbersAvailable(supabase, [data.number], "buyukbas", undefined, yil);
  if (conflict) return { error: conflict };

  const usedShares = data.hissedarlar.reduce((s, h) => s + h.alinan_hisse, 0);
  if (usedShares > data.toplam_hisse) {
    return {
      error: `Toplam hisse ${data.toplam_hisse}; girilen hissedar payları toplamı ${usedShares}.`,
    };
  }

  const birim = computeHisseBirimFiyat(data.hayvan_fiyati, data.toplam_hisse);

  const { error: hayvanErr } = await supabase.from(BUYUKBAS_TABLE).insert({
    yil,
    number: data.number,
    toplam_hisse: data.toplam_hisse,
    hayvan_fiyati: data.hayvan_fiyati,
    hisse_birim_fiyat: birim,
    type: data.type,
    special: data.special,
    color_of_earring: data.color_of_earring,
    color_of_animal: data.color_of_animal,
    spray_paint_color: data.spray_paint_color,
    from_whom: data.from_whom,
    group_category: data.group_category,
    note: data.note,
  });

  if (hayvanErr) {
    if (/duplicate key|unique constraint|23505/i.test(hayvanErr.message)) {
      return { error: `Hayvan numarası ${data.number} bu sezonda zaten kayıtlı.` };
    }
    return { error: hayvanErr.message };
  }

  const hissedarRows = data.hissedarlar.map((h) => {
    const agreed = Math.round(h.alinan_hisse * birim * 100) / 100;
    const price = typeof h.price === "number" && h.price > 0 ? h.price : agreed;
    return {
      yil,
      hayvan_number: data.number,
      whose: h.whose,
      phone_number: normalizePhone(h.phone_number),
      alinan_hisse: h.alinan_hisse,
      agreed_total: agreed,
      price,
      payment_method: h.payment_method,
      payment_status: h.payment_status,
      address: h.address,
      note: h.note,
    };
  });

  const { error: hissErr } = await supabase.from(BUYUKBAS_HISSEDAR_TABLE).insert(hissedarRows);
  if (hissErr) {
    await supabase
      .from(BUYUKBAS_TABLE)
      .delete()
      .eq("number", data.number)
      .eq("yil", yil);
    return { error: hissErr.message };
  }

  revalidateBuyukbas();
  return { success: true };
}

export async function addBuyukbasHissedar(
  hayvanNumber: string,
  hissedar: {
    whose?: string;
    phone_number?: string;
    alinan_hisse: number;
    price?: number;
    payment_method?: string;
    payment_status?: PaymentStatus;
    address?: string;
    note?: string;
  },
  targetYil?: number
) {
  await requireSession();
  const supabase = await createClient();

  let findQuery = supabase
    .from(BUYUKBAS_TABLE)
    .select("toplam_hisse, hisse_birim_fiyat, yil")
    .eq("number", hayvanNumber);

  if (targetYil !== undefined) {
    findQuery = findQuery.eq("yil", targetYil);
  }

  const { data: hayvan, error: hErr } = await findQuery.maybeSingle();
  if (hErr) return { error: hErr.message };
  if (!hayvan) return { error: "Hayvan bulunamadı." };

  const yil = targetYil ?? hayvan.yil;
  if (yil !== undefined) {
    try {
      await assertYearWritable(supabase, yil);
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : "Sezon kapalı." };
    }
  }

  const used = await getUsedShares(supabase, hayvanNumber, undefined, yil);
  if (used + hissedar.alinan_hisse > Number(hayvan.toplam_hisse)) {
    return {
      error: `Kalan hisse: ${Number(hayvan.toplam_hisse) - used}. ${hissedar.alinan_hisse} hisse eklenemez.`,
    };
  }

  const birim = Number(hayvan.hisse_birim_fiyat ?? 0);
  const agreed = Math.round(hissedar.alinan_hisse * birim * 100) / 100;
  const price = hissedar.price ?? agreed;

  const { error } = await supabase.from(BUYUKBAS_HISSEDAR_TABLE).insert({
    yil: yil ?? 2026,
    hayvan_number: hayvanNumber,
    whose: hissedar.whose ?? "",
    phone_number: normalizePhone(hissedar.phone_number ?? ""),
    alinan_hisse: hissedar.alinan_hisse,
    agreed_total: agreed,
    price,
    payment_method: hissedar.payment_method ?? "",
    payment_status: hissedar.payment_status ?? "Belirsiz",
    address: hissedar.address ?? "",
    note: hissedar.note ?? "",
  });

  if (error) return { error: error.message };
  revalidateBuyukbas();
  return { success: true };
}

export async function updateBuyukbasHayvan(
  number: string,
  patch: Record<string, unknown>,
  targetYil?: number
) {
  await requireSession();
  const supabase = await createClient();
  const newNumber = typeof patch.number === "string" ? patch.number.trim() : number;

  let query = supabase.from(BUYUKBAS_TABLE).select("*").eq("number", number);
  if (targetYil !== undefined) {
    query = query.eq("yil", targetYil);
  }

  const { data: existing, error: exErr } = await query.maybeSingle();
  if (exErr) return { error: exErr.message };
  if (!existing) return { error: "Hayvan bulunamadı." };

  const yil = targetYil ?? existing.yil;
  if (yil !== undefined) {
    try {
      await assertYearWritable(supabase, yil);
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : "Sezon kapalı." };
    }
  }

  if (newNumber !== number) {
    const conflict = await assertNumbersAvailable(supabase, [newNumber], "buyukbas", {
      source: "buyukbas",
      number,
      yil,
    }, yil);
    if (conflict) return { error: conflict };
  }

  const toplamHisse =
    patch.toplam_hisse !== undefined
      ? Number(patch.toplam_hisse)
      : Number(existing.toplam_hisse);
  const hayvanFiyati =
    patch.hayvan_fiyati !== undefined
      ? Number(patch.hayvan_fiyati)
      : Number(existing.hayvan_fiyati);

  if (!Number.isFinite(toplamHisse) || toplamHisse < 1) {
    return { error: "Toplam hisse en az 1 olmalıdır." };
  }

  const used = await getUsedShares(supabase, number, undefined, yil);
  if (used > toplamHisse) {
    return {
      error: `Toplam hisse ${toplamHisse} olamaz; mevcut hissedar payları ${used}.`,
    };
  }

  const birim = computeHisseBirimFiyat(hayvanFiyati, toplamHisse);

  const hayvanPatch: Record<string, unknown> = {
    ...patch,
    number: newNumber,
    toplam_hisse: toplamHisse,
    hayvan_fiyati: hayvanFiyati,
    hisse_birim_fiyat: birim,
  };

  let upQuery = supabase
    .from(BUYUKBAS_TABLE)
    .update(hayvanPatch)
    .eq("number", number);

  if (yil !== undefined) {
    upQuery = upQuery.eq("yil", yil);
  }

  const { error: upErr } = await upQuery;
  if (upErr) return { error: upErr.message };

  let hissQuery = supabase
    .from(BUYUKBAS_HISSEDAR_TABLE)
    .select("id, alinan_hisse, price, payment_status, agreed_total")
    .eq("hayvan_number", newNumber);

  if (yil !== undefined) {
    hissQuery = hissQuery.eq("yil", yil);
  }

  const { data: hissedarlar, error: hErr } = await hissQuery;
  if (hErr) return { error: hErr.message };

  for (const h of hissedarlar ?? []) {
    const agreed = Math.round(Number(h.alinan_hisse) * birim * 100) / 100;
    const prevPrice = Number(h.price ?? 0);
    const prevAgreed = Number((h as { agreed_total?: number }).agreed_total ?? agreed);
    let nextPrice = prevPrice;
    if (h.payment_status === "Ödendi") {
      nextPrice = 0;
    } else if (prevAgreed > 0 && prevPrice <= prevAgreed) {
      const paid = prevAgreed - prevPrice;
      nextPrice = Math.max(0, Math.round((agreed - paid) * 100) / 100);
    } else {
      nextPrice = agreed;
    }
    await supabase
      .from(BUYUKBAS_HISSEDAR_TABLE)
      .update({ agreed_total: agreed, price: nextPrice })
      .eq("id", h.id);
  }

  revalidateBuyukbas();
  return { success: true };
}

export async function updateBuyukbasHissedar(
  id: string,
  patch: Record<string, unknown>
) {
  await requireSession();
  const supabase = await createClient();
  const { data: row, error: rErr } = await supabase
    .from(BUYUKBAS_HISSEDAR_TABLE)
    .select("hayvan_number, alinan_hisse, yil")
    .eq("id", id)
    .maybeSingle();
  if (rErr) return { error: rErr.message };
  if (!row) return { error: "Hissedar bulunamadı." };

  if (row.yil !== undefined) {
    try {
      await assertYearWritable(supabase, row.yil);
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : "Sezon kapalı." };
    }
  }

  const finalPatch = { ...patch };
  if (typeof finalPatch.phone_number === "string") {
    finalPatch.phone_number = normalizePhone(finalPatch.phone_number);
  }

  if (finalPatch.alinan_hisse !== undefined) {
    const newShares = Number(finalPatch.alinan_hisse);
    const used = await getUsedShares(supabase, row.hayvan_number, id, row.yil);
    let hayvanQuery = supabase
      .from(BUYUKBAS_TABLE)
      .select("toplam_hisse, hisse_birim_fiyat")
      .eq("number", row.hayvan_number);
    if (row.yil !== undefined) {
      hayvanQuery = hayvanQuery.eq("yil", row.yil);
    }
    const { data: hayvan } = await hayvanQuery.maybeSingle();
    const limit = Number(hayvan?.toplam_hisse ?? 0);
    if (used + newShares > limit) {
      return { error: `Kalan hisse: ${limit - used}.` };
    }
    const birim = Number(hayvan?.hisse_birim_fiyat ?? 0);
    finalPatch.agreed_total = Math.round(newShares * birim * 100) / 100;
  }

  const { error } = await supabase
    .from(BUYUKBAS_HISSEDAR_TABLE)
    .update(finalPatch)
    .eq("id", id);
  if (error) return { error: error.message };

  revalidateBuyukbas();
  return { success: true };
}

export async function applyBuyukbasPartialPayment(
  hissedarId: string,
  paidAmountRaw: string,
  manualNote?: string
) {
  await requireSession();
  const paidRaw = parseMoneyTR(String(paidAmountRaw).trim());
  const paid = Math.round(paidRaw * 100) / 100;
  if (!Number.isFinite(paid) || paid <= 0) {
    return { error: "Geçerli ve sıfırdan büyük bir ödenen tutar girin." };
  }

  const supabase = await createClient();
  const { data: row, error: fErr } = await supabase
    .from(BUYUKBAS_HISSEDAR_TABLE)
    .select("price, agreed_total, payment_status, payment_method, yil")
    .eq("id", hissedarId)
    .maybeSingle();
  if (fErr) return { error: fErr.message };
  if (!row) return { error: "Hissedar bulunamadı." };

  if (row.yil !== undefined) {
    try {
      await assertYearWritable(supabase, row.yil);
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : "Sezon kapalı." };
    }
  }

  const currentPrice = Math.round(Number(row.price ?? 0) * 100) / 100;
  if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
    return { error: "Kalan tutar sıfır veya geçersiz; kısmi ödeme uygulanamaz." };
  }
  if (paid > currentPrice + 1e-6) {
    return { error: `Ödenen tutar kalan tutardan (${TL.format(currentPrice)} ₺) fazla olamaz.` };
  }

  const prevAgreed = Number(row.agreed_total ?? 0);
  let nextAgreed = Math.max(Number.isFinite(prevAgreed) ? prevAgreed : 0, currentPrice);
  if (row.payment_status === "Kısmi Ödeme") {
    nextAgreed = Math.max(nextAgreed, Math.round((currentPrice + paid) * 100) / 100);
  }

  const remaining = Math.round((currentPrice - paid) * 100) / 100;
  const autoNote = `${TL.format(paid)} ₺ ödendi; kalan borç ${TL.format(Math.max(0, remaining))} ₺`;

  const currentPaymentMethod = String(row.payment_method || "");
  const separatorIdx = currentPaymentMethod.indexOf(" | ");
  let previousAutoNote = "";
  if (separatorIdx === -1) {
    if (currentPaymentMethod.includes("kalan borç") && currentPaymentMethod.includes("ödendi")) {
      previousAutoNote = currentPaymentMethod;
    }
  } else {
    previousAutoNote = currentPaymentMethod.slice(separatorIdx + 3);
  }

  const combinedAutoNote = previousAutoNote.trim()
    ? `${previousAutoNote.trim()}\n${autoNote}`
    : autoNote;
  const paymentMethod = manualNote
    ? `${manualNote.trim()} | ${combinedAutoNote}`
    : ` | ${combinedAutoNote}`;

  const payment_status: PaymentStatus = remaining <= 0 ? "Ödendi" : "Kısmi Ödeme";

  const { error } = await supabase
    .from(BUYUKBAS_HISSEDAR_TABLE)
    .update({
      price: remaining <= 0 ? 0 : remaining,
      payment_method: paymentMethod,
      payment_status,
      agreed_total: nextAgreed,
    })
    .eq("id", hissedarId);

  if (error) return { error: error.message };
  revalidateBuyukbas();
  return { success: true };
}

export async function deleteBuyukbasHayvan(number: string, targetYil?: number) {
  await requireSession();
  const supabase = await createClient();

  let query = supabase.from(BUYUKBAS_TABLE).delete().eq("number", number);
  if (targetYil !== undefined) {
    try {
      await assertYearWritable(supabase, targetYil);
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : "Sezon kapalı." };
    }
    query = query.eq("yil", targetYil);
  }

  const { error } = await query;
  if (error) return { error: error.message };
  revalidateBuyukbas();
  return { success: true };
}

export async function deleteBuyukbasHissedar(id: string) {
  await requireSession();
  const supabase = await createClient();

  const { data: row } = await supabase
    .from(BUYUKBAS_HISSEDAR_TABLE)
    .select("yil")
    .eq("id", id)
    .maybeSingle();

  if (row?.yil !== undefined) {
    try {
      await assertYearWritable(supabase, row.yil);
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : "Sezon kapalı." };
    }
  }

  const { error } = await supabase.from(BUYUKBAS_HISSEDAR_TABLE).delete().eq("id", id);
  if (error) return { error: error.message };
  revalidateBuyukbas();
  return { success: true };
}

export interface BuyukbasBulkSkippedRow {
  rowIndex: number;
  number: string;
  reason: string;
}

export interface BuyukbasBulkImportResult {
  insertedAnimals: number;
  insertedHissedarlar: number;
  skipped: BuyukbasBulkSkippedRow[];
}

export async function importBuyukbasBulk(
  groups: Array<{
    hayvan: {
      number: string;
      toplam_hisse: number;
      hayvan_fiyati: number;
      type?: string;
      special?: string;
      color_of_earring?: string;
      color_of_animal?: string;
      spray_paint_color?: string;
      from_whom?: string;
      group_category?: string;
      note?: string;
    };
    hissedarlar: Array<{
      whose?: string;
      phone_number?: string;
      alinan_hisse: number;
      price?: number;
      payment_method?: string;
      payment_status?: PaymentStatus;
      address?: string;
      note?: string;
    }>;
    rowIndices: number[];
  }>,
  targetYil?: number
): Promise<BuyukbasBulkImportResult | { error: string }> {
  await requireSession();
  const supabase = await createClient();

  const { year: activeYear } = await getSelectedYear(supabase);
  const yil = targetYil ?? activeYear;

  try {
    await assertYearWritable(supabase, yil);
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Sezon kapalı." };
  }

  const skipped: BuyukbasBulkSkippedRow[] = [];
  let insertedAnimals = 0;
  let insertedHissedarlar = 0;

  for (const group of groups) {
    const firstRow = group.rowIndices[0] ?? 0;
    const num = group.hayvan.number.trim();

    const conflict = await assertNumbersAvailable(supabase, [num], "buyukbas", undefined, yil);
    if (conflict) {
      skipped.push({ rowIndex: firstRow, number: num, reason: conflict });
      continue;
    }

    const usedShares = group.hissedarlar.reduce((s, h) => s + h.alinan_hisse, 0);
    if (usedShares > group.hayvan.toplam_hisse) {
      skipped.push({
        rowIndex: firstRow,
        number: num,
        reason: `Hisse toplamı aşıldı (${usedShares} > ${group.hayvan.toplam_hisse}).`,
      });
      continue;
    }

    const birim = computeHisseBirimFiyat(group.hayvan.hayvan_fiyati, group.hayvan.toplam_hisse);

    const { error: hErr } = await supabase.from(BUYUKBAS_TABLE).insert({
      yil,
      number: num,
      toplam_hisse: group.hayvan.toplam_hisse,
      hayvan_fiyati: group.hayvan.hayvan_fiyati,
      hisse_birim_fiyat: birim,
      type: group.hayvan.type ?? "",
      special: group.hayvan.special ?? "",
      color_of_earring: group.hayvan.color_of_earring ?? "",
      color_of_animal: group.hayvan.color_of_animal ?? "",
      spray_paint_color: group.hayvan.spray_paint_color ?? "",
      from_whom: group.hayvan.from_whom ?? "",
      group_category: group.hayvan.group_category ?? "",
      note: group.hayvan.note ?? "",
    });

    if (hErr) {
      skipped.push({ rowIndex: firstRow, number: num, reason: hErr.message });
      continue;
    }

    const rows = group.hissedarlar.map((h) => {
      const agreed = Math.round(h.alinan_hisse * birim * 100) / 100;
      const price = h.price ?? agreed;
      return {
        yil,
        hayvan_number: num,
        whose: h.whose ?? "",
        phone_number: normalizePhone(h.phone_number ?? ""),
        alinan_hisse: h.alinan_hisse,
        agreed_total: agreed,
        price,
        payment_method: h.payment_method ?? "",
        payment_status: h.payment_status ?? "Belirsiz",
        address: h.address ?? "",
        note: h.note ?? "",
      };
    });

    const { error: hsErr } = await supabase.from(BUYUKBAS_HISSEDAR_TABLE).insert(rows);
    if (hsErr) {
      await supabase
        .from(BUYUKBAS_TABLE)
        .delete()
        .eq("number", num)
        .eq("yil", yil);
      skipped.push({ rowIndex: firstRow, number: num, reason: hsErr.message });
      continue;
    }

    insertedAnimals += 1;
    insertedHissedarlar += rows.length;
  }

  revalidateBuyukbas();
  return { insertedAnimals, insertedHissedarlar, skipped };
}
