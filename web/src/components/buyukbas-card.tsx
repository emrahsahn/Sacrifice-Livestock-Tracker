"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { BuyukbasHayvanWithHissedarlar, BuyukbasHissedar, PaymentStatus } from "@/lib/types";
import { BUYUKBAS_GROUP_CATEGORIES, PAYMENT_OPTIONS } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  addBuyukbasHissedar,
  applyBuyukbasPartialPayment,
  updateBuyukbasHayvan,
  updateBuyukbasHissedar,
} from "@/actions/buyukbas";
import { formatMoneyInputTR, formatPhoneInputTR, parseMoneyTR, phoneToTelHref } from "@/lib/input-format";
import { isDistributionGroup } from "@/lib/buyukbas-utils";
import { formatPhoneDisplay, formatPrice, normalizePhone } from "@/lib/utils";
import { Plus } from "lucide-react";

function splitPaymentMethod(value: string | null | undefined) {
  const raw = value || "";
  const separatorIdx = raw.indexOf(" | ");
  if (separatorIdx === -1) {
    if (raw.includes("kalan borç") && raw.includes("ödendi")) {
      return { manualNote: "", autoNote: raw };
    }
    return { manualNote: raw, autoNote: "" };
  }
  return {
    manualNote: raw.slice(0, separatorIdx),
    autoNote: raw.slice(separatorIdx + 3),
  };
}

function paymentBadge(status: PaymentStatus) {
  const map: Record<PaymentStatus, "odendi" | "kismi" | "odenmedi" | "belirsiz"> = {
    Ödendi: "odendi",
    "Kısmi Ödeme": "kismi",
    Ödenmedi: "odenmedi",
    Belirsiz: "belirsiz",
  };
  return <Badge variant={map[status] ?? "belirsiz"}>{status}</Badge>;
}

type EditTarget =
  | { scope: "hayvan"; key: string; label: string }
  | { scope: "hissedar"; id: string; key: string; label: string }
  | { scope: "payment"; id: string; label: string };

interface BuyukbasCardProps {
  hayvan: BuyukbasHayvanWithHissedarlar;
  editable?: boolean;
  /** Güncelle sayfası gibi istemci önbelleğini yenilemek için */
  onUpdated?: () => void | Promise<void>;
}

