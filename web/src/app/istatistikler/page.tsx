import { createClient } from "@/lib/supabase/server";
import { getBuyukbasGroupStats, getBuyukbasStats, getStats, getGroupStats } from "@/lib/supabase/queries";
import { StatCard } from "@/components/stat-card";
import { formatPrice } from "@/lib/utils";
import { BUYUKBAS_GROUP_CATEGORIES, GROUP_CATEGORIES } from "@/lib/types";

export const dynamic = "force-dynamic";

const GROUP_ICONS: Record<string, string> = {
  "1.Gün Kesilecek Küçük Mallar": "🔪",
  "1.Gün Kesilecek Büyük Mallar": "🔪",
  "2.Gün Kesilecek Küçük Mallar": "✂️",
  "2.Gün Kesilecek Büyük Mallar": "✂️",
  "Pazardan Kendi Alacaklar": "🛒",
  "Köyden Kendi Alacaklar": "🏘️",
  "Çarşıya Dağıtılacaklar": "🏪",
  "Köye Dağıtılacaklar": "🚚",
  "Kesilip Dükkana Gönderilecekler": "🏬",
};

export default async function IstatistiklerPage() {
  const supabase = await createClient();
  const [stats, groupStats, buyukbasStats, buyukbasGroupStats] = await Promise.all([
    getStats(supabase),
    getGroupStats(supabase),
    getBuyukbasStats(supabase),
    getBuyukbasGroupStats(supabase),
  ]);

  const grupsuzCount = groupStats["__grupsuz__"]?.count ?? 0;
  const grupsuzAnimalCount = groupStats["__grupsuz__"]?.animalCount ?? 0;
  const grupsuzTotal = groupStats["__grupsuz__"]?.total ?? 0;

  const combinedAnimalCount = stats.animalCount + buyukbasStats.animalCount;
  const combinedAgreed = stats.total + buyukbasStats.totalHayvanFiyati;
  const combinedUnpaid = stats.unpaidTotal + buyukbasStats.unpaidTotal;
  const combinedCollected = stats.collectedTotal + buyukbasStats.collectedTotal;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-foreground">📊 İstatistikler</h1>

      {/* Genel özet — küçükbaş + büyükbaş toplamı */}
      <div>
        <h2 className="text-base font-semibold text-muted-foreground mb-4 border-b border-border pb-2">
          📈 Genel Özet (Küçükbaş + Büyükbaş)
        </h2>
        <div className="grid gap-6 md:grid-cols-2">
          <StatCard
            label="📊 Toplam Hayvan"
            value={combinedAnimalCount}
            sub={`Küçükbaş ${stats.animalCount} · Büyükbaş ${buyukbasStats.animalCount}`}
            colorClass="text-green"
          />
          <StatCard
            label="💰 Anlaşılan Toplam"
            value={`${formatPrice(combinedAgreed)} ₺`}
            sub="Küçükbaş sözleşme + büyükbaş hayvan fiyatları"
            colorClass="text-gold"
          />
          <StatCard
            label="⏳ Kalan Borç"
            value={`${formatPrice(combinedUnpaid)} ₺`}
            sub={`Küçükbaş ${stats.unpaidCount} kayıt · Büyükbaş ${buyukbasStats.unpaidCount} hissedar`}
            colorClass="text-red"
          />
          <StatCard
            label="✅ Tahsil Edilen"
            value={`${formatPrice(combinedCollected)} ₺`}
            sub="Anlaşılan toplam − güncel kalan tutarlar"
            colorClass="text-green"
          />
        </div>
      </div>

      {/* Küçükbaş özet */}
      <div>
        <h2 className="text-base font-semibold text-muted-foreground mb-4 border-b border-border pb-2">
          🐑 Küçükbaş Özet
        </h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Kayıtlı Müşteri"
            value={stats.count}
            sub={`${stats.animalCount} hayvan (gruplu kayıtlar dahil)`}
            colorClass="text-primary"
          />
          <StatCard
            label="Anlaşılan"
            value={`${formatPrice(stats.total)} ₺`}
            sub="Sözleşme / beklenen tutarların toplamı"
            colorClass="text-gold"
          />
          <StatCard
            label="Kalan"
            value={`${formatPrice(stats.unpaidTotal)} ₺`}
            sub={`${stats.unpaidCount} kayıt: Ödendi dışı (kısmi dahil)`}
            colorClass="text-red"
          />
          <StatCard
            label="Tahsil Edilen"
            value={`${formatPrice(stats.collectedTotal)} ₺`}
            sub="Anlaşılan − güncel kalan"
            colorClass="text-green"
          />
        </div>
      </div>

      {/* Büyükbaş özet */}
      <div>
        <h2 className="text-base font-semibold text-muted-foreground mb-4 border-b border-border pb-2">
          🐄 Büyükbaş Özet
        </h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Büyükbaş Hayvan"
            value={buyukbasStats.animalCount}
            sub={`${buyukbasStats.soldHisse} / ${buyukbasStats.totalHisse} hisse dolu`}
            colorClass="text-violet-500"
          />
          <StatCard
            label="Anlaşılan"
            value={`${formatPrice(buyukbasStats.totalHayvanFiyati)} ₺`}
            sub="Tüm hayvanların fiyat toplamı"
            colorClass="text-gold"
          />
          <StatCard
            label="Kalan"
            value={`${formatPrice(buyukbasStats.unpaidTotal)} ₺`}
            sub={`${buyukbasStats.unpaidCount} hissedarın güncel borcu`}
            colorClass="text-red"
          />
          <StatCard
            label="Tahsil Edilen"
            value={`${formatPrice(buyukbasStats.collectedTotal)} ₺`}
            sub="Hayvan fiyatları toplamı − hissedar kalanları"
            colorClass="text-green"
          />
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mt-6">
          <StatCard
            label="Boş Hisse"
            value={buyukbasStats.freeHisse}
            sub="Satılmamış pay"
            colorClass="text-muted-foreground"
          />
        </div>
      </div>

      {/* Grup bazlı istatistikler */}
      <div>
        <h2 className="text-base font-semibold text-muted-foreground mb-4 border-b border-border pb-2">
          Gruplara Göre Dağılım (Küçükbaş)
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {GROUP_CATEGORIES.map((group) => {
            const info = groupStats[group];
            const count = info?.count ?? 0;
            const animalCount = info?.animalCount ?? 0;
            const total = info?.total ?? 0;
            const icon = GROUP_ICONS[group] ?? "📂";
            return (
              <div
                key={group}
                className="group premium-card-interactive rounded-xl border-2 border-border bg-card p-4 flex flex-col gap-1"
              >
                <p className="text-xs font-semibold text-muted-foreground leading-tight">
                  {icon} {group}
                </p>
                <p className="text-2xl font-extrabold text-primary mt-1 transition-transform duration-300 group-hover:scale-110 origin-left">{animalCount}</p>
                <p className="text-xs text-muted-foreground">hayvan ({count} kayıt)</p>
                <p className="text-sm font-bold text-gold mt-1">
                  {formatPrice(total)} ₺
                </p>
              </div>
            );
          })}

          {grupsuzCount > 0 && (
            <div className="group premium-card-interactive rounded-xl border-2 border-dashed border-border bg-card p-4 flex flex-col gap-1">
              <p className="text-xs font-semibold text-muted-foreground leading-tight">
                ❓ Grupsuz Kayıtlar
              </p>
              <p className="text-2xl font-extrabold text-muted-foreground mt-1 transition-transform duration-300 group-hover:scale-110 origin-left">{grupsuzAnimalCount}</p>
              <p className="text-xs text-muted-foreground">hayvan ({grupsuzCount} kayıt)</p>
              <p className="text-sm font-bold text-gold mt-1">
                {formatPrice(grupsuzTotal)} ₺
              </p>
            </div>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-base font-semibold text-muted-foreground mb-4 border-b border-border pb-2 mt-8">
          Gruplara Göre Dağılım (Büyükbaş)
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {BUYUKBAS_GROUP_CATEGORIES.map((group) => {
            const info = buyukbasGroupStats[group];
            const count = info?.count ?? 0;
            const animalCount = info?.animalCount ?? 0;
            const total = info?.total ?? 0;
            const icon = GROUP_ICONS[group] ?? "📂";
            if (animalCount === 0) return null;
            return (
              <div
                key={group}
                className="group premium-card-interactive rounded-xl border-2 border-border bg-card p-4 flex flex-col gap-1"
              >
                <p className="text-xs font-semibold text-muted-foreground leading-tight">
                  {icon} {group}
                </p>
                <p className="text-2xl font-extrabold text-violet-600 mt-1">{animalCount}</p>
                <p className="text-xs text-muted-foreground">hayvan ({count} hissedar)</p>
                <p className="text-sm font-bold text-gold mt-1">{formatPrice(total)} ₺</p>
                <p className="text-[10px] text-muted-foreground">hayvan fiyatları toplamı</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
