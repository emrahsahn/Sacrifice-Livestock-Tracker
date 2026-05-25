import { PAYMENT_OPTIONS, type PaymentStatus } from "@/lib/types";
import { parseMoneyTR } from "@/lib/input-format";
import { formatMoneyInputTR, formatPhoneInputTR } from "@/lib/input-format";

function normH(text: string) {
  return text.toLocaleLowerCase("tr-TR").replace(/\uFEFF/g, "").replace(/\s+/g, " ").trim();
}

export interface BuyukbasParsedRow {
  rowIndex: number;
  number: string;
  toplam_hisse: number;
  hayvan_fiyati: number;
  type: string;
  special: string;
  color_of_earring: string;
  color_of_animal: string;
  spray_paint_color: string;
  from_whom: string;
  group_category: string;
  whose: string;
  alinan_hisse: number;
  phone_number: string;
  payment_method: string;
  payment_status: PaymentStatus;
  address: string;
  note: string;
  price: string;
  validationError?: string;
}

export function isBuyukbasHeaders(headers: string[]): boolean {
  const h = headers.map(normH);
  return h.some((x) => x.includes("toplam hisse")) || h.some((x) => x.includes("hayvan fiyat"));
}

export function parseBuyukbasExcelRows(data: unknown[][]): {
  rows: BuyukbasParsedRow[];
  headerError?: string;
} {
  if (data.length < 2) {
    return { rows: [], headerError: "Excel dosyası en az bir başlık ve bir veri satırı içermeli." };
  }

  const headers = data[0].map((h) => normH(String(h || "")));
  const rows: BuyukbasParsedRow[] = [];

  for (let i = 1; i < data.length; i++) {
    const cols = data[i];
    if (!cols || cols.length === 0 || cols.every((c) => c === null || c === undefined || c === ""))
      continue;

    const map = new Map<string, string>();
    headers.forEach((h, idx) => map.set(h, String(cols[idx] ?? "").trim()));
    const get = (...keys: string[]) => {
      for (const k of keys) {
        const v = map.get(normH(k));
        if (v !== undefined && v !== "") return v;
      }
      return "";
    };

    const num = get("Numara", "numara").replace(/[^\d]/g, "");
    const toplamRaw = get("Toplam Hisse", "toplam hisse");
    const fiyatRaw = get("Hayvan Fiyati (TL)", "Hayvan Fiyatı (TL)", "hayvan fiyati");
    const alinanRaw = get("Alinan Hisse", "Alınan Hisse", "alinan hisse");

    let validationError: string | undefined;
    if (!num) validationError = "Hayvan numarası boş.";
    else if (!/^\d+$/.test(num)) validationError = "Hayvan numarası tek sayı olmalı.";
    else if (!toplamRaw || !Number.isFinite(Number(toplamRaw))) {
      validationError = "Toplam hisse geçersiz.";
    } else if (!alinanRaw || !Number.isFinite(Number(alinanRaw))) {
      validationError = "Alınan hisse geçersiz.";
    }

    const parsedStatus = get("Ödeme Durumu", "Odeme Durumu");
    const payStatus = PAYMENT_OPTIONS.includes(parsedStatus as PaymentStatus)
      ? (parsedStatus as PaymentStatus)
      : "Belirsiz";

    const hayvanFiyat = parseMoneyTR(fiyatRaw);
    const priceRaw = get("Fiyat (TL)", "fiyat");

    rows.push({
      rowIndex: i,
      number: num,
      toplam_hisse: Number(toplamRaw) || 0,
      hayvan_fiyati: Number.isFinite(hayvanFiyat) ? hayvanFiyat : 0,
      type: get("Cins", "cins"),
      special: get("Özellik", "Ozellik"),
      color_of_earring: get("Küpe Rengi", "Kupe Rengi"),
      color_of_animal: get("Hayvan Rengi"),
      spray_paint_color: get("Sıkılan Boya", "Sikilan Boya"),
      from_whom: get("Kimden"),
      group_category: get("Grup Kategorisi"),
      whose: get("Sahip"),
      alinan_hisse: Number(alinanRaw) || 0,
      phone_number: formatPhoneInputTR(get("Telefon")),
      payment_method: get("Ödeme Detayı", "Odeme Detayi"),
      payment_status: payStatus,
      address: get("Adres"),
      note: get("Not"),
      price: priceRaw ? formatMoneyInputTR(priceRaw) : "",
      validationError,
    });
  }

  return { rows };
}

export function groupBuyukbasRows(rows: BuyukbasParsedRow[]) {
  const valid = rows.filter((r) => !r.validationError);
  const groups = new Map<
    string,
    {
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
    }
  >();

  for (const r of valid) {
    if (!groups.has(r.number)) {
      groups.set(r.number, {
        hayvan: {
          number: r.number,
          toplam_hisse: r.toplam_hisse,
          hayvan_fiyati: r.hayvan_fiyati,
          type: r.type,
          special: r.special,
          color_of_earring: r.color_of_earring,
          color_of_animal: r.color_of_animal,
          spray_paint_color: r.spray_paint_color,
          from_whom: r.from_whom,
          group_category: r.group_category,
          note: r.note,
        },
        hissedarlar: [],
        rowIndices: [],
      });
    }
    const g = groups.get(r.number)!;
    if (r.toplam_hisse > 0) g.hayvan.toplam_hisse = r.toplam_hisse;
    if (r.hayvan_fiyati > 0) g.hayvan.hayvan_fiyati = r.hayvan_fiyati;
    g.rowIndices.push(r.rowIndex);
    const priceNum = parseMoneyTR(r.price ?? "");
    g.hissedarlar.push({
      whose: r.whose,
      phone_number: r.phone_number,
      alinan_hisse: r.alinan_hisse,
      price: Number.isFinite(priceNum) && priceNum > 0 ? priceNum : undefined,
      payment_method: r.payment_method,
      payment_status: r.payment_status,
      address: r.address,
      note: r.note,
    });
  }

  return [...groups.values()];
}
