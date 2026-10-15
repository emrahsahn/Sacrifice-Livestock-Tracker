"use client";

import { useState, useMemo, useSyncExternalStore } from "react";
import type { FullAnalyticsReport } from "@/lib/analytics";
import { formatPhoneDisplay, formatPrice } from "@/lib/utils";
import { downloadPastDebtsExcel } from "@/lib/excel-export";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  TrendingUp,
  DollarSign,
  Users,
  Beef,
  AlertCircle,
  Download,
  Calendar,
  Sparkles,
  Search,
} from "lucide-react";

interface AnalizClientProps {
  report: FullAnalyticsReport;
}

type TabType = "finans" | "operasyon" | "sadakat" | "alacaklar" | "tablo";

const emptySubscribe = () => () => {};

export function AnalizClient({ report }: AnalizClientProps) {
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [activeTab, setActiveTab] = useState<TabType>("finans");

  // Alacaklar arama filtresi
  const [debtSearch, setDebtSearch] = useState("");
  const [debtYearFilter, setDebtYearFilter] = useState<number | "all">("all");

  const {
    yearlyMetrics,
    pastUnpaidDebts,
    totalPastUnpaidAmount,
    topLoyalCustomers,
    overallRetentionRate,
  } = report;

  // Genel Kümülatif KPI'lar
  const grandTotalAgreed = useMemo(
    () => yearlyMetrics.reduce((s, m) => s + m.totalAgreed, 0),
    [yearlyMetrics]
  );
  const grandTotalCollected = useMemo(
    () => yearlyMetrics.reduce((s, m) => s + m.totalCollected, 0),
    [yearlyMetrics]
  );
  const grandTotalAnimals = useMemo(
    () => yearlyMetrics.reduce((s, m) => s + m.totalAnimals, 0),
    [yearlyMetrics]
  );
  const grandCollectionRate =
    grandTotalAgreed > 0 ? Math.round((grandTotalCollected / grandTotalAgreed) * 100) : 0;

  // Filtrelenmiş borç listesi
  const filteredDebts = useMemo(() => {
    return pastUnpaidDebts.filter((d) => {
      if (debtYearFilter !== "all" && d.yil !== debtYearFilter) return false;
      if (!debtSearch.trim()) return true;
      const q = debtSearch.trim().toLocaleLowerCase("tr-TR");
      const nameMatch = d.whose.toLocaleLowerCase("tr-TR").includes(q);
      const phoneMatch = d.phone_number.includes(q);
      const numMatch = d.hayvanNumber.includes(q);
      return nameMatch || phoneMatch || numMatch;
    });
  }, [pastUnpaidDebts, debtSearch, debtYearFilter]);

  // Recharts veri formatları
  const financialChartData = useMemo(() => {
    return yearlyMetrics.map((m) => ({
      name: `${m.yil}`,
      "Anlaşılan Ciro": m.totalAgreed,
      "Tahsil Edilen": m.totalCollected,
      "Kalan Borç": m.totalUnpaid,
    }));
  }, [yearlyMetrics]);

  const animalChartData = useMemo(() => {
    return yearlyMetrics.map((m) => ({
      name: `${m.yil}`,
      "Küçükbaş Hayvan": m.kbAnimalCount,
      "Büyükbaş Hayvan": m.bbAnimalCount,
      "Büyükbaş Satılan Hisse": m.bbSoldHisse,
    }));
  }, [yearlyMetrics]);

  const priceTrendData = useMemo(() => {
    return yearlyMetrics.map((m) => ({
      name: `${m.yil}`,
      "Ort. Küçükbaş Fiyatı": m.kbAvgAnimalPrice,
      "Ort. Büyükbaş Hisse Fiyatı": m.bbAvgHissePrice,
    }));
  }, [yearlyMetrics]);

  const customerLoyaltyChartData = useMemo(() => {
    return yearlyMetrics.map((m) => ({
      name: `${m.yil}`,
      "Yeni Müşteri": m.newCustomersCount,
      "Tekrar Gelen (Sadık)": m.returningCustomersCount,
    }));
  }, [yearlyMetrics]);

  function handleExportDebts() {
    downloadPastDebtsExcel(
      filteredDebts,
      debtYearFilter === "all"
        ? "tum-yillar-kalan-alacaklar.xlsx"
        : `${debtYearFilter}-kalan-alacaklar.xlsx`
    );
  }

  return (
    <div className="space-y-8">
      {/* ── ÜST KPI KARTLARI ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="premium-card-interactive rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Kümülatif Ciro</span>
            <DollarSign className="h-4 w-4 text-gold" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-gold break-all">
            {formatPrice(grandTotalAgreed)} ₺
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Tahsil: {formatPrice(grandTotalCollected)} ₺ (%{grandCollectionRate})
          </p>
        </div>

        <div className="premium-card-interactive rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Toplam Hayvan</span>
            <Beef className="h-4 w-4 text-green" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-green">
            {grandTotalAnimals} adet
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {yearlyMetrics.length} sezonun toplamı
          </p>
        </div>

        <div className="premium-card-interactive rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Geçmiş Kalan Borç</span>
            <AlertCircle className="h-4 w-4 text-red" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-red break-all">
            {formatPrice(totalPastUnpaidAmount)} ₺
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {pastUnpaidDebts.length} borçlu kayıt
          </p>
        </div>

        <div className="premium-card-interactive rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Müşteri Sadakati</span>
            <Users className="h-4 w-4 text-purple-400" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-purple-400">
            %{overallRetentionRate}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Çoklu sezon tercih edenler
          </p>
        </div>
      </div>

      {/* ── TAB MENÜSÜ ── */}
      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        <Button
          variant={activeTab === "finans" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("finans")}
          className="gap-1.5"
        >
          <DollarSign className="h-4 w-4" />
          Finansal Trendler
        </Button>

        <Button
          variant={activeTab === "operasyon" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("operasyon")}
          className="gap-1.5"
        >
          <Beef className="h-4 w-4" />
          Operasyon & Hayvanlar
        </Button>

        <Button
          variant={activeTab === "sadakat" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("sadakat")}
          className="gap-1.5"
        >
          <Users className="h-4 w-4" />
          Müşteri Sadakati
        </Button>

        <Button
          variant={activeTab === "alacaklar" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("alacaklar")}
          className="gap-1.5 relative"
        >
          <AlertCircle className="h-4 w-4 text-red" />
          Kalan Alacaklar
          {pastUnpaidDebts.length > 0 && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-red/20 text-red font-bold">
              {pastUnpaidDebts.length}
            </span>
          )}
        </Button>

        <Button
          variant={activeTab === "tablo" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("tablo")}
          className="gap-1.5"
        >
          <Calendar className="h-4 w-4" />
          Yıllık Karşılaştırma Tablosu
        </Button>
      </div>

      {/* ── TAB 1: FİNANSAL TRENDLER ── */}
      {activeTab === "finans" && (
        <div className="space-y-6 animate-fade-slide-in">
          {/* Ciro ve Tahsilat Grafiği */}
          <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm">
            <h3 className="text-base font-bold text-foreground mb-1 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Yıllara Göre Ciro, Tahsilat ve Kalan Borç
            </h3>
            <p className="text-xs text-muted-foreground mb-6">
              Her sezon için sözleşilen toplam ciro ve tahsilat başarı oranı.
            </p>

            {mounted ? (
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={financialChartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="name" stroke="#888888" fontSize={12} />
                    <YAxis
                      stroke="#888888"
                      fontSize={11}
                      tickFormatter={(val) => `${(val / 1000).toFixed(0)}k ₺`}
                    />
                    <Tooltip
                      formatter={(val: unknown) => [
                        `${formatPrice(Number(val ?? 0))} ₺`,
                        "",
                      ]}
                      contentStyle={{
                        backgroundColor: "var(--card)",
                        borderColor: "var(--border)",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend wrapperStyle={{ paddingTop: "12px", fontSize: "12px" }} />
                    <Bar dataKey="Anlaşılan Ciro" fill="#eab308" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Tahsil Edilen" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Kalan Borç" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-80 flex items-center justify-center text-muted-foreground">
                Grafik yükleniyor...
              </div>
            )}
          </div>

          {/* Fiyat Gelişim Trendi */}
          <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm">
            <h3 className="text-base font-bold text-foreground mb-1 flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-gold" />
              Ortalama Hayvan & Hisse Fiyat Trendi
            </h3>
            <p className="text-xs text-muted-foreground mb-6">
              Sezonlar arası ortalama küçükbaş hayvan fiyatı ve büyükbaş hisse fiyatı değişimi.
            </p>

            {mounted ? (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={priceTrendData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="name" stroke="#888888" fontSize={12} />
                    <YAxis
                      stroke="#888888"
                      fontSize={11}
                      tickFormatter={(val) => `${(val / 1000).toFixed(0)}k ₺`}
                    />
                    <Tooltip
                      formatter={(val: unknown) => [
                        `${formatPrice(Number(val ?? 0))} ₺`,
                        "",
                      ]}
                      contentStyle={{
                        backgroundColor: "var(--card)",
                        borderColor: "var(--border)",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend wrapperStyle={{ paddingTop: "12px", fontSize: "12px" }} />
                    <Line
                      type="monotone"
                      dataKey="Ort. Küçükbaş Fiyatı"
                      stroke="#8b5cf6"
                      strokeWidth={3}
                      dot={{ r: 5 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="Ort. Büyükbaş Hisse Fiyatı"
                      stroke="#3b82f6"
                      strokeWidth={3}
                      dot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-72 flex items-center justify-center text-muted-foreground">
                Grafik yükleniyor...
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 2: OPERASYON & HAYVANLAR ── */}
      {activeTab === "operasyon" && (
        <div className="space-y-6 animate-fade-slide-in">
          <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm">
            <h3 className="text-base font-bold text-foreground mb-1 flex items-center gap-2">
              <Beef className="h-5 w-5 text-green" />
              Yıllara Göre Hayvan Adetleri
            </h3>
            <p className="text-xs text-muted-foreground mb-6">
              Küçükbaş adetleri, büyükbaş hayvan sayıları ve satılan büyükbaş hisse toplamları.
            </p>

            {mounted ? (
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={animalChartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="name" stroke="#888888" fontSize={12} />
                    <YAxis stroke="#888888" fontSize={11} />
                    <Tooltip
                      formatter={(val: unknown) => [`${val} adet`, ""]}
                      contentStyle={{
                        backgroundColor: "var(--card)",
                        borderColor: "var(--border)",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend wrapperStyle={{ paddingTop: "12px", fontSize: "12px" }} />
                    <Bar dataKey="Küçükbaş Hayvan" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Büyükbaş Hayvan" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Büyükbaş Satılan Hisse" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-80 flex items-center justify-center text-muted-foreground">
                Grafik yükleniyor...
              </div>
            )}
          </div>

          {/* Büyükbaş Hisse Doluluk Özeti */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {yearlyMetrics.map((m) => (
              <div key={m.yil} className="rounded-xl border border-border bg-card p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground">{m.ad} ({m.yil})</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary">
                    %{m.bbHisseOccupancyRate} Doluluk
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-500"
                    style={{ width: `${m.bbHisseOccupancyRate}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground pt-1">
                  <span>Satılan: {m.bbSoldHisse} / {m.bbTotalHisse} hisse</span>
                  <span>Boşta: {m.bbFreeHisse} hisse</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 3: MÜŞTERİ SADAKATİ ── */}
      {activeTab === "sadakat" && (
        <div className="space-y-6 animate-fade-slide-in">
          {/* Yeni vs Tekrar Gelen Grafiği */}
          <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm">
            <h3 className="text-base font-bold text-foreground mb-1 flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-400" />
              Müşteri Edinimi ve Geri Dönüş Oranları
            </h3>
            <p className="text-xs text-muted-foreground mb-6">
              Her sezon sisteme ilk kez katılan yeni müşteriler ile önceki yıllardan tekrar gelen sadık müşteriler.
            </p>

            {mounted ? (
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={customerLoyaltyChartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="name" stroke="#888888" fontSize={12} />
                    <YAxis stroke="#888888" fontSize={11} />
                    <Tooltip
                      formatter={(val: unknown) => [`${val} müşteri`, ""]}
                      contentStyle={{
                        backgroundColor: "var(--card)",
                        borderColor: "var(--border)",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend wrapperStyle={{ paddingTop: "12px", fontSize: "12px" }} />
                    <Bar dataKey="Yeni Müşteri" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="Tekrar Gelen (Sadık)" stackId="a" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-80 flex items-center justify-center text-muted-foreground">
                Grafik yükleniyor...
              </div>
            )}
          </div>

          {/* En Sadık Müşteriler Listesi */}
          <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm">
            <h3 className="text-base font-bold text-foreground mb-1 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-gold" />
              En Sadık Müşteriler (Çok Sezon Katılanlar)
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Birden fazla sezonda kurban alan ve toplam harcaması en yüksek olan müşteriler.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">Müşteri</th>
                    <th className="py-2.5 px-3 font-semibold">Telefon</th>
                    <th className="py-2.5 px-3 font-semibold">Katıldığı Sezonlar</th>
                    <th className="py-2.5 px-3 font-semibold">Sezon Sayısı</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Toplam Harcama</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {topLoyalCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-muted-foreground">
                        Henüz çoklu sezon katılımı gösteren müşteri kaydı bulunmuyor.
                      </td>
                    </tr>
                  ) : (
                    topLoyalCustomers.map((c, i) => (
                      <tr key={i} className="hover:bg-accent/40 transition-colors">
                        <td className="py-2.5 px-3 font-bold text-foreground">{c.whose}</td>
                        <td className="py-2.5 px-3 text-muted-foreground">
                          {c.phone_number ? formatPhoneDisplay(c.phone_number) : "—"}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex flex-wrap gap-1">
                            {c.years.map((y) => (
                              <span
                                key={y}
                                className="px-1.5 py-0.5 rounded text-[10px] bg-primary/10 text-primary font-medium"
                              >
                                {y}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-semibold">{c.yearsCount} Sezon</td>
                        <td className="py-2.5 px-3 font-bold text-gold text-right">
                          {formatPrice(c.totalSpent)} ₺
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 4: GEÇMİŞ KALAN ALACAKLAR ── */}
      {activeTab === "alacaklar" && (
        <div className="space-y-6 animate-fade-slide-in">
          {/* Üst Uyarı & Excel İndir Çubuğu */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-xl bg-destructive/10 border border-destructive/20">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-6 w-6 text-destructive shrink-0" />
              <div>
                <h4 className="text-sm font-bold text-foreground">
                  Geçmiş Yıllardan Kalan Toplam Alacak: {formatPrice(totalPastUnpaidAmount)} ₺
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Ödemesi tamamlanmamış (kısmi veya ödenmedi) tüm müşteri kayıtları burada listelenir.
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportDebts}
              disabled={filteredDebts.length === 0}
              className="border-destructive/40 text-destructive hover:bg-destructive/10 shrink-0 self-start sm:self-auto"
            >
              <Download className="h-4 w-4 mr-1.5" />
              Borçlu Listesini Excel İndir
            </Button>
          </div>

          {/* Filtre Çubuğu */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="İsim, telefon veya hayvan no ile ara..."
                value={debtSearch}
                onChange={(e) => setDebtSearch(e.target.value)}
                className="pl-9 text-xs"
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant={debtYearFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setDebtYearFilter("all")}
                className="text-xs"
              >
                Tüm Yıllar ({pastUnpaidDebts.length})
              </Button>
              {yearlyMetrics.map((m) => {
                const count = pastUnpaidDebts.filter((d) => d.yil === m.yil).length;
                return (
                  <Button
                    key={m.yil}
                    variant={debtYearFilter === m.yil ? "default" : "outline"}
                    size="sm"
                    onClick={() => setDebtYearFilter(m.yil)}
                    className="text-xs"
                  >
                    {m.yil} ({count})
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Tablo */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="py-3 px-3 font-semibold">Yıl</th>
                    <th className="py-3 px-3 font-semibold">Kategori</th>
                    <th className="py-3 px-3 font-semibold">Müşteri</th>
                    <th className="py-3 px-3 font-semibold">Telefon</th>
                    <th className="py-3 px-3 font-semibold">Hayvan No</th>
                    <th className="py-3 px-3 font-semibold text-right">Anlaşılan</th>
                    <th className="py-3 px-3 font-semibold text-right">Kalan Borç</th>
                    <th className="py-3 px-3 font-semibold">Durum</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredDebts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-muted-foreground">
                        Eşleşen borçlu kayıt bulunamadı.
                      </td>
                    </tr>
                  ) : (
                    filteredDebts.map((d) => (
                      <tr key={d.id} className="hover:bg-accent/40 transition-colors">
                        <td className="py-2.5 px-3">
                          <span className="font-semibold px-2 py-0.5 rounded bg-muted">
                            {d.yil}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground">{d.category}</td>
                        <td className="py-2.5 px-3 font-bold text-foreground">{d.whose || "İsimsiz"}</td>
                        <td className="py-2.5 px-3">
                          {d.phone_number ? (
                            <a
                              href={`tel:${d.phone_number}`}
                              className="text-primary hover:underline"
                            >
                              {formatPhoneDisplay(d.phone_number)}
                            </a>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-foreground">
                          #{d.hayvanNumber}
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium text-muted-foreground">
                          {formatPrice(d.agreed_total)} ₺
                        </td>
                        <td className="py-2.5 px-3 text-right font-extrabold text-red">
                          {formatPrice(d.remaining_debt)} ₺
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              d.payment_status === "Kısmi Ödeme"
                                ? "bg-amber-500/15 text-amber-500 border border-amber-500/20"
                                : "bg-red/15 text-red border border-red/20"
                            }`}
                          >
                            {d.payment_status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 5: YILLIK KARŞILAŞTIRMA TABLOSU ── */}
      {activeTab === "tablo" && (
        <div className="space-y-6 animate-fade-slide-in">
          <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm overflow-hidden">
            <h3 className="text-base font-bold text-foreground mb-1 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Tüm Yılların Özet Karşılaştırması
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Sezon bazında finansal ve operasyonel göstergelerin yan yana dökümü.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="py-3 px-3 font-semibold">Sezon</th>
                    <th className="py-3 px-3 font-semibold">Durum</th>
                    <th className="py-3 px-3 font-semibold text-right">Anlaşılan Ciro</th>
                    <th className="py-3 px-3 font-semibold text-right">Tahsilat</th>
                    <th className="py-3 px-3 font-semibold text-right">Tahsilat %</th>
                    <th className="py-3 px-3 font-semibold text-right">Küçükbaş</th>
                    <th className="py-3 px-3 font-semibold text-right">Büyükbaş</th>
                    <th className="py-3 px-3 font-semibold text-right">Hisse Doluluk</th>
                    <th className="py-3 px-3 font-semibold text-right">Yeni Müşteri</th>
                    <th className="py-3 px-3 font-semibold text-right">Sadık Müşteri</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {yearlyMetrics.map((m) => (
                    <tr key={m.yil} className="hover:bg-accent/40 transition-colors">
                      <td className="py-3 px-3 font-bold text-foreground">{m.yil}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            m.durum === "kapali"
                              ? "bg-amber-500/10 text-amber-500"
                              : "bg-green/10 text-green"
                          }`}
                        >
                          {m.durum === "kapali" ? "Kapalı" : "Açık"}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-gold">
                        {formatPrice(m.totalAgreed)} ₺
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-green">
                        {formatPrice(m.totalCollected)} ₺
                      </td>
                      <td className="py-3 px-3 text-right font-semibold">%{m.collectionRate}</td>
                      <td className="py-3 px-3 text-right text-muted-foreground">
                        {m.kbAnimalCount} adet
                      </td>
                      <td className="py-3 px-3 text-right text-muted-foreground">
                        {m.bbAnimalCount} adet
                      </td>
                      <td className="py-3 px-3 text-right font-medium">
                        %{m.bbHisseOccupancyRate}
                      </td>
                      <td className="py-3 px-3 text-right text-blue-400 font-medium">
                        {m.newCustomersCount}
                      </td>
                      <td className="py-3 px-3 text-right text-purple-400 font-medium">
                        {m.returningCustomersCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
