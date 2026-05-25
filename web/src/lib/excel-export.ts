import * as XLSX from "xlsx";
import type { BuyukbasHayvanWithHissedarlar, Customer } from "@/lib/types";
import { formatPhoneDisplay } from "@/lib/utils";

export function downloadKucukbasExcel(customers: Customer[], filename: string) {
  const headers = [
    "Random ID",
    "Numara",
    "Cins",
    "Özellik",
    "Küpe Rengi",
    "Hayvan Rengi",
    "Sıkılan Boya",
    "Sahip",
    "Kimden",
    "Fiyat (TL)",
    "Telefon",
    "Ödeme Detayı",
    "Ödeme Durumu",
    "Grup Kategorisi",
    "Adres",
    "Not",
  ];
  const rows = customers.map((c) => [
    c.random_id,
    c.number,
    c.type,
    c.special,
    c.color_of_earring,
    c.color_of_animal,
    c.spray_paint_color,
    c.whose,
    c.from_whom,
    c.price,
    formatPhoneDisplay(c.phone_number),
    c.payment_method,
    c.payment_status,
    c.group_category,
    c.address,
    c.note ?? "",
  ]);

  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Kucukbas");
  XLSX.writeFile(workbook, filename);
}

export function downloadBuyukbasExcel(hayvanlar: BuyukbasHayvanWithHissedarlar[], filename: string) {
  const headers = [
    "Numara",
    "Toplam Hisse",
    "Hayvan Fiyati (TL)",
    "Cins",
    "Ozellik",
    "Kupe Rengi",
    "Hayvan Rengi",
    "Sikilan Boya",
    "Kimden",
    "Grup Kategorisi",
    "Sahip",
    "Alinan Hisse",
    "Telefon",
    "Odeme Detayi",
    "Odeme Durumu",
    "Adres",
    "Not",
  ];

  const rows: unknown[][] = [];
  for (const h of hayvanlar) {
    if (h.hissedarlar.length === 0) {
      rows.push([
        h.number,
        h.toplam_hisse,
        h.hayvan_fiyati,
        h.type,
        h.special,
        h.color_of_earring,
        h.color_of_animal,
        h.spray_paint_color,
        h.from_whom,
        h.group_category,
        "",
        "",
        "",
        "",
        "",
        "",
        h.note ?? "",
      ]);
      continue;
    }
    for (const hs of h.hissedarlar) {
      rows.push([
        h.number,
        h.toplam_hisse,
        h.hayvan_fiyati,
        h.type,
        h.special,
        h.color_of_earring,
        h.color_of_animal,
        h.spray_paint_color,
        h.from_whom,
        h.group_category,
        hs.whose,
        hs.alinan_hisse,
        formatPhoneDisplay(hs.phone_number),
        hs.payment_method,
        hs.payment_status,
        hs.address,
        hs.note ?? "",
      ]);
    }
  }

  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Buyukbas");
  XLSX.writeFile(workbook, filename);
}

export function downloadCombinedExcel(
  customers: Customer[],
  hayvanlar: BuyukbasHayvanWithHissedarlar[],
  filename: string
) {
  const wb = XLSX.utils.book_new();

  const kHeaders = [
    "Random ID",
    "Numara",
    "Cins",
    "Özellik",
    "Küpe Rengi",
    "Hayvan Rengi",
    "Sıkılan Boya",
    "Sahip",
    "Kimden",
    "Fiyat (TL)",
    "Telefon",
    "Ödeme Detayı",
    "Ödeme Durumu",
    "Grup Kategorisi",
    "Adres",
    "Not",
  ];
  const kRows = customers.map((c) => [
    c.random_id,
    c.number,
    c.type,
    c.special,
    c.color_of_earring,
    c.color_of_animal,
    c.spray_paint_color,
    c.whose,
    c.from_whom,
    c.price,
    formatPhoneDisplay(c.phone_number),
    c.payment_method,
    c.payment_status,
    c.group_category,
    c.address,
    c.note ?? "",
  ]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([kHeaders, ...kRows]), "Kucukbas");

  const bHeaders = [
    "Numara",
    "Toplam Hisse",
    "Hayvan Fiyati (TL)",
    "Cins",
    "Ozellik",
    "Kupe Rengi",
    "Hayvan Rengi",
    "Sikilan Boya",
    "Kimden",
    "Grup Kategorisi",
    "Sahip",
    "Alinan Hisse",
    "Telefon",
    "Odeme Detayi",
    "Odeme Durumu",
    "Adres",
    "Not",
  ];
  const bRows: unknown[][] = [];
  for (const h of hayvanlar) {
    for (const hs of h.hissedarlar.length ? h.hissedarlar : []) {
      bRows.push([
        h.number,
        h.toplam_hisse,
        h.hayvan_fiyati,
        h.type,
        h.special,
        h.color_of_earring,
        h.color_of_animal,
        h.spray_paint_color,
        h.from_whom,
        h.group_category,
        hs.whose,
        hs.alinan_hisse,
        formatPhoneDisplay(hs.phone_number),
        hs.payment_method,
        hs.payment_status,
        hs.address,
        hs.note ?? "",
      ]);
    }
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([bHeaders, ...bRows]), "Buyukbas");

  XLSX.writeFile(wb, filename);
}
