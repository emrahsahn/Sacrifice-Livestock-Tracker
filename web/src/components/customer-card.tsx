"use client";

import { useMemo, useState } from "react";
import type { Customer, CustomerKey, PaymentStatus } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import {
  formatPrice,
  parseAnimalNumbers,
  formatPhoneDisplay,
  normalizePhone,
} from "@/lib/utils";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateCustomerField, applyPartialPayment, updateCustomerFields } from "@/actions/customers";
import { PAYMENT_OPTIONS, GROUP_CATEGORIES } from "@/lib/types";
import { formatMoneyInputTR, formatPhoneInputTR, parseMoneyTR, phoneToTelHref } from "@/lib/input-format";

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

function buildAutoRows(autoNoteString: string) {
  const seen = new Set<string>();
  const rows: string[] = [];
  const lines = autoNoteString.split('\n');
  for (const row of lines) {
    const line = row.trim();
    if (!line || seen.has(line)) continue;
    seen.add(line);
    rows.push(line);
  }
  const extractRemainingDebt = (line: string) => {
    const match = line.match(/kalan borç\s+(.+?)\s*₺/i);
    if (!match?.[1]) return Number.POSITIVE_INFINITY;
    const amount = parseMoneyTR(match[1]);
    return Number.isFinite(amount) ? amount : Number.POSITIVE_INFINITY;
  };

  return rows.sort((a, b) => extractRemainingDebt(a) - extractRemainingDebt(b));
}

function paymentBadge(status: PaymentStatus) {
  const map: Record<PaymentStatus, "odendi" | "kismi" | "odenmedi" | "belirsiz"> = {
    "Ödendi": "odendi",
    "Kısmi Ödeme": "kismi",
    "Ödenmedi": "odenmedi",
    "Belirsiz": "belirsiz",
  };
  return <Badge variant={map[status] ?? "belirsiz"}>{status}</Badge>;
}

/** Composite key alanlarını Customer'dan üretir. */
function customerKey(c: Customer): CustomerKey {
  return {
    random_id: c.random_id,
    number: c.number,
    yil: c.yil,
  };
}

const RECEIPT_DAILY_SEQ_KEY = "receiptDailySeq";

function localDateYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Bugün için bir sonraki önerilen sıra numarası (gün değişince 1). */
function readReceiptDailyNext(): number {
  if (typeof window === "undefined") return 1;
  try {
    const raw = localStorage.getItem(RECEIPT_DAILY_SEQ_KEY);
    if (!raw) return 1;
    const parsed = JSON.parse(raw) as { date?: string; next?: number };
    const today = localDateYmd();
    if (parsed.date !== today || typeof parsed.next !== "number" || !Number.isFinite(parsed.next)) {
      return 1;
    }
    return Math.max(1, Math.floor(parsed.next));
  } catch {
    return 1;
  }
}

/** Yazdırmadan sonra sayacı günceller: next = max(mevcut next, kullanılan) + 1 */
function persistReceiptDailyAfterPrint(usedSeq: number): void {
  if (typeof window === "undefined") return;
  const today = localDateYmd();
  let storedNext = 1;
  try {
    const raw = localStorage.getItem(RECEIPT_DAILY_SEQ_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { date?: string; next?: number };
      if (parsed.date === today && typeof parsed.next === "number" && Number.isFinite(parsed.next)) {
        storedNext = Math.max(1, Math.floor(parsed.next));
      }
    }
  } catch {
    /* ignore */
  }
  const next = Math.max(storedNext, usedSeq) + 1;
  localStorage.setItem(RECEIPT_DAILY_SEQ_KEY, JSON.stringify({ date: today, next }));
}

