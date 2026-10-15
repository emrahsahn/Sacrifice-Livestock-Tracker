import { createClient } from "@/lib/supabase/server";
import { getBuyukbasHayvanlar, getCustomers } from "@/lib/supabase/queries";
import { getSelectedYear } from "@/lib/season";
import { CustomersClient } from "./customers-client";

export const dynamic = "force-dynamic";

export default async function MusterilerPage() {
  const supabase = await createClient();
  const { year, season } = await getSelectedYear(supabase);
  const [customers, buyukbasHayvanlar] = await Promise.all([
    getCustomers(supabase, year),
    getBuyukbasHayvanlar(supabase, year),
  ]);

  const isClosed = season.durum === "kapali";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-foreground">📋 Kayıtlı Tüm Müşteriler</h1>
          <p className="text-sm text-muted-foreground mt-1">
            <strong>{season.ad} ({year})</strong> · Küçükbaş <strong>{customers.length}</strong> kayıt · Büyükbaş{" "}
            <strong>{buyukbasHayvanlar.length}</strong> hayvan
          </p>
        </div>
        {isClosed && (
          <span className="self-start sm:self-auto px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
            🔒 Kapalı Sezon (Salt Okunur)
          </span>
        )}
      </div>
      <CustomersClient
        initialCustomers={customers}
        initialBuyukbas={buyukbasHayvanlar}
        editable={!isClosed}
      />
    </div>
  );
}
