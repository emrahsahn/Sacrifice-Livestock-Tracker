"use client";
import { useState } from "react";
import { runCustomerSearch, type SearchQueryType } from "@/actions/search";
import type { BuyukbasHayvanWithHissedarlar, Customer } from "@/lib/types";
import { BuyukbasCard } from "@/components/buyukbas-card";
import { CustomerCard } from "@/components/customer-card";
import { CustomerHistoryPanel } from "@/components/customer-history-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";

const queryOptions: { value: SearchQueryType; label: string }[] = [
  { value: "numara", label: "Numaraya Göre" },
  { value: "sahip", label: "Sahibe Göre" },
  { value: "numara_sahip", label: "Numara ve Sahibe Göre" },
  { value: "tur", label: "Türe Göre" },
  { value: "telefon", label: "Telefon Numarasına Göre" },
];

export default function SorgulaPage() {
  const [qType, setQType] = useState<SearchQueryType>("numara");
  const [num, setNum] = useState("");
  const [owner, setOwner] = useState("");
  const [kind, setKind] = useState("");
  const [phone, setPhone] = useState("");
  const [results, setResults] = useState<Customer[] | null>(null);
  const [buyukbasResults, setBuyukbasResults] = useState<BuyukbasHayvanWithHissedarlar[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBuyukbasResults(null);
    setResults(null);
    setLoading(true);

    try {
      const result = await runCustomerSearch(qType, {
        num,
        owner,
        kind,
        phone,
      });

      if ("error" in result) {
        setError(result.error);
        return;
      }

      setResults(result.customers);
      setBuyukbasResults(result.buyukbas);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground text-center">🔍 Müşteri Sorgulama</h1>

      <div className="grid gap-x-6 gap-y-4 lg:grid-cols-2 lg:items-start">
        <h2 className="font-semibold text-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0 lg:col-start-1 lg:row-start-1">
          <span>📋 Sorgu Formu</span>
        </h2>
        <h2 className="font-semibold text-foreground lg:col-start-2 lg:row-start-1">
          📋 Sorgu Sonuçları
        </h2>

        <div className="group premium-card-interactive animate-fade-slide-in rounded-xl border-2 border-border bg-card p-4 md:p-6 space-y-5 h-fit w-full min-w-0 self-start lg:col-start-1 lg:row-start-2">
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="space-y-2">
              <h2 className="font-semibold text-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0 lg:col-start-1 lg:row-start-1" aria-hidden>🎯 Sorgu Detayları </h2>
              <Label>Sorgulama Yöntemi</Label>
              <Select value={qType} onValueChange={(v) => { setQType(v as SearchQueryType); setResults(null); setBuyukbasResults(null); }}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {queryOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4">
              {(qType === "numara" || qType === "numara_sahip") && (
                <div className="space-y-2">
                  <Label htmlFor="num">🔢 Hayvan Numarası</Label>
                  <Input id="num" value={num} onChange={(e) => setNum(e.target.value)} placeholder="Örn: 101" />
                </div>
              )}
              {(qType === "sahip" || qType === "numara_sahip") && (
                <div className="space-y-2">
                  <Label htmlFor="owner">👤 Sahip İsmi (kısmi arama)</Label>
                  <Input id="owner" value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Sahip adı" />
                </div>
              )}
              {qType === "tur" && (
                <div className="space-y-2">
                  <Label htmlFor="kind">🐑 Hayvan Türü / Cinsi (kısmi arama)</Label>
                  <Input id="kind" value={kind} onChange={(e) => setKind(e.target.value)} placeholder="Örn: Koç" />
                </div>
              )}
              {qType === "telefon" && (
                <div className="space-y-2">
                  <Label htmlFor="phone">📞 Telefon Numarası</Label>
                  <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Örn: 0532 123 45 67" />
                </div>
              )}
            </div>

            {error && <p className="text-sm font-medium text-destructive">{error}</p>}

            <Button type="submit" disabled={loading} className="w-full">
              <Search className="h-4 w-4 mr-2" />
              {loading ? "Aranıyor..." : "Sistemi Sorgula"}
            </Button>
          </form>
        </div>

        <div className="space-y-4 min-w-0 lg:col-start-2 lg:row-start-2">
          {results === null && buyukbasResults === null ? (
            <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
              Sorguyu çalıştırarak sonuçları burada görüntüleyin.
            </div>
          ) : (results?.length ?? 0) === 0 && (buyukbasResults?.length ?? 0) === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
              Eşleşen kayıt bulunamadı.
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                <strong>{(results?.length ?? 0) + (buyukbasResults?.length ?? 0)}</strong> sonuç
              </p>
              <div className="space-y-6">
                {(buyukbasResults ?? []).map((h) => (
                  <BuyukbasCard key={h.number} hayvan={h} />
                ))}
                {(results ?? []).map((c, i) => (
                  <div
                    key={c.random_id || `${c.phone_number}-${c.number}-${i}`}
                    className="space-y-3"
                  >
                    <CustomerCard customer={c} />
                    <CustomerHistoryPanel
                      hayvanNumber={c.number}
                      randomId={c.random_id}
                      currentCustomer={c}
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
