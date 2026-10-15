import { createClient } from "@/lib/supabase/server";
import { getSeasons } from "@/lib/season";
import { getBuyukbasHayvanlar, getCustomers } from "@/lib/supabase/queries";
import { computeAnalytics } from "@/lib/analytics";
import { AnalizClient } from "./analiz-client";

export const dynamic = "force-dynamic";

export default async function AnalizPage() {
  const supabase = await createClient();
  const [seasons, allCustomers, allBuyukbas] = await Promise.all([
    getSeasons(supabase),
    getCustomers(supabase),
    getBuyukbasHayvanlar(supabase),
  ]);

  const report = computeAnalytics(seasons, allCustomers, allBuyukbas);

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">📈 Çok Yıllı Sezon Analitiği</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Yıllara göre ciro, tahsilat, hayvan sayıları, hisse doluluk oranları ve müşteri sadakati analizi.
        </p>
      </div>

      <AnalizClient report={report} />
    </div>
  );
}