function printReceipt(customer: Customer, title: string, queueDisplay: string) {
  const iframe = document.createElement("iframe");
  iframe.style.display = "none";
  document.body.appendChild(iframe);

  const animals = parseAnimalNumbers(customer.number);
  const animalDisplay = animals.length > 1 ? animals.join(", ") : (animals[0] ?? customer.number);
  const isMulti = animals.length > 1;
  const animalNumberStyle = isMulti
    ? "text-30 font-black"
    : "text-40 font-black";

  const safeTitle = escapeHtml(title);
  const safeQueue = escapeHtml(queueDisplay);
  const safeAnimal = escapeHtml(String(animalDisplay));
  const safeWhose = escapeHtml(customer.whose || "-");
  const safePhone = escapeHtml(formatPhoneDisplay(customer.phone_number) || "-");
  const safeType = escapeHtml(customer.type || "-");
  const safeEarring = escapeHtml(customer.color_of_earring || "-");
  const safeSpray = escapeHtml(customer.spray_paint_color || "-");
  const safeAnimalColor = escapeHtml(customer.color_of_animal || "-");
  const safeSpecial = customer.special ? escapeHtml(customer.special) : "";

  const content = `
    <html>
      <head>
        <title>Fiş</title>
        <style>
          @page { margin: 0; size: 58mm auto; }
          body { 
            background: white;
            color: black;
            width: 58mm;
            padding: 3mm;
            margin: 0;
            font-family: 'Courier New', Courier, monospace;
            -webkit-print-color-adjust: exact;
          }
          .title { text-align: center; font-weight: bold; font-size: 13px; margin-bottom: 0; border-bottom: 1px solid black; padding-bottom: 8px; word-break: break-word; line-height: 1.2; }
          .queue-block { text-align: center; border-bottom: 1px solid black; padding: 8px 0 10px; margin-bottom: 10px; }
          .queue-label { font-size: 8px; letter-spacing: 1px; color: #555; font-weight: bold; text-transform: uppercase; }
          .queue-val { font-size: 10px; font-weight: 600; margin-top: 4px; color: #333; }
          .center { text-align: center; }
          .mb-3 { margin-bottom: 12px; }
          .text-10 { font-size: 10px; }
          .uppercase { text-transform: uppercase; }
          .font-black { font-weight: 900; }
          .text-40 { font-size: 40px; margin: 4px 0; line-height: 1; }
          .text-30 { font-size: 26px; margin: 4px 0; line-height: 1.05; word-break: break-word; }
          .flex { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 11px;}
          .font-bold { font-weight: bold; }
          .border-b { border-bottom: 1px dashed black; padding-bottom: 12px; margin-bottom: 12px; }
          .kupe-wrap { border-bottom: 1px solid black; padding-bottom: 10px; margin-bottom: 12px; }
          .italic { font-style: italic; }
          .mt-2 { margin-top: 8px; }
          .break-words { word-break: break-word; }
        </style>
      </head>
      <body>
        <div class="title">${safeTitle}</div>
        <div class="queue-block">
          <div class="queue-label">Sıra No</div>
          <div class="queue-val">${safeQueue}</div>
        </div>
        <div class="center kupe-wrap">
          <div class="text-10 uppercase font-bold" style="letter-spacing: 1px; color: #333;">${isMulti ? "Küpe Noları" : "Küpe No"}</div>
          <div class="${animalNumberStyle}">${safeAnimal}</div>
        </div>
        <div class="border-b">
          <div class="flex"><span class="font-bold">Tür/Cins:</span> <span class="break-words" style="text-align: right;">${safeType}</span></div>
          <div class="flex"><span class="font-bold">Küpe Rengi:</span> <span>${safeEarring}</span></div>
          <div class="flex"><span class="font-bold">Sıkılan Boya:</span> <span>${safeSpray}</span></div>
          <div class="flex"><span class="font-bold">Hayvan Rengi:</span> <span>${safeAnimalColor}</span></div>
          ${safeSpecial
      ? `<div class="mt-2" style="font-size: 9px; background: #f0f0f0; padding: 4px; border-radius: 2px;">
                   <div class="font-bold" style="margin-bottom: 2px;">Özellik:</div>
                   <div class="break-words" style="line-height: 1.2;">${safeSpecial}</div>
                 </div>`
      : ""
    }
        </div>
        <div class="border-b">
          <div class="flex"><span class="font-bold">Sahip:</span> <span class="uppercase break-words" style="text-align: right;">${safeWhose}</span></div>
          <div class="flex"><span class="font-bold">Telefon:</span> <span>${safePhone}</span></div>
        </div>
        <div class="center text-10 italic font-bold" style="margin-top: 16px; opacity: 0.9;">
          Bizi tercih ettiğiniz için<br>teşekkür ederiz.
        </div>
      </body>
    </html>
  `;

  const doc = iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(content);
    doc.close();
  }

  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();

    setTimeout(() => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }, 1000);
  }, 100);
}

