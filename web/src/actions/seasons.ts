"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/require-session";
import {
  BUYUKBAS_HISSEDAR_TABLE,
  BUYUKBAS_TABLE,
  SEZON_TABLE,
  TABLE,
  type Sezon,
  type SezonDurum,
} from "@/lib/types";
import { SEASON_COOKIE } from "@/lib/season";
import { normalizePhone } from "@/lib/utils";

/**
 * Kullanıcının aktif çalışma yılını çerezde değiştirir.
 */
export async function selectYear(yil: number) {
  const cookieStore = await cookies();
  cookieStore.set(SEASON_COOKIE, String(yil), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 yıl
  });

  revalidatePath("/", "layout");
  return { success: true, year: yil };
}

/**
 * Yeni bir kurban sezonu/yılı oluşturur.
 */
export async function createSeason(params: {
  yil: number;
  ad?: string;
  is_default?: boolean;
  notlar?: string;
  switchAfter?: boolean;
}) {
  await requireSession();
  const yil = Number(params.yil);

  if (!Number.isInteger(yil) || yil < 2000 || yil > 2100) {
    return { error: "Geçerli bir yıl giriniz (2000-2100 arası)." };
  }

  const supabase = await createClient();

  // Yıl zaten var mı kontrolü
  const { data: existing } = await supabase
    .from(SEZON_TABLE)
    .select("yil")
    .eq("yil", yil)
    .maybeSingle();

  if (existing) {
    return { error: `${yil} yılı zaten sistemde kayıtlı.` };
  }

  const ad = params.ad?.trim() || `${yil} Kurban Sezonu`;

  if (params.is_default) {
    // Diğer sezonların varsayılan işaretini kaldır
    await supabase.from(SEZON_TABLE).update({ is_default: false }).neq("yil", yil);
  }

  const { error } = await supabase.from(SEZON_TABLE).insert({
    yil,
    ad,
    durum: "acik" as SezonDurum,
    is_default: Boolean(params.is_default),
    notlar: params.notlar?.trim() || "",
  });

  if (error) {
    return { error: `Sezon oluşturulamadı: ${error.message}` };
  }

  if (params.switchAfter) {
    await selectYear(yil);
  } else {
    revalidatePath("/", "layout");
  }

  return { success: true };
}

/**
 * Sezonu kapatır veya tekrar açar.
 */
export async function toggleSeasonStatus(yil: number, durum: SezonDurum) {
  await requireSession();
  const supabase = await createClient();

  const patch: Record<string, unknown> = {
    durum,
    closed_at: durum === "kapali" ? new Date().toISOString() : null,
  };

  const { error } = await supabase
    .from(SEZON_TABLE)
    .update(patch)
    .eq("yil", yil);

  if (error) {
    return { error: `Sezon durumu güncellenemedi: ${error.message}` };
  }

  revalidatePath("/", "layout");
  return { success: true };
}

/**
 * Belirtilen sezonu varsayılan (yeni cihazlarda açılacak) sezon yapar.
 */
export async function setDefaultSeason(yil: number) {
  await requireSession();
  const supabase = await createClient();

  // Önce tüm sezonların varsayılan işaretini sıfırla
  await supabase.from(SEZON_TABLE).update({ is_default: false }).neq("yil", yil);

  const { error } = await supabase
    .from(SEZON_TABLE)
    .update({ is_default: true })
    .eq("yil", yil);

  if (error) {
    return { error: `Varsayılan sezon ayarlanamadı: ${error.message}` };
  }

  revalidatePath("/", "layout");
  return { success: true };
}

/**
 * Sezonu siler (yalnızca içinde hiç kayıt olmayan boş sezonlar silinebilir).
 */
