"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { customerSchema } from "@/lib/validations";
import { parseMoneyTR } from "@/lib/input-format";
import {
  assertNumbersAvailable,
  tokensFromKucukbasNumber,
} from "@/lib/animal-number-check";
import { TABLE, type CustomerKey } from "@/lib/types";
import { generateRandomId, normalizePhone, parseAnimalNumbers } from "@/lib/utils";

function isMissingAgreedTotalDbError(message: string): boolean {
  return /agreed_total/i.test(message) && /does not exist|column/i.test(message);
}

function isDuplicatePkError(message: string): boolean {
  return /duplicate key/i.test(message) || /unique constraint/i.test(message) || /23505/.test(message);
}

// Composite key (random_id + number) sorgu zincirleri inline olarak
// kullanılır; çünkü generic bir helper ile sarılınca Supabase'in derin generic
// chain tipi TS2589 (excessively deep) hatası verir.

function revalidateAll() {
  revalidatePath("/musteriler");
  revalidatePath("/guncelle");
  revalidatePath("/sil");
  revalidatePath("/istatistikler");
  revalidatePath("/sorgula");
  revalidatePath("/");
}

// ─── Tekil ekleme ──────────────────────────────────────────────────────────────

export async function addCustomer(formData: unknown) {
  const parsed = customerSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  const data = parsed.data;
  const supabase = await createClient();

  const numConflict = await assertNumbersAvailable(
    supabase,
    tokensFromKucukbasNumber(data.number),
    "kucukbas"
  );
  if (numConflict) return { error: numConflict };

  // Telefon opsiyonel: boşsa "" olarak saklanır. Dolu girildiyse normalize edilmiş
  // 11 haneli formatı bekleriz (zod schema kontrolü zaten yapıldı).
  const phone = normalizePhone(data.phone_number);

  const random_id = generateRandomId();
  const initialPrice = Number(data.price) || 0;
  const row = {
    random_id,
    number: data.number,
    type: data.type,
    special: data.special,
    color_of_earring: data.color_of_earring,
    color_of_animal: data.color_of_animal,
    whose: data.whose,
    from_whom: data.from_whom,
    agreed_total: initialPrice,
    price: initialPrice,
    phone_number: phone,
    payment_method: data.payment_method,
    payment_status: data.payment_status,
    group_category: data.group_category,
    address: data.address,
    spray_paint_color: data.spray_paint_color,
    note: data.note,
  };

  let { error } = await supabase.from(TABLE).insert(row);
  if (error && isMissingAgreedTotalDbError(error.message)) {
    const { agreed_total: _a, ...withoutAgreed } = row;
    void _a;
    ({ error } = await supabase.from(TABLE).insert(withoutAgreed));
  }

  if (error) {
    if (isDuplicatePkError(error.message)) {
      return { error: `Bu kayıt (${data.number}) zaten mevcut. Lütfen tekrar deneyin.` };
    }
    return { error: error.message };
  }

  revalidateAll();
  return { success: true };
}

// ─── Toplu Excel Ekleme ───────────────────────────────────────────────────────

export interface BulkSkippedRow {
  rowIndex: number;
  number: string;
  reason: string;
}

export interface BulkImportResult {
  inserted: number;
  skipped: BulkSkippedRow[];
}

