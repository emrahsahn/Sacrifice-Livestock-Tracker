import { describe, it, expect } from "vitest";
import { computeAnalytics } from "../src/lib/analytics";
import type { BuyukbasHayvanWithHissedarlar, Customer, Sezon } from "../src/lib/types";

describe("computeAnalytics", () => {
  const sampleSeasons: Sezon[] = [
    { yil: 2025, ad: "2025 Kurban Sezonu", durum: "kapali", is_default: false },
    { yil: 2026, ad: "2026 Kurban Sezonu", durum: "acik", is_default: true },
  ];

  const sampleCustomers: Customer[] = [
    // 2025 müşterisi
    {
      yil: 2025,
      random_id: "c1",
      number: "101, 102",
      type: "Koyun",
      special: "",
      color_of_earring: "",
      color_of_animal: "",
      whose: "Ahmet Yılmaz",
      from_whom: "Tedarikçi A",
      agreed_total: 20000,
      price: 0,
      phone_number: "05321112233",
      payment_method: "Nakit",
      payment_status: "Ödendi",
      group_category: "1.Gün Kesilecek Küçük Mallar",
      address: "",
      spray_paint_color: "",
    },
    // 2025 borçlu müşteri
    {
      yil: 2025,
      random_id: "c2",
      number: "103",
      type: "Koç",
      special: "",
      color_of_earring: "",
      color_of_animal: "",
      whose: "Mehmet Demir",
      from_whom: "Tedarikçi A",
      agreed_total: 15000,
      price: 5000,
      phone_number: "05334445566",
      payment_method: "Kısmi",
      payment_status: "Kısmi Ödeme",
      group_category: "1.Gün Kesilecek Küçük Mallar",
      address: "",
      spray_paint_color: "",
    },
    // 2026 müşterisi (Ahmet Yılmaz tekrar geldi)
    {
      yil: 2026,
      random_id: "c3",
      number: "101",
      type: "Koyun",
      special: "",
      color_of_earring: "",
      color_of_animal: "",
      whose: "Ahmet Yılmaz",
      from_whom: "Tedarikçi B",
      agreed_total: 25000,
      price: 0,
      phone_number: "05321112233",
      payment_method: "Havale",
      payment_status: "Ödendi",
      group_category: "1.Gün Kesilecek Küçük Mallar",
      address: "",
      spray_paint_color: "",
    },
  ];

  const sampleBuyukbas: BuyukbasHayvanWithHissedarlar[] = [
    // 2025 büyükbaş
    {
      yil: 2025,
      number: "B1",
      toplam_hisse: 7,
      hayvan_fiyati: 70000,
      hisse_birim_fiyat: 10000,
      type: "Tosun",
      special: "",
      color_of_earring: "",
      color_of_animal: "",
      spray_paint_color: "",
      from_whom: "",
      group_category: "1.Gün Kesilecek Büyük Mallar",
      hissedarlar: [
        {
          id: "h1",
          yil: 2025,
          hayvan_number: "B1",
          whose: "Ali Veli",
          phone_number: "05559998877",
          alinan_hisse: 2,
          agreed_total: 20000,
          price: 0,
          payment_method: "Nakit",
          payment_status: "Ödendi",
          address: "",
        },
      ],
    },
    // 2026 büyükbaş
    {
      yil: 2026,
      number: "B1",
      toplam_hisse: 7,
      hayvan_fiyati: 84000,
      hisse_birim_fiyat: 12000,
      type: "Tosun",
      special: "",
      color_of_earring: "",
      color_of_animal: "",
      spray_paint_color: "",
      from_whom: "",
      group_category: "1.Gün Kesilecek Büyük Mallar",
      hissedarlar: [
        {
          id: "h2",
          yil: 2026,
          hayvan_number: "B1",
          whose: "Ali Veli",
          phone_number: "05559998877",
          alinan_hisse: 3,
          agreed_total: 36000,
          price: 12000,
          payment_method: "Kısmi",
          payment_status: "Kısmi Ödeme",
          address: "",
        },
      ],
    },
  ];

  it("calculates annual metrics accurately across 2025 and 2026", () => {
    const report = computeAnalytics(sampleSeasons, sampleCustomers, sampleBuyukbas);
    expect(report.yearlyMetrics).toHaveLength(2);

    const y2025 = report.yearlyMetrics[0];
    expect(y2025.yil).toBe(2025);
    expect(y2025.kbRecordCount).toBe(2);
    expect(y2025.kbAnimalCount).toBe(3); // 101, 102 (2) + 103 (1) = 3
    expect(y2025.kbAgreedTotal).toBe(35000);
    expect(y2025.kbUnpaidTotal).toBe(5000);
    expect(y2025.kbCollectedTotal).toBe(30000);
    expect(y2025.bbTotalHayvanFiyati).toBe(70000);
    expect(y2025.totalAnimals).toBe(4); // 3 kb + 1 bb
    expect(y2025.totalAgreed).toBe(105000); // 35000 + 70000

    const y2026 = report.yearlyMetrics[1];
    expect(y2026.yil).toBe(2026);
    expect(y2026.kbAnimalCount).toBe(1);
    expect(y2026.totalAgreed).toBe(109000); // 25000 + 84000
    expect(y2026.revenueGrowthRate).toBeGreaterThan(0);
  });

  it("identifies returning and loyal customers", () => {
    const report = computeAnalytics(sampleSeasons, sampleCustomers, sampleBuyukbas);
    const y2026 = report.yearlyMetrics[1];
    // In 2026, Ahmet Yılmaz and Ali Veli are both returning customers from 2025
    expect(y2026.returningCustomersCount).toBe(2);
    expect(report.topLoyalCustomers).toHaveLength(2);
  });

  it("finds unpaid debts from prior years", () => {
    const report = computeAnalytics(sampleSeasons, sampleCustomers, sampleBuyukbas);
    // Mehmet Demir has 5000 TL unpaid debt in 2025
    expect(report.pastUnpaidDebts).toHaveLength(1);
    expect(report.pastUnpaidDebts[0].whose).toBe("Mehmet Demir");
    expect(report.pastUnpaidDebts[0].remaining_debt).toBe(5000);
    expect(report.totalPastUnpaidAmount).toBe(5000);
  });
});