export async function deleteSeason(yil: number) {
  await requireSession();
  const supabase = await createClient();

  // Küçükbaş kontrolü
  const { count: kbCount } = await supabase
    .from(TABLE)
    .select("number", { count: "exact", head: true })
    .eq("yil", yil);

  if ((kbCount ?? 0) > 0) {
    return {
      error: `Bu sezonda ${kbCount} adet küçükbaş kaydı bulunmaktadır. Sezonu silebilmek için önce kayıtları temizlemelisiniz.`,
    };
  }

  // Büyükbaş kontrolü
  const { count: bbCount } = await supabase
    .from(BUYUKBAS_TABLE)
    .select("number", { count: "exact", head: true })
    .eq("yil", yil);

  if ((bbCount ?? 0) > 0) {
    return {
      error: `Bu sezonda ${bbCount} adet büyükbaş kaydı bulunmaktadır. Sezonu silebilmek için önce kayıtları temizlemelisiniz.`,
    };
  }

  const { error } = await supabase.from(SEZON_TABLE).delete().eq("yil", yil);
  if (error) {
    return { error: `Sezon silinemedi: ${error.message}` };
  }

  const cookieStore = await cookies();
  const curCookie = cookieStore.get(SEASON_COOKIE)?.value;
  if (curCookie === String(yil)) {
    cookieStore.delete(SEASON_COOKIE);
  }

  revalidatePath("/", "layout");
  return { success: true };
}

export interface PastCustomerSuggestion {
  whose: string;
  phone_number: string;
  address: string;
  lastYear: number;
  lastGroup?: string;
  count: number;
}

/**
 * Geçmiş tüm yıllardaki müşteri isimlerini/telefonlarını arayarak
 * yeni ekleme formlarında tek tıkla otomatik doldurma sağlar.
 */
export async function searchPastCustomers(
  query: string
): Promise<PastCustomerSuggestion[]> {
  await requireSession();
  const q = query.trim().toLocaleLowerCase("tr-TR");
  if (!q || q.length < 2) return [];

  const supabase = await createClient();

  // Küçükbaş kayıtlarından ara
  const { data: kbData } = await supabase
    .from(TABLE)
    .select("whose, phone_number, address, group_category, yil")
    .or(`whose.ilike.%${q}%,phone_number.ilike.%${q}%`)
    .limit(50);

  // Büyükbaş hissedarlarından ara
  const { data: bbData } = await supabase
    .from(BUYUKBAS_HISSEDAR_TABLE)
    .select("whose, phone_number, address, yil")
    .or(`whose.ilike.%${q}%,phone_number.ilike.%${q}%`)
    .limit(50);

  const map = new Map<string, PastCustomerSuggestion>();

  const processRow = (
    whoseRaw: unknown,
    phoneRaw: unknown,
    addressRaw: unknown,
    groupRaw: unknown,
    yilRaw: unknown
  ) => {
    const whose = String(whoseRaw ?? "").trim();
    const phone = normalizePhone(String(phoneRaw ?? ""));
    const address = String(addressRaw ?? "").trim();
    const group = String(groupRaw ?? "").trim();
    const yil = Number(yilRaw ?? 0);

    if (!whose && !phone) return;

    // Telefon varsa telefonla, yoksa isimle tekilleştir
    const key = phone ? `p:${phone}` : `w:${whose.toLocaleLowerCase("tr-TR")}`;
    const existing = map.get(key);

    if (!existing) {
      map.set(key, {
        whose,
        phone_number: phone,
        address,
        lastYear: yil,
        lastGroup: group,
        count: 1,
      });
    } else {
      existing.count += 1;
      if (yil > existing.lastYear) {
        existing.lastYear = yil;
        if (whose) existing.whose = whose;
        if (address) existing.address = address;
        if (group) existing.lastGroup = group;
      }
    }
  };

  for (const r of kbData ?? []) {
    processRow(r.whose, r.phone_number, r.address, r.group_category, r.yil);
  }

  for (const r of bbData ?? []) {
    processRow(r.whose, r.phone_number, r.address, undefined, r.yil);
  }

  const results = Array.from(map.values());
  results.sort((a, b) => b.lastYear - a.lastYear || b.count - a.count);
  return results.slice(0, 10);
}
