import type { BuyukbasHayvanWithHissedarlar, Customer, Sezon } from "@/lib/types";
import { countAnimals, normalizePhone } from "@/lib/utils";

export interface YearlyMetrics {
  yil: number;
  ad: string;
  durum: "acik" | "kapali";
  is_default: boolean;

  // Küçükbaş
  kbRecordCount: number;
  kbAnimalCount: number;
  kbAgreedTotal: number;
  kbUnpaidTotal: number;
  kbCollectedTotal: number;
  kbAvgAnimalPrice: number;

  // Büyükbaş
  bbAnimalCount: number;
  bbTotalHisse: number;
  bbSoldHisse: number;
  bbFreeHisse: number;
  bbHisseOccupancyRate: number; // Yüzde 0-100
  bbTotalHayvanFiyati: number;
  bbUnpaidTotal: number;
  bbCollectedTotal: number;
  bbAvgAnimalPrice: number;
  bbAvgHissePrice: number;

  // Birleşik
  totalAnimals: number;
  totalAgreed: number;
  totalUnpaid: number;
  totalCollected: number;
  collectionRate: number; // Yüzde 0-100
  revenueGrowthRate: number | null; // Önceki yıla göre ciro büyüme %

  // Müşteri sayıları
  uniqueCustomersCount: number;
  newCustomersCount: number;
  returningCustomersCount: number;
}

export interface PastUnpaidDebt {
  id: string;
  yil: number;
  category: "Küçükbaş" | "Büyükbaş Hissedar";
  whose: string;
  phone_number: string;
  hayvanNumber: string;
  agreed_total: number;
  remaining_debt: number;
  payment_status: string;
}

export interface CustomerLoyaltyItem {
  whose: string;
  phone_number: string;
  years: number[];
  yearsCount: number;
  totalSpent: number;
}

export interface FullAnalyticsReport {
  yearlyMetrics: YearlyMetrics[];
  pastUnpaidDebts: PastUnpaidDebt[];
  totalPastUnpaidAmount: number;
  topLoyalCustomers: CustomerLoyaltyItem[];
  overallRetentionRate: number; // Genel sadakat oranı %
}

/**
 * Küçükbaş ve büyükbaş verilerini yıllara göre gruplayarak
 * detaylı finansal ve operasyonel metrikleri hesaplar.
 */
