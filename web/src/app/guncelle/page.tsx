"use client";
import { useState, useEffect, useMemo } from "react";
import {
  fetchCustomerByKey,
  searchByNumberPreview,
} from "@/actions/search";
import type { BuyukbasHayvanWithHissedarlar } from "@/lib/types";
import { BuyukbasCard } from "@/components/buyukbas-card";
import { applyPartialPayment, updateCustomerField, updateCustomerFields } from "@/actions/customers";
import type { Customer, CustomerKey } from "@/lib/types";
import { PAYMENT_OPTIONS, GROUP_CATEGORIES } from "@/lib/types";
import { CustomerCard } from "@/components/customer-card";
import { CustomerHistoryPanel } from "@/components/customer-history-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Search } from "lucide-react";
import {
  formatPrice,
  formatPhoneDisplay,
  normalizePhone,
  parseAnimalNumbers,
} from "@/lib/utils";
import { formatMoneyInputTR, formatPhoneInputTR, parseMoneyTR } from "@/lib/input-format";

const UPDATE_FIELDS = [
  { value: "number", label: "Numara" },
  { value: "type", label: "Cins" },
  { value: "special", label: "Özellik" },
  { value: "color_of_earring", label: "Küpe Rengi" },
  { value: "color_of_animal", label: "Hayvan Rengi" },
  { value: "spray_paint_color", label: "Sıkılan Boya" },
  { value: "whose", label: "Sahip" },
  { value: "from_whom", label: "Kimden" },
  { value: "price", label: "Fiyat (TL)" },
  { value: "phone_number", label: "Telefon Numarası" },
  { value: "payment_method", label: "Ödeme Yöntemi" },
  { value: "payment_status", label: "Ödeme Durumu" },
  { value: "group_category", label: "Grup Kategorisi" },
  { value: "address", label: "Adres" },
  { value: "note", label: "Not" },
];