export async function addCustomersBulk(
  rows: unknown[]
): Promise<BulkImportResult | { error: string }> {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { error: "İçe aktarılacak satır bulunamadı." };
  }

  const supabase = await createClient();

  const toInsert: object[] = [];
  const skipped: BulkSkippedRow[] = [];

  for (let i = 0; i < rows.length; i++) {
    const parsed = customerSchema.safeParse(rows[i]);

    if (!parsed.success) {
      const raw = rows[i] as Record<string, unknown>;
      const num = String(raw?.number ?? "");
      const messages = parsed.error.issues.map((iss) => iss.message).join("; ");
      skipped.push({
        rowIndex: i,
        number: num,
        reason: `Doğrulama hatası: ${messages}`,
      });
      continue;
    }

    const data = parsed.data;

    const numConflict = await assertNumbersAvailable(
      supabase,
      tokensFromKucukbasNumber(data.number),
      "kucukbas"
    );
    if (numConflict) {
      skipped.push({ rowIndex: i, number: data.number, reason: numConflict });
      continue;
    }

    // Telefon opsiyonel: boş veya geçersizse boş string saklanır, satır atlanmaz.
    const phone = normalizePhone(data.phone_number);

    const initialPrice = Number(data.price) || 0;

    toInsert.push({
      random_id: generateRandomId(),
      number: data.number,
      type: data.type,
      special: data.special,
      color_of_earring: data.color_of_earring,
      color_of_animal: data.color_of_animal,
      whose: data.whose,
      from_whom: data.from_whom,
      agreed_total: initialPrice,
      price: initialPrice,
      phone_number: phone,
      payment_method: data.payment_method,
      payment_status: data.payment_status,
      group_category: data.group_category,
      address: data.address,
      spray_paint_color: data.spray_paint_color,
      note: data.note,
    });
  }

  if (toInsert.length === 0) {
    return { inserted: 0, skipped };
  }

  let { error: insertErr } = await supabase.from(TABLE).insert(toInsert);

  if (insertErr && isMissingAgreedTotalDbError(insertErr.message)) {
    const withoutAgreed = toInsert.map((row) => {
      const { agreed_total: _a, ...rest } = row as Record<string, unknown>;
      void _a;
      return rest;
    });
    ({ error: insertErr } = await supabase.from(TABLE).insert(withoutAgreed));
  }

  if (insertErr) return { error: insertErr.message };

  revalidateAll();

  return { inserted: toInsert.length, skipped };
}

// ─── Kısmi ödeme ───────────────────────────────────────────────────────────────

const TL = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export async function applyPartialPayment(
  key: CustomerKey,
  paidAmountRaw: string,
  manualNote?: string
) {
  const paidRaw = parseMoneyTR(String(paidAmountRaw).trim());
  const paid = Math.round(paidRaw * 100) / 100;
  if (!Number.isFinite(paid) || paid <= 0) {
    return { error: "Geçerli ve sıfırdan büyük bir ödenen tutar girin." };
  }

  const supabase = await createClient();
  let row: {
    number?: string;
    price?: unknown;
    agreed_total?: unknown;
    payment_status?: unknown;
    payment_method?: unknown;
  } | null = null;
  let fetchErr: { message: string } | null = null;

  const fullFetch = await supabase
    .from(TABLE)
    .select("number, price, agreed_total, payment_status, payment_method")
    .eq("random_id", key.random_id)
    .eq("number", key.number)
    .maybeSingle();

  if (fullFetch.error && isMissingAgreedTotalDbError(fullFetch.error.message)) {
    const legacyFetch = await supabase
      .from(TABLE)
      .select("number, price, payment_status, payment_method")
      .eq("random_id", key.random_id)
      .eq("number", key.number)
      .maybeSingle();
    row = legacyFetch.data;
    fetchErr = legacyFetch.error;
  } else {
    row = fullFetch.data;
    fetchErr = fullFetch.error;
  }

  if (fetchErr) return { error: fetchErr.message };
  if (!row) return { error: "Kayıt bulunamadı." };

  const currentPrice = Math.round(Number(row.price ?? 0) * 100) / 100;
  if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
    return { error: "Kalan tutar sıfır veya geçersiz; kısmi ödeme uygulanamaz." };
  }
  if (paid > currentPrice + 1e-6) {
    return { error: `Ödenen tutar kalan tutardan (${TL.format(currentPrice)} ₺) fazla olamaz.` };
  }

  const prevAgreed = Number(row.agreed_total ?? 0);
  let nextAgreed = Math.max(
    Number.isFinite(prevAgreed) ? prevAgreed : 0,
    currentPrice
  );
  if (row.payment_status === "Kısmi Ödeme") {
    nextAgreed = Math.max(nextAgreed, Math.round((currentPrice + paid) * 100) / 100);
  }

  const remaining = Math.round((currentPrice - paid) * 100) / 100;
  const paidFmt = TL.format(paid);
  const remainingFmt = TL.format(Math.max(0, remaining));
  const autoNote = `${paidFmt} ₺ ödendi; kalan borç ${remainingFmt} ₺`;
  
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
  
  const combinedAutoNote = previousAutoNote.trim() ? `${previousAutoNote.trim()}\n${autoNote}` : autoNote;
  const paymentMethod = manualNote ? `${manualNote.trim()} | ${combinedAutoNote}` : ` | ${combinedAutoNote}`;

  const payment_status =
    remaining <= 0 ? ("Ödendi" as const) : ("Kısmi Ödeme" as const);

  const patch: Record<string, unknown> = {
    price: remaining <= 0 ? 0 : remaining,
    payment_method: paymentMethod,
    payment_status,
    agreed_total: nextAgreed,
  };

  let { error } = await supabase
    .from(TABLE)
    .update(patch)
    .eq("random_id", key.random_id)
    .eq("number", key.number);

  if (error && isMissingAgreedTotalDbError(error.message)) {
    const { agreed_total: _a, ...withoutAgreed } = patch;
    void _a;
    ({ error } = await supabase
      .from(TABLE)
      .update(withoutAgreed)
      .eq("random_id", key.random_id)
      .eq("number", key.number));
  }

  if (error) return { error: error.message };

  revalidateAll();
  return { success: true };
}