export function computeAnalytics(
  seasons: Sezon[],
  allCustomers: Customer[],
  allBuyukbas: BuyukbasHayvanWithHissedarlar[]
): FullAnalyticsReport {
  // Yılları küçükten büyüğe sırala (kronolojik analiz için)
  const sortedSeasons = [...seasons].sort((a, b) => a.yil - b.yil);

  // Müşteri sadakati için telefon bazlı harita
  // phone -> { whose, years: Set<number>, totalSpent: number }
  const customerHistoryMap = new Map<
    string,
    { whose: string; years: Set<number>; totalSpent: number }
  >();

  // Küçükbaş verilerini işle
  for (const c of allCustomers) {
    const phone = normalizePhone(c.phone_number);
    const key = phone || `name:${(c.whose || "").trim().toLocaleLowerCase("tr-TR")}`;
    if (!key || key === "name:") continue;

    const agreed = Number(c.agreed_total ?? c.price ?? 0);
    const item = customerHistoryMap.get(key) ?? {
      whose: c.whose || "İsimsiz",
      years: new Set<number>(),
      totalSpent: 0,
    };
    if (c.whose && (!item.whose || item.whose === "İsimsiz")) {
      item.whose = c.whose;
    }
    item.years.add(c.yil);
    item.totalSpent += agreed;
    customerHistoryMap.set(key, item);
  }

  // Büyükbaş verilerini işle
  for (const h of allBuyukbas) {
    for (const hs of h.hissedarlar) {
      const phone = normalizePhone(hs.phone_number);
      const key = phone || `name:${(hs.whose || "").trim().toLocaleLowerCase("tr-TR")}`;
      if (!key || key === "name:") continue;

      const agreed = Number(hs.agreed_total ?? hs.price ?? 0);
      const item = customerHistoryMap.get(key) ?? {
        whose: hs.whose || "İsimsiz",
        years: new Set<number>(),
        totalSpent: 0,
      };
      if (hs.whose && (!item.whose || item.whose === "İsimsiz")) {
        item.whose = hs.whose;
      }
      item.years.add(h.yil);
      item.totalSpent += agreed;
      customerHistoryMap.set(key, item);
    }
  }

  // Yıllara göre metrikleri topla
  const yearlyMetrics: YearlyMetrics[] = [];
  let prevYearAgreed: number | null = null;

  for (const season of sortedSeasons) {
    const y = season.yil;

    // Küçükbaş bu yıl
    const kbRows = allCustomers.filter((c) => c.yil === y);
    const kbRecordCount = kbRows.length;
    const kbAnimalCount = kbRows.reduce((sum, r) => sum + countAnimals(r.number), 0);
    const kbAgreedTotal = kbRows.reduce(
      (sum, r) => sum + Number(r.agreed_total ?? r.price ?? 0),
      0
    );
    const kbUnpaidRows = kbRows.filter((r) => r.payment_status !== "Ödendi");
    const kbUnpaidTotal = kbUnpaidRows.reduce((sum, r) => sum + Number(r.price ?? 0), 0);
    const kbCollectedTotal = Math.max(0, kbAgreedTotal - kbUnpaidTotal);
    const kbAvgAnimalPrice =
      kbAnimalCount > 0 ? Math.round(kbAgreedTotal / kbAnimalCount) : 0;

    // Büyükbaş bu yıl
    const bbRows = allBuyukbas.filter((h) => h.yil === y);
    const bbAnimalCount = bbRows.length;
    let bbTotalHisse = 0;
    let bbSoldHisse = 0;
    let bbTotalHayvanFiyati = 0;
    let bbUnpaidTotal = 0;

    for (const h of bbRows) {
      bbTotalHisse += Number(h.toplam_hisse ?? 0);
      bbTotalHayvanFiyati += Number(h.hayvan_fiyati ?? 0);
      for (const hs of h.hissedarlar) {
        bbSoldHisse += Number(hs.alinan_hisse ?? 0);
        if (hs.payment_status !== "Ödendi") {
          bbUnpaidTotal += Number(hs.price ?? 0);
        }
      }
    }

    const bbFreeHisse = Math.max(0, bbTotalHisse - bbSoldHisse);
    const bbHisseOccupancyRate =
      bbTotalHisse > 0 ? Math.round((bbSoldHisse / bbTotalHisse) * 1000) / 10 : 0;
    const bbCollectedTotal = Math.max(0, bbTotalHayvanFiyati - bbUnpaidTotal);
    const bbAvgAnimalPrice =
      bbAnimalCount > 0 ? Math.round(bbTotalHayvanFiyati / bbAnimalCount) : 0;
    const bbAvgHissePrice =
      bbTotalHisse > 0 ? Math.round(bbTotalHayvanFiyati / bbTotalHisse) : 0;

    // Birleşik metrikler
    const totalAnimals = kbAnimalCount + bbAnimalCount;
    const totalAgreed = kbAgreedTotal + bbTotalHayvanFiyati;
    const totalUnpaid = kbUnpaidTotal + bbUnpaidTotal;
    const totalCollected = kbCollectedTotal + bbCollectedTotal;
    const collectionRate =
      totalAgreed > 0 ? Math.round((totalCollected / totalAgreed) * 1000) / 10 : 0;

    // Büyüme oranı
    let revenueGrowthRate: number | null = null;
    if (prevYearAgreed !== null && prevYearAgreed > 0) {
      revenueGrowthRate =
        Math.round(((totalAgreed - prevYearAgreed) / prevYearAgreed) * 1000) / 10;
    }
    prevYearAgreed = totalAgreed;

    // Yeni ve tekrar eden müşteriler
    let newCustomersCount = 0;
    let returningCustomersCount = 0;
    const yearUniqueCustomers = new Set<string>();

    for (const c of kbRows) {
      const phone = normalizePhone(c.phone_number);
      const key = phone || `name:${(c.whose || "").trim().toLocaleLowerCase("tr-TR")}`;
      if (key && key !== "name:") yearUniqueCustomers.add(key);
    }
    for (const h of bbRows) {
      for (const hs of h.hissedarlar) {
        const phone = normalizePhone(hs.phone_number);
        const key = phone || `name:${(hs.whose || "").trim().toLocaleLowerCase("tr-TR")}`;
        if (key && key !== "name:") yearUniqueCustomers.add(key);
      }
    }

    for (const custKey of yearUniqueCustomers) {
      const history = customerHistoryMap.get(custKey);
      if (!history) continue;
      // Bu yıldan önce gelmiş miydi?
      const priorYears = Array.from(history.years).filter((priorY) => priorY < y);
      if (priorYears.length > 0) {
        returningCustomersCount += 1;
      } else {
        newCustomersCount += 1;
      }
    }

    yearlyMetrics.push({
      yil: y,
      ad: season.ad,
      durum: season.durum,
      is_default: season.is_default,
      kbRecordCount,
      kbAnimalCount,
      kbAgreedTotal,
      kbUnpaidTotal,
      kbCollectedTotal,
      kbAvgAnimalPrice,
      bbAnimalCount,
      bbTotalHisse,
      bbSoldHisse,
      bbFreeHisse,
      bbHisseOccupancyRate,
      bbTotalHayvanFiyati,
      bbUnpaidTotal,
      bbCollectedTotal,
      bbAvgAnimalPrice,
      bbAvgHissePrice,
      totalAnimals,
      totalAgreed,
      totalUnpaid,
      totalCollected,
      collectionRate,
      revenueGrowthRate,
      uniqueCustomersCount: yearUniqueCustomers.size,
      newCustomersCount,
      returningCustomersCount,
    });
  }

  // Geçmiş yıllardan kalan alacaklar (aktif/en güncel yıldan önceki ödenmemiş borçlar)
  const pastUnpaidDebts: PastUnpaidDebt[] = [];
  const latestYear = sortedSeasons.length > 0 ? sortedSeasons[sortedSeasons.length - 1].yil : 2026;

  for (const c of allCustomers) {
    if (c.yil < latestYear && c.payment_status !== "Ödendi" && Number(c.price ?? 0) > 0) {
      pastUnpaidDebts.push({
        id: `kb_${c.random_id}_${c.number}`,
        yil: c.yil,
        category: "Küçükbaş",
        whose: c.whose || "İsimsiz",
        phone_number: c.phone_number || "",
        hayvanNumber: c.number,
        agreed_total: Number(c.agreed_total ?? c.price ?? 0),
        remaining_debt: Number(c.price ?? 0),
        payment_status: c.payment_status,
      });
    }
  }

  for (const h of allBuyukbas) {
    if (h.yil < latestYear) {
      for (const hs of h.hissedarlar) {
        if (hs.payment_status !== "Ödendi" && Number(hs.price ?? 0) > 0) {
          pastUnpaidDebts.push({
            id: `bb_${hs.id}`,
            yil: h.yil,
            category: "Büyükbaş Hissedar",
            whose: hs.whose || "İsimsiz",
            phone_number: hs.phone_number || "",
            hayvanNumber: h.number,
            agreed_total: Number(hs.agreed_total ?? hs.price ?? 0),
            remaining_debt: Number(hs.price ?? 0),
            payment_status: hs.payment_status,
          });
        }
      }
    }
  }

  pastUnpaidDebts.sort((a, b) => b.remaining_debt - a.remaining_debt);
  const totalPastUnpaidAmount = pastUnpaidDebts.reduce((sum, d) => sum + d.remaining_debt, 0);

  // En sadık müşteriler (birden fazla yıl gelenler)
  const topLoyalCustomers: CustomerLoyaltyItem[] = [];
  for (const [key, val] of customerHistoryMap.entries()) {
    if (val.years.size >= 2) {
      topLoyalCustomers.push({
        whose: val.whose,
        phone_number: key.startsWith("name:") ? "" : key.replace("p:", ""),
        years: Array.from(val.years).sort(),
        yearsCount: val.years.size,
        totalSpent: val.totalSpent,
      });
    }
  }

  topLoyalCustomers.sort((a, b) => b.yearsCount - a.yearsCount || b.totalSpent - a.totalSpent);

  // Genel müşteri sadakat oranı
  const totalUniqueEver = customerHistoryMap.size;
  const returningEver = topLoyalCustomers.length;
  const overallRetentionRate =
    totalUniqueEver > 0 ? Math.round((returningEver / totalUniqueEver) * 1000) / 10 : 0;

  return {
    yearlyMetrics,
    pastUnpaidDebts,
    totalPastUnpaidAmount,
    topLoyalCustomers: topLoyalCustomers.slice(0, 30),
    overallRetentionRate,
  };
}