export default function GuncelledPage() {
  const [searchNum, setSearchNum] = useState("");
  const [matches, setMatches] = useState<Customer[]>([]);
  const [preview, setPreview] = useState<Customer | null>(null);
  const [buyukbasPreview, setBuyukbasPreview] = useState<BuyukbasHayvanWithHissedarlar | null>(null);
  const [searching, setSearching] = useState(false);
  const [field, setField] = useState("type");
  const [newValue, setNewValue] = useState("");
  const [payStatus, setPayStatus] = useState("Belirsiz");
  const [groupCat, setGroupCat] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [historyRefresh, setHistoryRefresh] = useState(0);

  const compositeKey: CustomerKey | null = useMemo(() => {
    if (!preview) return null;
    return {
      random_id: preview.random_id,
      number: preview.number,
    };
  }, [preview]);

  function syncFormFromCustomer(c: Customer | null) {
    if (!c) {
      setPayStatus("Belirsiz");
      setGroupCat("");
      return;
    }
    setPayStatus(c.payment_status);
    setGroupCat(c.group_category ?? "");
  }

  useEffect(() => {
    if (!preview) return;
    if (field === "note") setNewValue(preview.note ?? "");
    else if (field === "address") setNewValue(preview.address ?? "");
  }, [preview, field]);

  async function handleSearch() {
    if (!searchNum.trim()) return;
    setSearching(true);
    setError("");
    setMatches([]);
    setPreview(null);
    setBuyukbasPreview(null);
    syncFormFromCustomer(null);
    try {
      const result = await searchByNumberPreview(searchNum.trim());
      if ("error" in result) {
        setError(result.error);
        return;
      }
      const { customers: res, buyukbas: bRes } = result;
      setMatches(res);
      if (bRes.length === 1) {
        setBuyukbasPreview(bRes[0]);
      }
      if (res.length === 1) {
        setPreview(res[0]);
        syncFormFromCustomer(res[0]);
      } else if (res.length === 0 && bRes.length === 0) {
        setError(`"${searchNum.trim()}" hayvan numarasıyla eşleşen kayıt bulunamadı.`);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Hata oluştu.");
    } finally {
      setSearching(false);
    }
  }

  async function refreshBuyukbasPreview() {
    if (!searchNum.trim()) return;
    const result = await searchByNumberPreview(searchNum.trim());
    if ("error" in result) return;
    if (result.buyukbas.length === 1) setBuyukbasPreview(result.buyukbas[0]);
  }

  async function refreshPreviewByKey(key: CustomerKey) {
    try {
      const next = await fetchCustomerByKey(key);
      setPreview(next);
      syncFormFromCustomer(next);
    } catch {
      // Sessizce yok say — sayfa yenilenirse tekrar yüklenecek.
    }
  }

  async function handleUpdate() {
    if (!preview || !compositeKey) return;
    setError("");
    setSubmitting(true);

    try {
      if (field === "payment_status" && payStatus === "Kısmi Ödeme") {
        if (!paidAmount.trim()) {
          setError("Kısmi ödeme için ödenen tutarı girin.");
          return;
        }
        const result = await applyPartialPayment(compositeKey, paidAmount);
        if (result?.error) {
          setError(result.error);
          return;
        }
        setSuccess(true);
        setPaidAmount("");
        await refreshPreviewByKey(compositeKey);
        setHistoryRefresh((k) => k + 1);
        setTimeout(() => setSuccess(false), 2000);
        return;
      }

      const value = field === "payment_status" ? payStatus
        : field === "group_category" ? (groupCat === "__none__" ? "" : groupCat)
        : newValue.trim();
      const allowEmpty =
        field === "group_category" ||
        field === "note" ||
        field === "address" ||
        field === "phone_number";
      if (!value && !allowEmpty) {
        setError("Yeni değer boş olamaz.");
        return;
      }

      if (field === "number" && !/^\d+(\s*,\s*\d+)*$/.test(value)) {
        setError("Hayvan numarası rakamlardan oluşmalı; birden fazla için virgülle ayırın (örn. 101, 102, 103).");
        return;
      }
      if (field === "price" && !Number.isFinite(parseMoneyTR(value))) {
        setError("Geçerli bir fiyat girin.");
        return;
      }
      if (field === "phone_number" && value !== "") {
        const norm = normalizePhone(value);
        if (!norm) {
          setError("Geçerli bir telefon girin. Örn: 0532 123 45 67");
          return;
        }
      }

      const result = field === "payment_status" && value === "Ödendi"
        ? await (() => {
            const rawPaymentMethod = preview.payment_method || "";
            const separatorIdx = rawPaymentMethod.indexOf(" | ");
            const existingManual = separatorIdx === -1 ? rawPaymentMethod : rawPaymentMethod.slice(0, separatorIdx);
            const paidAllAmount = Math.max(0, Number(preview.price ?? 0));
            const autoNote = `${formatPrice(paidAllAmount)} ₺ ödendi; kalan borç ${formatPrice(0)} ₺`;
            const payment_method = existingManual.trim()
              ? `${existingManual.trim()} | ${autoNote}`
              : autoNote;
            return updateCustomerFields(compositeKey, {
              payment_status: value,
              price: 0,
              payment_method,
            });
          })()
        : await updateCustomerField(compositeKey, field, value);
      if (result?.error) {
        setError(result.error);
      } else {
        setSuccess(true);
        setNewValue("");
        // Composite key parçalarından number güncellendiyse yeni key ile çek.
        const nextKey: CustomerKey = {
          random_id: compositeKey.random_id,
          number:
            field === "number"
              ? value
                  .split(",")
                  .map((s) => s.trim())
                  .filter((s) => s.length > 0)
                  .join(", ")
              : compositeKey.number,
        };
        await refreshPreviewByKey(nextKey);
        setHistoryRefresh((k) => k + 1);
        setTimeout(() => setSuccess(false), 2000);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Güncelleme hatası.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground text-center">🔄 Müşteri Bilgisi Güncelle</h1>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        {/* Sol panel - arama + güncelleme */}
        <div className="rounded-xl border border-border bg-card p-4 md:p-6 shadow-sm space-y-5 h-fit w-full min-w-0 self-start">
          <h2 className="font-semibold text-foreground">🎯 İşlem Detayları</h2>

          {/* Kayıt ara */}
          <div className="space-y-2">
            <Label>🔑 Hayvan Numarası</Label>
            <div className="flex gap-2">
              <Input
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

          {/* Birden fazla eşleşme — kayıt seçici */}
          {matches.length > 1 && (
            <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
              <Label>{matches.length} kayıt bulundu — birini seçin</Label>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {matches.map((m, i) => {
                  const isSelected = preview?.random_id === m.random_id && preview?.number === m.number;
                  const animals = parseAnimalNumbers(m.number);
                  const matchKey = m.random_id || `${m.phone_number}-${m.number}-${i}`;
                  return (
                    <button
                      key={matchKey}
                      type="button"
                      onClick={() => {
                        setPreview(m);
                        syncFormFromCustomer(m);
                      }}
                      className={`w-full text-left rounded-md border px-3 py-2 text-xs transition-colors ${
                        isSelected
                          ? "border-primary bg-primary/10"
                          : "border-border bg-card hover:bg-accent/50"
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-1 mb-0.5">
                        {animals.map((n, i) => (
                          <span key={`${n}-${i}`} className="font-bold text-destructive">#{n}{i < animals.length - 1 ? "," : ""}</span>
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

          {/* Alan seçimi */}
          <div className="space-y-2">
            <Label>Güncellenecek Alan</Label>
            <Select
              value={field}
              onValueChange={(v) => {
                setField(v);
                setPaidAmount("");
                if (preview && (v === "note" || v === "address")) {
                  setNewValue(v === "note" ? (preview.note ?? "") : (preview.address ?? ""));
                } else if (preview && v === "number") {
                  setNewValue(preview.number);
                } else if (preview && v === "phone_number") {
                  setNewValue(formatPhoneDisplay(preview.phone_number));
                } else {
                  setNewValue("");
                }
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UPDATE_FIELDS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Yeni değer */}
          <div className="space-y-2">
            <Label>✏️ Yeni Değer</Label>
            {field === "payment_status" ? (
              <div className="space-y-3">
                <Select
                  value={payStatus}
                  onValueChange={(v) => {
                    setPayStatus(v);
                    if (v !== "Kısmi Ödeme") setPaidAmount("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
                {payStatus === "Kısmi Ödeme" && preview && (
                  <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">
                      Mevcut kalan tutar (fiyat):{" "}
                      <span className="font-semibold text-foreground">
                        {formatPrice(Number(preview.price ?? 0))} ₺
                      </span>
                    </p>
                    <Label htmlFor="paid-partial">Ödenen miktar (TL)</Label>
                    <Input
                      id="paid-partial"
                      inputMode="decimal"
                      autoComplete="off"
                      value={paidAmount}
                      onChange={(e) => setPaidAmount(formatMoneyInputTR(e.target.value))}
                      placeholder="Örn: 5.000,50"
                    />
                  </div>
                )}
              </div>
            ) : field === "group_category" ? (
              <Select value={groupCat || "__none__"} onValueChange={setGroupCat}>
                <SelectTrigger>
                  <SelectValue placeholder="Grup Seçin" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Grup Seçilmedi —</SelectItem>
                  {GROUP_CATEGORIES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : field === "note" || field === "address" ? (
              <Textarea
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder={field === "address" ? "Adres" : "Not (en fazla 2000 karakter)"}
                rows={5}
                maxLength={field === "note" ? 2000 : undefined}
                className="resize-y min-h-[100px]"
              />
            ) : (
              <>
                <Input
                  value={newValue}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (field === "price") setNewValue(formatMoneyInputTR(v));
                    else if (field === "phone_number") setNewValue(formatPhoneInputTR(v));
                    else setNewValue(v);
                  }}
                  inputMode={field === "price" ? "decimal" : field === "phone_number" ? "tel" : undefined}
                  placeholder={
                    field === "price"
                      ? "Örn: 15.400,50"
                      : field === "phone_number"
                        ? "Örn: 0532 123 45 67"
                        : field === "number"
                          ? "Örn: 101 veya 101, 102, 103"
                          : "Yeni değer"
                  }
                />
                {field === "number" && (
                  <p className="text-xs text-muted-foreground">
                    Birden fazla hayvan için virgülle ayırın.
                  </p>
                )}
              </>
            )}
          </div>

          {success && (
            <div className="flex items-center gap-2 rounded-lg bg-green-700/20 border border-green-700 px-4 py-3 text-green-400 text-sm">
              <CheckCircle2 className="h-4 w-4" />
              Güncelleme başarılı!
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button className="w-full" onClick={handleUpdate} disabled={submitting || !preview}>
            {submitting ? "Güncelleniyor..." : "🔄 Bilgileri Güncelle"}
          </Button>

          {buyukbasPreview && !preview && (
            <p className="text-sm text-muted-foreground border-t border-border pt-4">
              Büyükbaş kaydı sağdaki karttan düzenlenir: alanlara tıklayarak güncelleyin, boş hisse varsa
              &quot;Hissedar Ekle&quot; ile yeni paydaş ekleyin.
            </p>
          )}
        </div>

        {/* Sağ panel - mevcut kayıt önizleme */}
        <div className="space-y-4 min-w-0">
          <h2 className="font-semibold text-foreground">👁️ Mevcut Kayıt</h2>
          {buyukbasPreview && !preview ? (
            <BuyukbasCard hayvan={buyukbasPreview} onUpdated={refreshBuyukbasPreview} />
          ) : preview ? (
            <>
              <CustomerCard customer={preview} />
              <CustomerHistoryPanel
                key={`${preview.random_id}-${historyRefresh}`}
                hayvanNumber={preview.number}
                randomId={preview.random_id}
                currentCustomer={preview}
              />
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
              {matches.length > 1
                ? "Yukarıdaki listeden bir kayıt seçin."
                : "Numarayı arayarak kaydı görüntüleyin."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
