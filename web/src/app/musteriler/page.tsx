import { createClient } from "@/lib/supabase/server";
import { getBuyukbasHayvanlar, getCustomers } from "@/lib/supabase/queries";
import { CustomersClient } from "./customers-client";

export const dynamic = "force-dynamic";

export default async function MusterilerPage() {
  const supabase = await createClient();
  const [customers, buyukbasHayvanlar] = await Promise.all([
    getCustomers(supabase),
    getBuyukbasHayvanlar(supabase),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">📋 Kayıtlı Tüm Müşteriler</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Küçükbaş <strong>{customers.length}</strong> kayıt · Büyükbaş{" "}
          <strong>{buyukbasHayvanlar.length}</strong> hayvan
        </p>
      </div>
      <CustomersClient
        initialCustomers={customers}
        initialBuyukbas={buyukbasHayvanlar}
      />
    </div>
  );
}
