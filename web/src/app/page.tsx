import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getBuyukbasStats, getStats } from "@/lib/supabase/queries";
import { getSelectedYear } from "@/lib/season";
import { formatPrice } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  List,
  Search,
  Plus,
  BarChart2,
  Trash2,
  Calendar,
  LineChart,
} from "lucide-react";

export const dynamic = "force-dynamic";

const quickLinks = [
  { href: "/musteriler", label: "Müşterileri Göster", icon: List, color: "text-primary" },
  { href: "/sorgula", label: "Müşteri Sorgula", icon: Search, color: "text-blue-400" },
  { href: "/ekle", label: "Müşteri Ekle", icon: Plus, color: "text-green" },
  { href: "/istatistikler", label: "İstatistikler", icon: BarChart2, color: "text-gold" },
  { href: "/analiz", label: "Yıllık Analiz", icon: LineChart, color: "text-purple-400" },
  { href: "/sezonlar", label: "Sezon Yönetimi", icon: Calendar, color: "text-emerald-400" },
  { href: "/sil", label: "Müşteri Sil", icon: Trash2, color: "text-red" },
];

export default async function DashboardPage() {
  const supabase = await createClient();
  const { year, season } = await getSelectedYear(supabase);

  let kucukbasStats = {
    count: 0,
    animalCount: 0,
    total: 0,
    unpaidTotal: 0,
    unpaidCount: 0,
    collectedTotal: 0,
  };
  let buyukbasStats = {
    animalCount: 0,
    totalHisse: 0,
    soldHisse: 0,
    freeHisse: 0,
    totalHayvanFiyati: 0,
    unpaidTotal: 0,
    unpaidCount: 0,
    collectedTotal: 0,
  };

  try {
    [kucukbasStats, buyukbasStats] = await Promise.all([
      getStats(supabase, year),
      getBuyukbasStats(supabase, year),
    ]);
  } catch (e) {
    console.error("Dashboard stats error:", e);
  }

  const totalAnimalCount = kucukbasStats.animalCount + buyukbasStats.animalCount;
  const totalExpected = kucukbasStats.total + buyukbasStats.totalHayvanFiyati;
  const totalCollected = kucukbasStats.collectedTotal + buyukbasStats.collectedTotal;
  const totalUnpaidCount = kucukbasStats.unpaidCount + buyukbasStats.unpaidCount;

  return (
    <div className="space-y-8">
      {/* Karşılama ve Aktif Sezon Başlığı */}
      <div className="premium-card-interactive rounded-xl border border-border bg-card p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="mb-2 text-2xl font-bold text-foreground">Hoş Geldiniz 👋</h2>
            <p className="text-muted-foreground text-sm sm:text-base">
              Bu sistem, kurbanlık hayvanların müşteri ve sezon takibini kolaylaştırmak için tasarlanmıştır.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 bg-primary/10 border border-primary/20 px-3.5 py-2 rounded-xl">
            <Calendar className="h-4 w-4 text-primary" />
            <div className="text-left">
              <p className="text-[11px] font-medium text-muted-foreground">Aktif Görüntülenen Sezon</p>
              <p className="text-xs font-bold text-foreground">
                {season.ad} ({year})
                {season.durum === "kapali" && (
                  <span className="ml-1 text-amber-500 font-normal">· Kapalı (Salt Okunur)</span>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* İstatistik kartları (Seçilen Yıla Ait) */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="group premium-card-interactive rounded-xl border-2 border-border bg-card p-4 sm:p-5 text-center">
          <p className="text-2xl sm:text-3xl font-extrabold text-green">{totalAnimalCount}</p>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            📊 Toplam Hayvan ({kucukbasStats.animalCount} Küçük · {buyukbasStats.animalCount} Büyük)
          </p>
        </div>
        <div className="group premium-card-interactive rounded-xl border-2 border-border bg-card p-4 sm:p-5 text-center">
          <p className="text-xl sm:text-3xl font-extrabold text-gold break-all">{formatPrice(totalExpected)} ₺</p>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">💰 Anlaşılan Toplam (Beklenen)</p>
        </div>
        <div className="group premium-card-interactive rounded-xl border-2 border-border bg-card p-4 sm:p-5 text-center">
          <p className="text-xl sm:text-3xl font-extrabold text-green break-all">{formatPrice(totalCollected)} ₺</p>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">✅ Tahsil Edilen Tutar</p>
        </div>
        <div className="group premium-card-interactive rounded-xl border-2 border-border bg-card p-4 sm:p-5 text-center">
          <p className="text-2xl sm:text-3xl font-extrabold text-red">{totalUnpaidCount}</p>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">❗ Bekleyen Ödeme</p>
        </div>
      </div>

      {/* Hızlı menü */}
      <div>
        <h3 className="mb-4 text-lg font-semibold text-foreground">Hızlı Erişim</h3>
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,10.5rem),1fr))]">
          {quickLinks.map(({ href, label, icon: Icon, color }) => (
            <Button
              key={href}
              variant="outline"
              asChild
              className="premium-card-interactive group h-auto w-full min-h-[5.25rem] flex-col justify-center gap-2 py-4 px-3 sm:min-h-0 sm:py-5 border-2 border-border"
            >
              <Link href={href} className="flex flex-col items-center gap-2">
                <Icon className={`h-6 w-6 shrink-0 transition-transform duration-300 group-hover:scale-110 ${color}`} />
                <span className="text-center text-xs font-medium leading-tight sm:text-sm group-hover:text-primary transition-colors">{label}</span>
              </Link>
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
