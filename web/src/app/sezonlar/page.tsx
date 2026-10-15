import { createClient } from "@/lib/supabase/server";
import { getSeasons, getSelectedYear } from "@/lib/season";
import { getBuyukbasStats, getStats } from "@/lib/supabase/queries";
import { SezonlarClient, type SeasonWithStats } from "./sezonlar-client";

export const dynamic = "force-dynamic";

export default async function SezonlarPage() {
  const supabase = await createClient();
  const [seasons, selected] = await Promise.all([
    getSeasons(supabase),
    getSelectedYear(supabase),
  ]);

  // Her sezon için özet istatistikleri paralel olarak çek
  const seasonsWithStats: SeasonWithStats[] = await Promise.all(
    seasons.map(async (s) => {
      let kbStats = { animalCount: 0, count: 0, total: 0, collectedTotal: 0, unpaidTotal: 0 };
      let bbStats = { animalCount: 0, totalHayvanFiyati: 0, collectedTotal: 0, unpaidTotal: 0 };
      try {
        [kbStats, bbStats] = await Promise.all([
          getStats(supabase, s.yil),
          getBuyukbasStats(supabase, s.yil),
        ]);
      } catch (err) {
        console.error(`Stats error for season ${s.yil}:`, err);
      }

      return {
        ...s,
        kucukbasCount: kbStats.animalCount,
        buyukbasCount: bbStats.animalCount,
        totalAnimals: kbStats.animalCount + bbStats.animalCount,
        totalExpected: kbStats.total + bbStats.totalHayvanFiyati,
        totalCollected: kbStats.collectedTotal + bbStats.collectedTotal,
        totalUnpaid: kbStats.unpaidTotal + bbStats.unpaidTotal,
      };
    })
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">📅 Sezon ve Yıl Yönetimi</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Kurban sezonlarını yönetin, geçmiş yılları arşivleyin veya yeni kurban yılı açın.
        </p>
      </div>

      <SezonlarClient
        seasons={seasonsWithStats}
        activeYear={selected.year}
      />
    </div>
  );
}