interface CustomerCardInnerProps {
  c: Customer;
  onFieldClick?: (label: string, key: string, value: string) => void;
  onPrintClick?: () => void;
  isPreview?: boolean;
}

function CustomerCardInner({ c, onFieldClick, onPrintClick, isPreview }: CustomerCardInnerProps) {
  const { manualNote, autoNote } = splitPaymentMethod(c.payment_method);
  const autoRows = buildAutoRows(autoNote);
  const animals = parseAnimalNumbers(c.number);
  const phoneDisplay = formatPhoneDisplay(c.phone_number);

  const CardContent = (
    <div
      className={`group flex flex-col justify-between rounded-xl border-2 border-border bg-card p-3.5 sm:p-5 w-full min-w-0 overflow-hidden ${!isPreview ? "premium-card-interactive" : "shadow-sm"}`}
    >
      {/* Header */}
      <div>
        <div className="border-b border-border pb-3 mb-3 space-y-2">
          {/* Üst Satır: Hayvan Numarası ve Ödeme Durumu */}
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div
              className={`flex items-center gap-1.5 flex-wrap min-w-0 ${onFieldClick ? "cursor-pointer hover:opacity-80" : ""}`}
              onClick={() => onFieldClick?.("Hayvan Numarası", "number", c.number)}
              title={animals.length > 1 ? `${animals.length} hayvan` : undefined}
            >
              {animals.length === 0 ? (
                <span className="text-base sm:text-xl font-extrabold text-destructive shrink-0">
                  #{c.number || "—"}
                </span>
              ) : (
                animals.map((n, idx) => (
                  <span
                    key={`${n}-${idx}`}
                    className="rounded-md border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-xs sm:text-base font-extrabold text-destructive"
                  >
                    #{n}
                  </span>
                ))
              )}
              {animals.length > 1 && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  {animals.length} hayvan
                </span>
              )}
            </div>

            <div
              className={`shrink-0 ${onFieldClick ? "cursor-pointer hover:opacity-80" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                onFieldClick?.("Ödeme Durumu", "payment_status", c.payment_status);
              }}
            >
              {paymentBadge(c.payment_status as PaymentStatus)}
            </div>
          </div>

          {/* Alt Satır: Grup Kategorisi ve Cins Bilgisi */}
          {(c.group_category || c.type) && (
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
              {c.group_category && (
                <span
                  className={`inline-flex items-center rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400 truncate max-w-full ${onFieldClick ? "cursor-pointer hover:opacity-80" : ""}`}
                  title={c.group_category}
                  onClick={(e) => {
                    e.stopPropagation();
                    onFieldClick?.("Grup Kategorisi", "group_category", c.group_category ?? "");
                  }}
                >
                  📂 {c.group_category}
                </span>
              )}
              {c.type && (
                <span
                  className={`inline-flex items-center rounded-full bg-primary/20 border border-primary/30 px-2.5 py-0.5 text-[11px] font-bold text-primary truncate max-w-full ${onFieldClick ? "cursor-pointer hover:opacity-80" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onFieldClick?.("Cins", "type", c.type || "");
                  }}
                >
                  {c.type}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="space-y-1.5 text-sm">
          {[
            ["✨ Özellik", "special", c.special],
            ["🏷️ Küpe", "color_of_earring", c.color_of_earring],
            ["🎨 Hayvan Rengi", "color_of_animal", c.color_of_animal],
            ["🎨 Sıkılan Boya", "spray_paint_color", c.spray_paint_color],
            ["👤 Sahip", "whose", c.whose],
            ["📦 Kimden", "from_whom", c.from_whom],
            ["📞 Telefon", "phone_number", c.phone_number],
          ].map(([label, key, val]) => {
            const str = val || "";
            const display = key === "phone_number" ? phoneDisplay : str;
            const tel = key === "phone_number" ? phoneToTelHref(str) : null;
            return (
            <div
              key={key}
              className={`flex justify-between gap-2 border-b border-dashed border-border pb-1 last:border-0 ${onFieldClick ? "cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800/50 rounded px-1 -mx-1" : ""}`}
              onClick={() => onFieldClick?.(label, key, str)}
            >
              <span className="text-green font-semibold shrink-0">{label}</span>
              {tel && display ? (
                <a
                  href={tel}
                  className="text-primary text-right truncate underline-offset-2 hover:underline min-w-0 font-medium"
                  onClick={(e) => e.stopPropagation()}
                >
                  {display}
                </a>
              ) : (
                <span className="text-muted-foreground text-right truncate">{display || "—"}</span>
              )}
            </div>
            );
          })}

          {/* Payment Notes */}
          <div
            className={`flex justify-between gap-2 border-b border-dashed border-border pb-1 ${onFieldClick ? "cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800/50 rounded px-1 -mx-1" : ""}`}
            onClick={() => onFieldClick?.("Ödeme", "payment_method", c.payment_method || "")}
          >
            <span className="text-green font-semibold shrink-0">💳 Ödeme Notu</span>
            <span className="text-muted-foreground text-right min-w-0 flex-1 break-words whitespace-pre-wrap">
              {manualNote || "—"}
            </span>
          </div>
          
          {autoRows.length > 0 && (
            <div
              className={`flex justify-between gap-2 border-b border-dashed border-border pb-1 ${onFieldClick ? "cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800/50 rounded px-1 -mx-1" : ""}`}
              onClick={() => onFieldClick?.("Ödeme", "payment_method", c.payment_method || "")}
            >
              <span className="text-green font-semibold shrink-0 text-[11px] opacity-80 italic">💳 Bakiye Detayı</span>
              <span className="text-muted-foreground text-right min-w-0 flex-1 break-words whitespace-pre-wrap text-[11px] italic">
                {autoRows.map((row, index) => (
                  <span key={`${row}-${index}`} className="block">
                    {row}
                  </span>
                ))}
              </span>
            </div>
          )}

          {(c.address || onFieldClick) && (c.group_category === "Köye Dağıtılacaklar" || c.group_category === "Çarşıya Dağıtılacaklar") ? (
            <div
              className={`flex justify-between gap-2 border-b border-dashed border-border pb-1 ${onFieldClick ? "cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800/50 rounded px-1 -mx-1" : ""}`}
              onClick={() => onFieldClick?.("📍 Adres", "address", c.address || "")}
            >
              <span className="text-green font-semibold shrink-0">📍 Adres</span>
              <span className="text-muted-foreground text-right min-w-0 flex-1 break-words whitespace-pre-wrap line-clamp-6">
                {c.address || "—"}
              </span>
            </div>
          ) : null}
        </div>

        <div
          className={`mt-3 border-t border-border pt-3 space-y-1 ${onFieldClick ? "cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800/50 rounded px-1 -mx-1" : ""}`}
          onClick={() => onFieldClick?.("📝 Not", "note", c.note || "")}
        >
          <div className="text-green font-semibold text-sm shrink-0">📝 Not</div>
          <p className="text-sm text-muted-foreground text-right break-words whitespace-pre-wrap line-clamp-6 min-w-0">
            {(c.note ?? "").trim() || "—"}
          </p>
        </div>
      </div>

      {/* Footer - fiyat ve fiş */}
      <div className="mt-3 flex items-center justify-between gap-3">
        {onPrintClick ? (
          <button
            className="rounded-lg bg-primary/10 hover:bg-primary/20 text-primary px-3 py-2 font-bold text-sm sm:text-base transition-colors flex items-center gap-1.5"
            title="Termal yazıcıdan fiş çıkarmak için tıklayın"
            onClick={(e) => { e.stopPropagation(); onPrintClick(); }}
          >
            🖨️ Fiş Yazdır
          </button>
        ) : (
          <div className="rounded-lg bg-primary/10 text-primary px-3 py-2 font-bold text-sm sm:text-base flex items-center gap-1.5 opacity-50 cursor-not-allowed">
            🖨️ Fiş Yazdır
          </div>
        )}

        <div
          className={`rounded-lg bg-accent px-3 py-2 text-right font-extrabold text-gold text-base sm:text-lg shrink-0 ${onFieldClick ? "cursor-pointer hover:opacity-80" : ""}`}
          onClick={() => onFieldClick?.("Ödeme", "payment_method", c.payment_method || "")}
          title="Ödeme notu ve ödeme durumu"
        >
          💰 {formatPrice(Number(c.price))} ₺
        </div>
      </div>
    </div>
  );

  return CardContent;
}