// ─── Çoklu alan güncelleme ─────────────────────────────────────────────────────

export async function updateCustomerFields(
  key: CustomerKey,
  updates: Record<string, unknown>
) {
  const supabase = await createClient();

  const patch: Record<string, unknown> = { ...updates };

  if (typeof patch.number === "string") {
    const normalized = parseAnimalNumbers(patch.number as string).join(", ");
    const numConflict = await assertNumbersAvailable(
      supabase,
      tokensFromKucukbasNumber(normalized),
      "kucukbas",
      { source: "kucukbas", random_id: key.random_id, number: key.number }
    );
    if (numConflict) return { error: numConflict };
    patch.number = normalized;
  }

  if (typeof patch.phone_number === "string") {
    const trimmed = patch.phone_number.trim();
    if (trimmed === "") {
      patch.phone_number = "";
    } else {
      const norm = normalizePhone(trimmed);
      if (!norm) {
        return { error: "Geçerli bir telefon numarası girin. Örn: 0532 123 45 67" };
      }
      patch.phone_number = norm;
    }
  }

  const { error } = await supabase
    .from(TABLE)
    .update(patch)
    .eq("random_id", key.random_id)
    .eq("number", key.number);

  if (error) {
    if (isDuplicatePkError(error.message)) {
      return { error: "Aynı random ID ve hayvan numarasına sahip bir kayıt zaten mevcut." };
    }
    return { error: error.message };
  }

  revalidateAll();
  return { success: true };
}

// ─── Tek alan güncelleme ───────────────────────────────────────────────────────

export async function updateCustomerField(
  key: CustomerKey,
  field: string,
  value: string
) {
  const supabase = await createClient();

  let finalValue: string | number = value;
  if (field === "price") {
    const n = parseMoneyTR(value);
    finalValue = Number.isFinite(n) ? n : 0;
  }
  if (field === "phone_number") {
    const trimmed = value.trim();
    if (trimmed === "") {
      finalValue = "";
    } else {
      const norm = normalizePhone(trimmed);
      if (!norm) {
        return { error: "Geçerli bir telefon numarası girin. Örn: 0532 123 45 67" };
      }
      finalValue = norm;
    }
  }
  if (field === "number") {
    const trimmed = value.trim();
    if (!/^\d+(\s*,\s*\d+)*$/.test(trimmed)) {
      return { error: "Hayvan numarası yalnızca rakamlardan oluşmalı; birden fazla için virgülle ayırın." };
    }
    finalValue = trimmed
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .join(", ");

    const numConflict = await assertNumbersAvailable(
      supabase,
      tokensFromKucukbasNumber(String(finalValue)),
      "kucukbas",
      { source: "kucukbas", random_id: key.random_id, number: key.number }
    );
    if (numConflict) return { error: numConflict };
  }

  const { error } = await supabase
    .from(TABLE)
    .update({ [field]: finalValue })
    .eq("random_id", key.random_id)
    .eq("number", key.number);

  if (error) {
    if (isDuplicatePkError(error.message)) {
      return { error: "Aynı random ID ve hayvan numarasına sahip bir kayıt zaten mevcut." };
    }
    return { error: error.message };
  }

  revalidateAll();
  return { success: true };
}

// ─── Silme ─────────────────────────────────────────────────────────────────────

export async function deleteCustomer(key: CustomerKey) {
  const supabase = await createClient();
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq("random_id", key.random_id)
    .eq("number", key.number);
  if (error) return { error: error.message };

  revalidateAll();
  return { success: true };
}
