"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { searchByNumber, searchBuyukbasByNumber } from "@/lib/supabase/queries";
import type { BuyukbasHayvanWithHissedarlar, Customer } from "@/lib/types";
import { deleteCustomer } from "@/actions/customers";
import { deleteBuyukbasHayvan } from "@/actions/buyukbas";
import { BuyukbasCard } from "@/components/buyukbas-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CustomerCard } from "@/components/customer-card";
import { AlertTriangle, Search, Trash2 } from "lucide-react";
import { formatPhoneDisplay, formatPrice, parseAnimalNumbers } from "@/lib/utils";

function clearPaymentAutoHistory(randomId: string) {
  try {
    window.localStorage.removeItem(`payment-auto-history:${randomId}`);
  } catch {
    // localStorage erişim hataları silme akışını bozmamalı
  }
}

export function DeleteClient() {
  const router = useRouter();
  const [searchNum, setSearchNum] = useState("");
  const [matches, setMatches] = useState<Customer[]>([]);
  const [preview, setPreview] = useState<Customer | null>(null);
  const [buyukbasPreview, setBuyukbasPreview] = useState<BuyukbasHayvanWithHissedarlar | null>(null);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function handleSearch() {
    if (!searchNum.trim()) return;
    setSearching(true);
    setError("");
    setMatches([]);
    setPreview(null);
    setBuyukbasPreview(null);
    const supabase = createClient();
    try {
      const [res, bRes] = await Promise.all([
        searchByNumber(supabase, searchNum.trim()),
        searchBuyukbasByNumber(supabase, searchNum.trim()),
      ]);
      setMatches(res);
      if (bRes.length === 1) setBuyukbasPreview(bRes[0]);
      if (res.length === 1) setPreview(res[0]);
      if (res.length === 0 && bRes.length === 0) {
        setError(`"${searchNum.trim()}" hayvan numarasıyla eşleşen kayıt bulunamadı.`);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Arama sırasında hata oluştu.");
    } finally {
      setSearching(false);
    }
  }

  async function handleDelete() {
    if (!preview && !buyukbasPreview) return;
    setDeleting(true);
    setError("");

    if (buyukbasPreview) {
      const result = await deleteBuyukbasHayvan(buyukbasPreview.number);
      if (result?.error) {
        setError(result.error);
        setDeleting(false);
        return;
      }
      setOpen(false);
      setBuyukbasPreview(null);
      setPreview(null);
      setMatches([]);
      setSearchNum("");
      router.refresh();
      setDeleting(false);
      return;
    }

    const result = await deleteCustomer({
      random_id: preview!.random_id,
      number: preview!.number,
    });
    if (result?.error) {
      setError(result.error);
      setDeleting(false);
    } else {
      clearPaymentAutoHistory(preview!.random_id);
      setOpen(false);
      setPreview(null);
      setMatches([]);
      setSearchNum("");
      router.refresh();
      setDeleting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 px-5 py-4 text-sm text-foreground">
        <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
        <div>
          Önce hayvan numarasını arayın; doğru kaydı gördükten sonra silebilirsiniz.{" "}
          <strong className="text-destructive">Bu işlem geri alınamaz!</strong>
        </div>
      </div>

      <div className="group premium-card-interactive animate-fade-slide-in rounded-xl border-2 border-border bg-card p-4 md:p-6 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="sil-search-num">Hayvan numarası</Label>
          <div className="flex gap-2">
            <Input
              id="sil-search-num"
              value={searchNum}
              onChange={(e) => setSearchNum(e.target.value)}
              placeholder="Örn: 101"
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <Button variant="outline" size="icon" onClick={handleSearch} disabled={searching}>
              <Search className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Tek bir numara girmeniz yeterli. Aynı numarayı içeren tüm gruplar listelenir.
          </p>
        </div>

        {matches.length > 1 && (
          <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
            <Label>{matches.length} kayıt bulundu — silmek istediğinizi seçin</Label>
            <div className="space-y-1.5 max-h-56 overflow-y-auto">
              {matches.map((m, i) => {
                const isSelected = preview?.random_id === m.random_id && preview?.number === m.number;
                const animals = parseAnimalNumbers(m.number);
                const matchKey = m.random_id || `${m.phone_number}-${m.number}-${i}`;
                return (
                  <button
                    key={matchKey}
                    type="button"
                    onClick={() => setPreview(m)}
                    className={`w-full text-left rounded-md border px-3 py-2 text-xs transition-colors ${
                      isSelected
                        ? "border-destructive bg-destructive/10"
                        : "border-border bg-card hover:bg-accent/50"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-1 mb-0.5">
                      {animals.map((n, i) => (
                        <span key={`${n}-${i}`} className="font-bold text-destructive">
                          #{n}{i < animals.length - 1 ? "," : ""}
                        </span>
                      ))}
                    </div>
                    <div className="text-muted-foreground truncate">
                      {m.whose || "—"} · {formatPhoneDisplay(m.phone_number) || "—"} · {formatPrice(Number(m.price ?? 0))} ₺
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {buyukbasPreview && (
          <>
            <p className="text-xs text-muted-foreground">
              Silinecek büyükbaş hayvan ({buyukbasPreview.hissedarlar.length} hissedar ile birlikte):
            </p>
            <BuyukbasCard hayvan={buyukbasPreview} editable={false} />
          </>
        )}

        {preview && !buyukbasPreview && (
          <>
            <p className="text-xs text-muted-foreground">Silinecek küçükbaş kayıt özeti:</p>
            <CustomerCard customer={preview} />
          </>
        )}

        {!preview && !buyukbasPreview && matches.length === 0 && !error && !searching && (
          <p className="text-sm text-muted-foreground text-center py-6">
            Numarayı girip arama yapın.
          </p>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button
          type="button"
          variant="destructive"
          className="w-full"
          disabled={!preview && !buyukbasPreview}
          onClick={() => setOpen(true)}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Kaydı Sil
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Emin misiniz?</DialogTitle>
            <DialogDescription>
              {buyukbasPreview && (
                <>
                  Büyükbaş <strong>#{buyukbasPreview.number}</strong> ve{" "}
                  <strong>{buyukbasPreview.hissedarlar.length}</strong> hissedar kaydı kalıcı olarak
                  silinecektir. Bu işlem geri alınamaz.
                </>
              )}
              {preview && !buyukbasPreview && (
                <>
                  <strong>#{preview.number}</strong> numaralı küçükbaş kayıt ({preview.whose || "isimsiz"} ·{" "}
                  {formatPhoneDisplay(preview.phone_number) || "telefonsuz"}) kalıcı olarak silinecektir.
                  Bu işlem geri alınamaz.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Vazgeç
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting || (!preview && !buyukbasPreview)}
            >
              {deleting ? "Siliniyor..." : "Evet, Kalıcı Olarak Sil"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