interface CustomerCardProps {
  customer: Customer;
  editable?: boolean;
}

export function CustomerCard({ customer, editable = true }: CustomerCardProps) {
  const [printOpen, setPrintOpen] = useState(false);
  const [printTitle, setPrintTitle] = useState(
    `${customer.yil || 2026} Kurbanlık Organizasyonu`
  );
  const [printQueueNo, setPrintQueueNo] = useState("1");

  const [editOpen, setEditOpen] = useState(false);
  const [editField, setEditField] = useState<{ label: string, key: string, value: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [manualNote, setManualNote] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const key: CustomerKey = useMemo(() => customerKey(customer), [customer]);

  const syncPrintQueueFromStorage = () => {
    setPrintQueueNo(String(readReceiptDailyNext()));
  };

  const openPrintDialog = () => {
    syncPrintQueueFromStorage();
    setPrintOpen(true);
  };

  const handlePrint = () => {
    const raw = printQueueNo.trim();
    const display = raw === "" ? "-" : raw;
    printReceipt(customer, printTitle, display);
    const parsed = parseInt(raw, 10);
    if (raw !== "" && Number.isFinite(parsed) && parsed > 0) {
      persistReceiptDailyAfterPrint(parsed);
    }
    setPrintOpen(false);
  };

  const handleFieldClick = (label: string, fieldKey: string, value: string) => {
    if (fieldKey === "payment_method" || fieldKey === "payment_status") {
      setEditField({ label: "Ödeme Bilgileri", key: "payment_combined", value: customer.payment_method });
      const { manualNote: existingManualNote } = splitPaymentMethod(customer.payment_method);
      setManualNote(existingManualNote || "");
      setEditValue(customer.payment_status);
      setPaidAmount("");
    } else if (fieldKey === "phone_number") {
      setEditField({ label, key: fieldKey, value });
      setEditValue(formatPhoneDisplay(value));
      setManualNote("");
      setPaidAmount("");
    } else {
      setEditField({ label, key: fieldKey, value });
      setEditValue(value);
      setManualNote("");
      setPaidAmount("");
    }
    setError("");
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!editField) return;
    setError("");
    setSubmitting(true);
    try {
      if (editField.key === "payment_combined") {
        if (editValue === "Kısmi Ödeme") {
          if (!paidAmount.trim()) {
            setError("Kısmi ödeme için ödenen tutarı girin.");
            setSubmitting(false);
            return;
          }
          const result = await applyPartialPayment(key, paidAmount, manualNote);
          if (result?.error) setError(result.error);
          else {
            setEditOpen(false);
          }
        } else {
          const paidAllAmount = Math.max(0, Number(customer.price ?? 0));
          const paidAllAutoNote = `${formatPrice(paidAllAmount)} ₺ ödendi; kalan borç ${formatPrice(0)} ₺`;
          
          const { autoNote: previousAutoNote } = splitPaymentMethod(customer.payment_method);
          const combinedAutoNote = previousAutoNote.trim() ? `${previousAutoNote.trim()}\n${paidAllAutoNote}` : paidAllAutoNote;

          const paymentMethodForStatus =
            editValue === "Ödendi"
              ? (manualNote.trim() ? `${manualNote.trim()} | ${combinedAutoNote}` : ` | ${combinedAutoNote}`)
              : (manualNote.trim() ? `${manualNote.trim()} | ${previousAutoNote}` : (previousAutoNote ? ` | ${previousAutoNote}` : ""));

          const result = await updateCustomerFields(key, {
            payment_status: editValue,
            payment_method: paymentMethodForStatus,
            ...(editValue === "Ödendi" ? { price: 0 } : {}),
          });
          if (result?.error) setError(result.error);
          else {
            setEditOpen(false);
          }
        }
        setSubmitting(false);
        return;
      }

      let val = editValue.trim();
      const allowEmpty =
        editField.key === "group_category" ||
        editField.key === "note" ||
        editField.key === "address" ||
        editField.key === "phone_number";

      if (!val && !allowEmpty) {
        setError("Yeni değer boş olamaz.");
        setSubmitting(false);
        return;
      }

      if (editField.key === "number" && !/^\d+(\s*,\s*\d+)*$/.test(val)) {
        setError("Hayvan numarası rakamlardan oluşmalı; birden fazla için virgülle ayırın (örn. 101, 102).");
        setSubmitting(false);
        return;
      }
      if (editField.key === "price" && !Number.isFinite(parseMoneyTR(val))) {
        setError("Geçerli bir fiyat girin.");
        setSubmitting(false);
        return;
      }
      if (editField.key === "phone_number" && val !== "") {
        const norm = normalizePhone(val);
        if (!norm) {
          setError("Geçerli bir telefon girin. Örn: 0532 123 45 67");
          setSubmitting(false);
          return;
        }
        val = norm;
      }

      const result = await updateCustomerField(key, editField.key, val);
      if (result?.error) setError(result.error);
      else setEditOpen(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Güncelleme hatası");
    } finally {
      setSubmitting(false);
    }
  };

  const previewCustomer: Customer = { ...customer };
  if (editField) {
    if (editField.key === "payment_combined") {
      previewCustomer.payment_status = editValue as PaymentStatus;
      if (editValue === "Kısmi Ödeme") {
        const paid = parseMoneyTR(paidAmount) || 0;
        const remaining = Math.max(0, (customer.price || 0) - paid);
        const auto = `${formatPrice(paid)} ₺ ödendi; kalan borç ${formatPrice(remaining)} ₺`;
        const { autoNote: previousAutoNote } = splitPaymentMethod(customer.payment_method);
        const combinedAutoNote = previousAutoNote.trim() ? `${previousAutoNote.trim()}\n${auto}` : auto;
        previewCustomer.payment_method = manualNote ? `${manualNote} | ${combinedAutoNote}` : ` | ${combinedAutoNote}`;
        previewCustomer.price = remaining;
      } else {
        if (editValue === "Ödendi") {
          const paidAllAmount = Math.max(0, Number(customer.price ?? 0));
          const paidAllAutoNote = `${formatPrice(paidAllAmount)} ₺ ödendi; kalan borç ${formatPrice(0)} ₺`;
          const { autoNote: previousAutoNote } = splitPaymentMethod(customer.payment_method);
          const combinedAutoNote = previousAutoNote.trim() ? `${previousAutoNote.trim()}\n${paidAllAutoNote}` : paidAllAutoNote;
          previewCustomer.payment_method = manualNote ? `${manualNote} | ${combinedAutoNote}` : ` | ${combinedAutoNote}`;
        } else {
          const { autoNote: previousAutoNote } = splitPaymentMethod(customer.payment_method);
          previewCustomer.payment_method = manualNote ? `${manualNote} | ${previousAutoNote}` : (previousAutoNote ? ` | ${previousAutoNote}` : "");
        }
        if (editValue === "Ödendi") {
          previewCustomer.price = 0;
        }
      }
    } else if (editField.key === "phone_number") {
      const norm = normalizePhone(editValue);
      (previewCustomer as unknown as Record<string, unknown>)[editField.key] = norm || editValue;
    } else {
      (previewCustomer as unknown as Record<string, unknown>)[editField.key] = editValue;
    }
  }

  const previewAnimals = parseAnimalNumbers(customer.number);
  const printAnimalLabel = previewAnimals.length > 1
    ? previewAnimals.join(", ")
    : (previewAnimals[0] ?? customer.number);

  return (
    <>
      <CustomerCardInner
        c={customer}
        onFieldClick={editable ? handleFieldClick : undefined}
        onPrintClick={openPrintDialog}
      />

      {/* Fiş Yazdır Dialog */}
      <Dialog
        open={printOpen}
        onOpenChange={(open) => {
          setPrintOpen(open);
          if (open) syncPrintQueueFromStorage();
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>🖨️ Fiş Yazdır</DialogTitle>
            <DialogDescription>
              Fiş başlığı ve sıra numarasını düzenleyin. Sıra numarası her gün sıfırlanır; sağda önizleme görünür.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col md:flex-row gap-6 py-4">
            {/* Sol Taraf - Ayarlar */}
            <div className="flex-1 space-y-4 flex flex-col justify-center">
              <div className="space-y-2">
                <Label htmlFor="printTitle" className="text-base font-semibold">Fiş Başlığı</Label>
                <Input
                  id="printTitle"
                  value={printTitle}
                  onChange={(e) => setPrintTitle(e.target.value)}
                  placeholder="Başlık girin..."
                  className="text-center font-bold"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Bu başlık sadece bu fiş için geçerli olacaktır.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="printQueueNo" className="text-base font-semibold">
                  Sıra No
                </Label>
                <Input
                  id="printQueueNo"
                  inputMode="numeric"
                  value={printQueueNo}
                  onChange={(e) => setPrintQueueNo(e.target.value)}
                  placeholder="1"
                  className="text-center font-semibold"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Varsayılan günlük sıradır; yazdırdıktan sonra bir sonraki fiş için otomatik artar.
                </p>
              </div>
              <Button onClick={handlePrint} size="lg" className="w-full font-bold text-base">
                🖨️ Yazdır
              </Button>
            </div>

            {/* Sağ Taraf - Önizleme */}
            <div className="flex justify-center bg-neutral-200/50 dark:bg-neutral-900 p-4 rounded-xl border border-border">
              <div className="w-[220px] bg-white text-black p-[12px] font-mono text-[11px] leading-tight shadow-sm border border-neutral-300 shrink-0">
                <div className="text-center font-bold text-[13px] border-b border-black pb-2 break-words">
                  {printTitle}
                </div>
                <div className="text-center border-b border-black py-2 mb-2.5">
                  <div className="text-[8px] font-bold uppercase tracking-widest text-neutral-600">
                    Sıra No
                  </div>
                  <div className="text-[10px] font-semibold text-neutral-800 mt-1">
                    {printQueueNo.trim() === "" ? "—" : printQueueNo.trim()}
                  </div>
                </div>
                <div className="text-center border-b border-black pb-2.5 mb-3">
                  <div className="text-[10px] uppercase font-bold tracking-widest text-neutral-800">
                    {previewAnimals.length > 1 ? "Küpe Noları" : "Küpe No"}
                  </div>
                  <div className={`${previewAnimals.length > 1 ? "text-[24px]" : "text-[40px]"} font-black leading-none my-1 break-words`}>
                    {printAnimalLabel}
                  </div>
                </div>
                <div className="space-y-1 border-b border-dashed border-black pb-3 mb-3">
                  <div className="flex justify-between gap-1">
                    <span className="font-bold">Tür/Cins:</span>
                    <span className="text-right">{customer.type || "-"}</span>
                  </div>
                  <div className="flex justify-between gap-1">
                    <span className="font-bold">Küpe Rengi:</span>
                    <span className="text-right">{customer.color_of_earring || "-"}</span>
                  </div>
                  <div className="flex justify-between gap-1">
                    <span className="font-bold">Sıkılan Boya:</span>
                    <span className="text-right truncate">{customer.spray_paint_color || "-"}</span>
                  </div>
                  <div className="flex justify-between gap-1">
                    <span className="font-bold">Hayvan Rengi:</span>
                    <span className="text-right truncate">{customer.color_of_animal || "-"}</span>
                  </div>
                  {customer.special && (
                    <div className="mt-1.5 bg-neutral-100 p-1 rounded-sm text-[9px]">
                      <div className="font-bold mb-0.5">Özellik:</div>
                      <div className="break-words">{customer.special}</div>
                    </div>
                  )}
                </div>
                <div className="space-y-1 border-b border-dashed border-black pb-3 mb-3">
                  <div className="flex justify-between gap-2">
                    <span className="font-bold">Sahip:</span>
                    <span className="text-right uppercase font-semibold break-words">{customer.whose || "-"}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="font-bold">Telefon:</span>
                    <span className="text-right">{formatPhoneDisplay(customer.phone_number) || "-"}</span>
                  </div>
                </div>
                <div className="text-center text-[10px] mt-4 mb-2 font-bold italic opacity-90">
                  Bizi tercih ettiğiniz için<br />teşekkür ederiz.
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Alan Güncelleme Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>✏️ {editField?.label} Güncelle</DialogTitle>
            <DialogDescription>
              Değişikliği kaydederek müşteri kartını anında güncelleyebilirsiniz. Sağ tarafta değişikliğin kart üzerindeki yansımasını görebilirsiniz.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col md:flex-row gap-6 py-4 items-stretch">
            {/* Form */}
            <div className="flex-1 space-y-4">
              <div className="space-y-2">
                {editField?.key === "payment_combined" ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>💳 Ödeme Notu (Manuel)</Label>
                      <Textarea
                        value={manualNote}
                        onChange={(e) => setManualNote(e.target.value)}
                        placeholder="Örn: Nakit alındı, yarın ödenecek..."
                        maxLength={4000}
                        className="min-h-[40px] resize-none overflow-hidden"
                        rows={1}
                        onInput={(e) => {
                          const target = e.currentTarget;
                          target.style.height = "auto";
                          target.style.height = `${target.scrollHeight}px`;
                        }}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>📊 Ödeme Durumu (Otomasyon)</Label>
                      <Select value={editValue} onValueChange={(v) => {
                        setEditValue(v);
                        if (v !== "Kısmi Ödeme") setPaidAmount("");
                      }}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PAYMENT_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    {editValue === "Kısmi Ödeme" && (
                      <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
                        <p className="text-xs text-muted-foreground">
                          Mevcut kalan tutar (fiyat):{" "}
                          <span className="font-semibold text-foreground">
                            {formatPrice(Number(customer.price ?? 0))} ₺
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
                ) : (
                  <>
                    <Label>{editField?.label}</Label>
                    {editField?.key === "group_category" ? (
                      <Select value={editValue || "__none__"} onValueChange={(v) => setEditValue(v === "__none__" ? "" : v)}>
                        <SelectTrigger><SelectValue placeholder="Grup Seçin" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">— Grup Seçilmedi —</SelectItem>
                          {GROUP_CATEGORIES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : editField?.key === "note" || editField?.key === "address" ? (
                      <Textarea
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        placeholder={editField?.key === "address" ? "Adres" : "Not"}
                        rows={1}
                        maxLength={editField?.key === "note" ? 4000 : undefined}
                        className="min-h-[40px] resize-none overflow-hidden"
                        onInput={(e) => {
                          const target = e.currentTarget;
                          target.style.height = "auto";
                          target.style.height = `${target.scrollHeight}px`;
                        }}
                      />
                    ) : (
                      <Input
                        value={editValue}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (editField?.key === "price") setEditValue(formatMoneyInputTR(v));
                          else if (editField?.key === "phone_number") setEditValue(formatPhoneInputTR(v));
                          else setEditValue(v);
                        }}
                        inputMode={editField?.key === "price" ? "decimal" : editField?.key === "phone_number" ? "tel" : undefined}
                        placeholder={
                          editField?.key === "price" ? "Örn: 15.400,50" :
                            editField?.key === "phone_number" ? "Örn: 0532 123 45 67" :
                              editField?.key === "number" ? "Örn: 101 veya 101, 102, 103" : "Yeni değer"
                        }
                      />
                    )}
                    {editField?.key === "number" && (
                      <p className="text-xs text-muted-foreground">
                        Birden fazla hayvan için virgülle ayırın (örn. 101, 102, 103).
                      </p>
                    )}
                  </>
                )}
              </div>

              {error && <p className="text-sm text-destructive font-medium">{error}</p>}

              <Button onClick={handleSave} disabled={submitting} className="w-full mt-4">
                {submitting ? "Kaydediliyor..." : "💾 Kaydet"}
              </Button>
            </div>

            {/* Preview */}
            <div className="flex-1 bg-neutral-100 dark:bg-neutral-900/50 p-4 rounded-xl border border-border flex items-center justify-center">
              <div className="w-full pointer-events-none">
                <CustomerCardInner c={previewCustomer} isPreview />
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