export function BuyukbasCard({ hayvan, editable = true, onUpdated }: BuyukbasCardProps) {
  const router = useRouter();

  async function afterSave() {
    setEditOpen(false);
    setAddOpen(false);
    router.refresh();
    await onUpdated?.();
  }
  const soldHisse = useMemo(
    () => hayvan.hissedarlar.reduce((s, h) => s + Number(h.alinan_hisse ?? 0), 0),
    [hayvan.hissedarlar]
  );
  const freeHisse = Math.max(0, Number(hayvan.toplam_hisse) - soldHisse);
  const showAddress = isDistributionGroup(hayvan.group_category);

  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [editValue, setEditValue] = useState("");
  const [manualNote, setManualNote] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [addOpen, setAddOpen] = useState(false);
  const [addWhose, setAddWhose] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [addHisse, setAddHisse] = useState("1");
  const [addPrice, setAddPrice] = useState("");
  const [addAddress, setAddAddress] = useState("");
  const [addPayStatus, setAddPayStatus] = useState<PaymentStatus>("Belirsiz");

  const activeHissedar = useMemo(() => {
    if (!editTarget || editTarget.scope === "hayvan") return undefined;
    return hayvan.hissedarlar.find((h) => h.id === editTarget.id);
  }, [editTarget, hayvan.hissedarlar]);

  function openHayvanEdit(label: string, key: string, value: string) {
    if (!editable) return;
    setEditTarget({ scope: "hayvan", key, label });
    if (key === "hayvan_fiyati") {
      setEditValue(formatMoneyInputTR(String(value)));
    } else {
      setEditValue(value);
    }
    setManualNote("");
    setPaidAmount("");
    setError("");
    setEditOpen(true);
  }

  function openHissedarEdit(hs: BuyukbasHissedar, label: string, key: string, value: string) {
    if (!editable) return;
    if (key === "payment_method" || key === "payment_status") {
      setEditTarget({ scope: "payment", id: hs.id, label: "Ödeme Bilgileri" });
      const { manualNote: m } = splitPaymentMethod(hs.payment_method);
      setManualNote(m || "");
      setEditValue(hs.payment_status);
      setPaidAmount("");
    } else {
      setEditTarget({ scope: "hissedar", id: hs.id, key, label });
      if (key === "price") setEditValue(formatMoneyInputTR(String(value)));
      else if (key === "phone_number") setEditValue(formatPhoneDisplay(value));
      else setEditValue(value);
      setManualNote("");
      setPaidAmount("");
    }
    setError("");
    setEditOpen(true);
  }

  async function handleSaveEdit() {
    if (!editTarget) return;
    setError("");
    setSubmitting(true);
    try {
      if (editTarget.scope === "payment" && activeHissedar) {
        if (editValue === "Kısmi Ödeme") {
          if (!paidAmount.trim()) {
            setError("Kısmi ödeme için ödenen tutarı girin.");
            return;
          }
          const result = await applyBuyukbasPartialPayment(activeHissedar.id, paidAmount, manualNote);
          if (result?.error) setError(result.error);
          else {
            await afterSave();
          }
          return;
        }
        if (editValue === "Ödendi") {
          const paidAll = Math.max(0, Number(activeHissedar.price ?? 0));
          const autoNote = `${formatPrice(paidAll)} ₺ ödendi; kalan borç ${formatPrice(0)} ₺`;
          const payment_method = manualNote.trim()
            ? `${manualNote.trim()} | ${autoNote}`
            : autoNote;
          const result = await updateBuyukbasHissedar(activeHissedar.id, {
            payment_status: editValue,
            payment_method,
            price: 0,
          });
          if (result?.error) setError(result.error);
          else {
            await afterSave();
          }
          return;
        }
        const result = await updateBuyukbasHissedar(activeHissedar.id, {
          payment_status: editValue,
          payment_method: manualNote,
        });
        if (result?.error) setError(result.error);
        else {
          await afterSave();
        }
        return;
      }

      let val = editValue.trim();
      const allowEmpty =
        editTarget.scope === "hayvan" &&
        (editTarget.key === "group_category" || editTarget.key === "note");

      if (editTarget.scope === "hissedar") {
        if (
          editTarget.key !== "note" &&
          editTarget.key !== "address" &&
          editTarget.key !== "phone_number" &&
          !val
        ) {
          setError("Yeni değer boş olamaz.");
          return;
        }
        if (editTarget.key === "phone_number" && val !== "") {
          const norm = normalizePhone(val);
          if (!norm) {
            setError("Geçerli bir telefon girin.");
            return;
          }
          val = norm;
        }
        if (editTarget.key === "price") {
          const n = parseMoneyTR(val);
          if (!Number.isFinite(n)) {
            setError("Geçerli bir fiyat girin.");
            return;
          }
          const result = await updateBuyukbasHissedar(editTarget.id, { price: n });
          if (result?.error) setError(result.error);
          else {
            await afterSave();
          }
          return;
        }
        if (editTarget.key === "alinan_hisse") {
          const n = parseInt(val, 10);
          if (!Number.isFinite(n) || n < 1) {
            setError("Hisse adedi en az 1 olmalıdır.");
            return;
          }
          const result = await updateBuyukbasHissedar(editTarget.id, { alinan_hisse: n });
          if (result?.error) setError(result.error);
          else {
            await afterSave();
          }
          return;
        }
        const result = await updateBuyukbasHissedar(editTarget.id, { [editTarget.key]: val });
        if (result?.error) setError(result.error);
        else {
          await afterSave();
        }
        return;
      }

      if (editTarget.scope !== "hayvan") return;

      if (!val && !allowEmpty) {
        setError("Yeni değer boş olamaz.");
        return;
      }
      if (editTarget.key === "number" && !/^\d+$/.test(val)) {
        setError("Büyükbaş numarası tek bir sayı olmalıdır.");
        return;
      }
      if (editTarget.key === "hayvan_fiyati") {
        const n = parseMoneyTR(val);
        if (!Number.isFinite(n) || n <= 0) {
          setError("Geçerli bir hayvan fiyatı girin.");
          return;
        }
        const result = await updateBuyukbasHayvan(hayvan.number, { hayvan_fiyati: n });
        if (result?.error) setError(result.error);
        else {
          await afterSave();
        }
        return;
      }
      if (editTarget.key === "toplam_hisse") {
        const n = parseInt(val, 10);
        if (!Number.isFinite(n) || n < 1) {
          setError("Toplam hisse en az 1 olmalıdır.");
          return;
        }
        const result = await updateBuyukbasHayvan(hayvan.number, { toplam_hisse: n });
        if (result?.error) setError(result.error);
        else {
          await afterSave();
        }
        return;
      }
      const result = await updateBuyukbasHayvan(hayvan.number, { [editTarget.key]: val });
      if (result?.error) setError(result.error);
      else {
        await afterSave();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddHissedar() {
    const alinan = parseInt(addHisse, 10);
    if (!Number.isFinite(alinan) || alinan < 1) {
      setError("Alınan hisse en az 1 olmalıdır.");
      return;
    }
    if (alinan > freeHisse) {
      setError(`En fazla ${freeHisse} boş hisse eklenebilir.`);
      return;
    }
    setSubmitting(true);
    setError("");
    const priceNum = addPrice.trim() ? parseMoneyTR(addPrice) : undefined;
    const result = await addBuyukbasHissedar(hayvan.number, {
      whose: addWhose,
      phone_number: addPhone,
      alinan_hisse: alinan,
      price: priceNum,
      payment_status: addPayStatus,
      address: addAddress,
    });
    setSubmitting(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setAddWhose("");
    setAddPhone("");
    setAddHisse("1");
    setAddPrice("");
    setAddAddress("");
    setAddPayStatus("Belirsiz");
    await afterSave();
  }

  const previewHayvan = useMemo((): BuyukbasHayvanWithHissedarlar => {
    const base = { ...hayvan, hissedarlar: hayvan.hissedarlar.map((h) => ({ ...h })) };
    if (!editTarget || !editOpen) return base;

    if (editTarget.scope === "hayvan") {
      if (editTarget.key === "hayvan_fiyati") {
        const n = parseMoneyTR(editValue);
        if (Number.isFinite(n)) base.hayvan_fiyati = n;
      } else if (editTarget.key === "toplam_hisse") {
        const n = parseInt(editValue, 10);
        if (Number.isFinite(n)) base.toplam_hisse = n;
      } else {
        (base as Record<string, unknown>)[editTarget.key] = editValue;
      }
      return base;
    }

    const hs = base.hissedarlar.find((h) => h.id === editTarget.id);
    if (!hs) return base;

    if (editTarget.scope === "payment") {
      hs.payment_status = editValue as PaymentStatus;
      if (editValue === "Kısmi Ödeme") {
        const paid = parseMoneyTR(paidAmount) || 0;
        const remaining = Math.max(0, Number(hs.price ?? 0) - paid);
        const auto = `${formatPrice(paid)} ₺ ödendi; kalan borç ${formatPrice(remaining)} ₺`;
        const { autoNote: prev } = splitPaymentMethod(hs.payment_method);
        hs.payment_method = manualNote
          ? `${manualNote} | ${prev ? `${prev}\n${auto}` : auto}`
          : ` | ${prev ? `${prev}\n${auto}` : auto}`;
        hs.price = remaining;
      } else if (editValue === "Ödendi") {
        hs.price = 0;
      }
      return base;
    }

    if (editTarget.key === "price") {
      const n = parseMoneyTR(editValue);
      if (Number.isFinite(n)) hs.price = n;
    } else if (editTarget.key === "alinan_hisse") {
      const n = parseInt(editValue, 10);
      if (Number.isFinite(n)) hs.alinan_hisse = n;
    } else {
      (hs as Record<string, unknown>)[editTarget.key] = editValue;
    }
    return base;
  }, [hayvan, editTarget, editOpen, editValue, manualNote, paidAmount]);

  return (
    <>
      <BuyukbasCardDisplay
        hayvan={hayvan}
        soldHisse={soldHisse}
        freeHisse={freeHisse}
        showAddress={showAddress}
        editable={editable}
        onHayvanFieldClick={editable ? openHayvanEdit : undefined}
        onHissedarFieldClick={editable ? openHissedarEdit : undefined}
        onAddHissedar={editable && freeHisse > 0 ? () => setAddOpen(true) : undefined}
      />

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>✏️ {editTarget?.label ?? "Güncelle"}</DialogTitle>
            <DialogDescription>
              Kaydı güncelleyin. Sağda kart önizlemesi görünür.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col md:flex-row gap-6 py-4">
            <div className="flex-1 space-y-4">
              {editTarget?.scope === "payment" ? (
                <PaymentEditFields
                  payStatus={editValue as PaymentStatus}
                  setPayStatus={(v) => {
                    setEditValue(v);
                    if (v !== "Kısmi Ödeme") setPaidAmount("");
                  }}
                  manualNote={manualNote}
                  setManualNote={setManualNote}
                  paidAmount={paidAmount}
                  setPaidAmount={setPaidAmount}
                  remaining={Number(activeHissedar?.price ?? 0)}
                />
              ) : editTarget?.key === "group_category" ? (
                <div className="space-y-2">
                  <Label>{editTarget.label}</Label>
                  <Select
                    value={editValue || "__none__"}
                    onValueChange={(v) => setEditValue(v === "__none__" ? "" : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Grup seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Seçilmedi —</SelectItem>
                      {BUYUKBAS_GROUP_CATEGORIES.map((g) => (
                        <SelectItem key={g} value={g}>
                          {g}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : editTarget?.key === "note" || editTarget?.key === "address" ? (
                <div className="space-y-2">
                  <Label>{editTarget.label}</Label>
                  <Textarea value={editValue} onChange={(e) => setEditValue(e.target.value)} rows={3} />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>{editTarget?.label}</Label>
                  <Input
                    value={editValue}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (editTarget?.key === "hayvan_fiyati" || editTarget?.key === "price") {
                        setEditValue(formatMoneyInputTR(v));
                      } else if (editTarget?.key === "phone_number") {
                        setEditValue(formatPhoneInputTR(v));
                      } else {
                        setEditValue(v);
                      }
                    }}
                    inputMode={
                      editTarget?.key === "hayvan_fiyati" || editTarget?.key === "price"
                        ? "decimal"
                        : editTarget?.key === "phone_number"
                          ? "tel"
                          : editTarget?.key === "toplam_hisse" || editTarget?.key === "alinan_hisse"
                            ? "numeric"
                            : undefined
                    }
                  />
                </div>
              )}
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button className="w-full" onClick={handleSaveEdit} disabled={submitting}>
                {submitting ? "Kaydediliyor..." : "💾 Kaydet"}
              </Button>
            </div>
            <div className="flex-1 bg-neutral-100 dark:bg-neutral-900/50 p-4 rounded-xl border border-border">
              <BuyukbasCardDisplay
                hayvan={previewHayvan}
                soldHisse={previewHayvan.hissedarlar.reduce(
                  (s, h) => s + Number(h.alinan_hisse ?? 0),
                  0
                )}
                freeHisse={Math.max(
                  0,
                  Number(previewHayvan.toplam_hisse) -
                    previewHayvan.hissedarlar.reduce((s, h) => s + Number(h.alinan_hisse ?? 0), 0)
                )}
                showAddress={isDistributionGroup(previewHayvan.group_category)}
                editable={false}
                isPreview
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Hissedar Ekle — #{hayvan.number}</DialogTitle>
            <DialogDescription>
              Boş hisse: <strong>{freeHisse}</strong> · Birim: {formatPrice(Number(hayvan.hisse_birim_fiyat))} ₺
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Sahip</Label>
              <Input value={addWhose} onChange={(e) => setAddWhose(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Alınan Hisse *</Label>
              <Input
                type="number"
                min={1}
                max={freeHisse}
                value={addHisse}
                onChange={(e) => setAddHisse(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Telefon</Label>
              <Input
                value={addPhone}
                onChange={(e) => setAddPhone(formatPhoneInputTR(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Kalan / Fiyat (TL)</Label>
              <Input
                inputMode="decimal"
                placeholder="Boş = otomatik"
                value={addPrice}
                onChange={(e) => setAddPrice(formatMoneyInputTR(e.target.value))}
              />
            </div>
            {showAddress && (
              <div className="space-y-2">
                <Label>📍 Adres</Label>
                <Input value={addAddress} onChange={(e) => setAddAddress(e.target.value)} />
              </div>
            )}
            <div className="space-y-2">
              <Label>Ödeme Durumu</Label>
              <Select value={addPayStatus} onValueChange={(v) => setAddPayStatus(v as PaymentStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_OPTIONS.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button className="w-full" onClick={handleAddHissedar} disabled={submitting}>
              {submitting ? "Ekleniyor..." : "Hissedarı Kaydet"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PaymentEditFields({
  payStatus,
  setPayStatus,
  manualNote,
  setManualNote,
  paidAmount,
  setPaidAmount,
  remaining,
}: {
  payStatus: PaymentStatus;
  setPayStatus: (v: PaymentStatus) => void;
  manualNote: string;
  setManualNote: (v: string) => void;
  paidAmount: string;
  setPaidAmount: (v: string) => void;
  remaining: number;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Ödeme Notu</Label>
        <Textarea value={manualNote} onChange={(e) => setManualNote(e.target.value)} rows={2} />
      </div>
      <div className="space-y-2">
        <Label>Ödeme Durumu</Label>
        <Select value={payStatus} onValueChange={(v) => setPayStatus(v as PaymentStatus)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAYMENT_OPTIONS.map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {payStatus === "Kısmi Ödeme" && (
        <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">
            Kalan: <span className="font-semibold">{formatPrice(remaining)} ₺</span>
          </p>
          <Label>Ödenen tutar (TL)</Label>
          <Input
            inputMode="decimal"
            value={paidAmount}
            onChange={(e) => setPaidAmount(formatMoneyInputTR(e.target.value))}
          />
        </div>
      )}
    </div>
  );
}

function BuyukbasCardDisplay({
  hayvan,
  soldHisse,
  freeHisse,
  showAddress,
  editable,
  onHayvanFieldClick,
  onHissedarFieldClick,
  onAddHissedar,
  isPreview,
}: {
  hayvan: BuyukbasHayvanWithHissedarlar;
  soldHisse: number;
  freeHisse: number;
  showAddress: boolean;
  editable?: boolean;
  onHayvanFieldClick?: (label: string, key: string, value: string) => void;
  onHissedarFieldClick?: (hs: BuyukbasHissedar, label: string, key: string, value: string) => void;
  onAddHissedar?: () => void;
  isPreview?: boolean;
}) {
  const birim = Number(hayvan.hisse_birim_fiyat ?? 0);
  const clickRow = editable && onHayvanFieldClick;

  return (
    <div
      className={`group flex flex-col rounded-xl border-2 border-border bg-card p-4 sm:p-5 shadow-sm ${
        !isPreview ? "premium-card-interactive" : ""
      }`}
    >
      <div className="flex items-center justify-between border-b border-border pb-3 mb-3 gap-2">
        <span
          className={`text-lg sm:text-xl font-extrabold text-destructive ${clickRow ? "cursor-pointer hover:opacity-80" : ""}`}
          onClick={() => onHayvanFieldClick?.("Hayvan Numarası", "number", hayvan.number)}
        >
          #{hayvan.number}
        </span>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          <span className="rounded-full bg-violet-500/15 border border-violet-500/30 px-2 py-0.5 text-[10px] font-semibold text-violet-600 dark:text-violet-300">
            Büyükbaş
          </span>
          {hayvan.group_category && (
            <span
              className={`rounded-full bg-primary/15 border border-primary/30 px-2 py-0.5 text-[10px] font-semibold text-primary truncate max-w-[140px] ${clickRow ? "cursor-pointer" : ""}`}
              onClick={() =>
                onHayvanFieldClick?.("Grup Kategorisi", "group_category", hayvan.group_category ?? "")
              }
            >
              📂 {hayvan.group_category}
            </span>
          )}
          <span
            className={`rounded-full bg-primary px-2.5 py-0.5 text-xs font-bold text-primary-foreground ${clickRow ? "cursor-pointer" : ""}`}
            onClick={() => onHayvanFieldClick?.("Cins", "type", hayvan.type || "")}
          >
            {hayvan.type || "—"}
          </span>
        </div>
      </div>

      <div className="space-y-1.5 text-sm mb-3">
        {[
          ["Özellik", "special", hayvan.special],
          ["Küpe", "color_of_earring", hayvan.color_of_earring],
          ["Hayvan Rengi", "color_of_animal", hayvan.color_of_animal],
          ["Sıkılan Boya", "spray_paint_color", hayvan.spray_paint_color],
          ["Kimden", "from_whom", hayvan.from_whom],
          ["Toplam Hisse", "toplam_hisse", String(hayvan.toplam_hisse)],
          ["Hayvan Fiyatı", "hayvan_fiyati", String(hayvan.hayvan_fiyati)],
        ].map(([label, key, val]) => (
          <InfoRow
            key={key}
            label={label}
            value={key === "hayvan_fiyati" ? `${formatPrice(Number(val))} ₺` : val}
            gold={key === "hayvan_fiyati"}
            bold={key === "toplam_hisse"}
            onClick={
              clickRow
                ? () =>
                    onHayvanFieldClick!(
                      label,
                      key,
                      key === "hayvan_fiyati" ? String(hayvan.hayvan_fiyati) : val
                    )
                : undefined
            }
          />
        ))}
        <InfoRow label="Hisse Birim" value={`${formatPrice(birim)} ₺ / hisse`} />
        {(hayvan.note || clickRow) && (
          <div
            className={`border-t border-dashed border-border pt-2 mt-2 ${clickRow ? "cursor-pointer hover:bg-muted/40 rounded px-1" : ""}`}
            onClick={() => onHayvanFieldClick?.("Not", "note", hayvan.note ?? "")}
          >
            <p className="text-green font-semibold text-sm">Not</p>
            <p className="text-sm text-muted-foreground text-right whitespace-pre-wrap">
              {(hayvan.note ?? "").trim() || "—"}
            </p>
          </div>
        )}
      </div>

      <div className="border-t border-border pt-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Hissedarlar ({hayvan.hissedarlar.length})
          </p>
          {onAddHissedar && (
            <Button type="button" variant="outline" size="sm" onClick={onAddHissedar}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Hissedar Ekle
            </Button>
          )}
        </div>
        {hayvan.hissedarlar.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Henüz hissedar yok.</p>
        ) : (
          <div className="space-y-2">
            {hayvan.hissedarlar.map((hs) => (
              <HissedarRow
                key={hs.id}
                hs={hs}
                showAddress={showAddress}
                onFieldClick={onHissedarFieldClick}
              />
            ))}
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3 text-sm">
        <span className="text-muted-foreground">
          Doluluk: <strong className="text-foreground">{soldHisse}/{hayvan.toplam_hisse}</strong>
          {freeHisse > 0 && (
            <span className="text-amber-600 dark:text-amber-400 ml-1">({freeHisse} boş)</span>
          )}
        </span>
        <span className="font-extrabold text-gold">{formatPrice(Number(hayvan.hayvan_fiyati))} ₺</span>
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  bold,
  gold,
  onClick,
}: {
  label: string;
  value: string;
  bold?: boolean;
  gold?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      className={`flex justify-between gap-2 border-b border-dashed border-border pb-1 ${onClick ? "cursor-pointer hover:bg-muted/40 rounded px-1 -mx-1" : ""}`}
      onClick={onClick}
    >
      <span className="text-green font-semibold shrink-0">{label}</span>
      <span
        className={`text-right truncate ${gold ? "text-gold font-bold" : bold ? "font-bold text-foreground" : "text-muted-foreground"}`}
      >
        {value || "—"}
      </span>
    </div>
  );
}

function HissedarRow({
  hs,
  showAddress,
  onFieldClick,
}: {
  hs: BuyukbasHissedar;
  showAddress: boolean;
  onFieldClick?: (hs: BuyukbasHissedar, label: string, key: string, value: string) => void;
}) {
  const phoneDisplay = formatPhoneDisplay(hs.phone_number);
  const tel = phoneToTelHref(hs.phone_number);
  const click = onFieldClick ? (label: string, key: string, value: string) => onFieldClick(hs, label, key, value) : undefined;

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-2.5 space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <div
          className={`min-w-0 flex-1 ${click ? "cursor-pointer hover:opacity-80" : ""}`}
          onClick={() => click?.("Sahip", "whose", hs.whose || "")}
        >
          <p className="font-semibold text-foreground truncate">{hs.whose || "—"}</p>
          <p
            className={`text-xs text-muted-foreground ${click ? "cursor-pointer" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              click?.("Alınan Hisse", "alinan_hisse", String(hs.alinan_hisse));
            }}
          >
            {hs.alinan_hisse} hisse · Anlaşılan {formatPrice(Number(hs.agreed_total))} ₺
          </p>
          {phoneDisplay && tel ? (
            <a
              href={tel}
              className="text-xs text-primary hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {phoneDisplay}
            </a>
          ) : phoneDisplay ? (
            <span
              className={`text-xs text-muted-foreground ${click ? "cursor-pointer" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                click?.("Telefon", "phone_number", hs.phone_number);
              }}
            >
              {phoneDisplay}
            </span>
          ) : click ? (
            <span
              className="text-xs text-muted-foreground/60 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                click("Telefon", "phone_number", "");
              }}
            >
              Telefon ekle
            </span>
          ) : null}
        </div>
        <div
          className={`shrink-0 flex flex-col items-end gap-1 ${click ? "cursor-pointer" : ""}`}
          onClick={() => click?.("Ödeme", "payment_status", hs.payment_status)}
        >
          {paymentBadge(hs.payment_status)}
          <span
            className="text-sm font-bold text-gold"
            onClick={(e) => {
              e.stopPropagation();
              click?.("Kalan Fiyat", "price", String(hs.price));
            }}
          >
            {formatPrice(Number(hs.price))} ₺
          </span>
        </div>
      </div>
      {showAddress && (hs.address || click) && (
        <div
          className={`text-xs border-t border-dashed border-border pt-1.5 ${click ? "cursor-pointer hover:bg-muted/50 rounded px-1" : ""}`}
          onClick={() => click?.("Adres", "address", hs.address || "")}
        >
          <span className="text-green font-semibold">📍 </span>
          <span className="text-muted-foreground">{hs.address?.trim() || "—"}</span>
        </div>
      )}
    </div>
  );
}
