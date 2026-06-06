"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchCustomerHistory } from "@/actions/search";
import type { Customer, CustomerSnapshot, HistoryEntry } from "@/lib/types";
import { formatPrice } from "@/lib/utils";
import { phoneToTelHref } from "@/lib/input-format";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ChevronDown, ChevronUp, ExternalLink, History } from "lucide-react";
import { Button } from "@/components/ui/button";

const ACTION_LABELS: Record<string, string> = {
  create: "Kayıt oluşturuldu",
  update: "Güncelleme öncesi",
  delete: "Silinmeden önceki hal",
};

const SNAPSHOT_FIELDS: { key: keyof CustomerSnapshot; label: string }[] = [
  { key: "number", label: "Hayvan numarası" },
  { key: "type", label: "Cins" },
  { key: "special", label: "Ekstra özellik" },
  { key: "color_of_earring", label: "Küpe rengi" },
  { key: "color_of_animal", label: "Hayvan rengi" },
  { key: "spray_paint_color", label: "Sıkılan boya" },
  { key: "whose", label: "Kime ait" },
  { key: "from_whom", label: "Kimden alındı" },
  { key: "price", label: "Fiyat (kalan)" },
  { key: "agreed_total", label: "Anlaşılan tutar" },
  { key: "phone_number", label: "Telefon" },
  { key: "payment_method", label: "Ödeme detayı" },
  { key: "payment_status", label: "Ödeme durumu" },
  { key: "group_category", label: "Grup kategorisi" },
  { key: "address", label: "Adres" },
  { key: "note", label: "Not" },
];

function customerToSnapshot(c: Customer): CustomerSnapshot {
  return {
    random_id: c.random_id,
    number: c.number,
    type: c.type,
    special: c.special,
    color_of_earring: c.color_of_earring,
    color_of_animal: c.color_of_animal,
    whose: c.whose,
    from_whom: c.from_whom,
    price: c.price,
    agreed_total: c.agreed_total,
    phone_number: c.phone_number,
    payment_method: c.payment_method,
    payment_status: c.payment_status,
    group_category: c.group_category,
    address: c.address,
    spray_paint_color: c.spray_paint_color,
    note: c.note,
  };
}

function normVal(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  return String(v).trim();
}

function formatField(key: keyof CustomerSnapshot, v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (key === "price" || key === "agreed_total") {
    const n = Number(v);
    if (!Number.isFinite(n)) return String(v);
    return `${formatPrice(n)} ₺`;
  }
  return String(v);
}

function SnapshotPhoneCell({
  fieldKey,
  display,
}: {
  fieldKey: keyof CustomerSnapshot;
  display: string;
}) {
  if (fieldKey !== "phone_number" || display === "—") return display;
  const href = phoneToTelHref(display);
  if (!href) return display;
  return (
    <a href={href} className="text-primary underline-offset-2 hover:underline font-medium">
      {display}
    </a>
  );
}

/** Zaman artan sırada: snapshot(j) bu olaydan önce; bir sonraki hal = snapshot(j+1) veya güncel kayıt. */
function getSnapshotAfter(
  asc: HistoryEntry[],
  indexInAsc: number,
  current: CustomerSnapshot | null
): CustomerSnapshot | null {
  if (indexInAsc < asc.length - 1) return asc[indexInAsc + 1].snapshot as CustomerSnapshot;
  return current;
}

function diffSnapshots(
  before: CustomerSnapshot,
  after: CustomerSnapshot | null
): { key: keyof CustomerSnapshot; label: string; before: string; after: string }[] {
  if (!after) return [];
  const out: { key: keyof CustomerSnapshot; label: string; before: string; after: string }[] = [];
  for (const { key, label } of SNAPSHOT_FIELDS) {
    const b = normVal(before[key]);
    const a = normVal(after[key]);
    if (b !== a) {
      out.push({
        key,
        label,
        before: formatField(key, before[key]),
        after: formatField(key, after[key]),
      });
    }
  }
  return out;
}

interface Props {
  hayvanNumber: string | null;
  /** Composite key parçası: tercih edilen tarama anahtarı (kayıt başına benzersiz). */
  randomId?: string | null;
  /** Güncel kayıt — son olayın “sonrası” ve alan karşılaştırması için */
  currentCustomer?: Customer | null;
}

export function CustomerHistoryPanel({
  hayvanNumber,
  randomId,
  currentCustomer,
}: Props) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(() => Boolean(hayvanNumber));
  const [err, setErr] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeRow, setActiveRow] = useState<HistoryEntry | null>(null);

  const currentSnap = useMemo(
    () => (currentCustomer ? customerToSnapshot(currentCustomer) : null),
    [currentCustomer]
  );

  const ascRows = useMemo(() => {
    return [...rows].sort(
      (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
    );
  }, [rows]);

  useEffect(() => {
    if (!hayvanNumber) return;
    let cancelled = false;
    fetchCustomerHistory(hayvanNumber, randomId ?? null)
      .then((data) => {
        if (!cancelled) {
          if ("error" in data) {
            setErr(data.error);
            setRows([]);
          } else {
            setErr("");
            setRows(data);
          }
        }
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setErr(e instanceof Error ? e.message : "Geçmiş yüklenemedi.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [hayvanNumber, randomId]);

  if (!hayvanNumber) return null;

  function openDetail(row: HistoryEntry) {
    setActiveRow(row);
    setDialogOpen(true);
  }

  const activeIndexAsc =
    activeRow ? ascRows.findIndex((r) => r.id === activeRow.id) : -1;
  const afterSnap =
    activeRow && activeIndexAsc >= 0
      ? getSnapshotAfter(ascRows, activeIndexAsc, currentSnap)
      : null;
  const changes =
    activeRow && afterSnap
      ? diffSnapshots(activeRow.snapshot as CustomerSnapshot, afterSnap)
      : [];

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left font-medium text-sm hover:bg-accent/50 transition-colors"
      >
        <History className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="flex-1">Geçmiş kayıtlar (audit)</span>
        {loading ? (
          <span className="text-xs text-muted-foreground">Yükleniyor…</span>
        ) : (
          <span className="text-xs text-muted-foreground">{rows.length} kayıt</span>
        )}
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="border-t border-border px-4 py-3 space-y-3 max-h-[28rem] overflow-y-auto">
          {err && <p className="text-sm text-destructive">{err}</p>}
          {!err && rows.length === 0 && !loading && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Henüz geçmiş kaydı yok. Güncelleme ve silme geçmişi için veritabanında{" "}
              <code className="text-xs bg-muted px-1 rounded">kurbanlik_hesap_history</code>{" "}
              tablosunun migrasyonla oluşturulması gerekir.
            </p>
          )}
          {rows.map((row) => {
            const snap = row.snapshot as CustomerSnapshot;
            const when = new Date(row.recorded_at);
            const dateStr = when.toLocaleString("tr-TR", {
              dateStyle: "short",
              timeStyle: "medium",
            });
            return (
              <div
                key={row.id}
                className="rounded-lg border border-border bg-muted/20 p-3 text-sm space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-medium text-foreground">{dateStr}</span>
                    <span className="text-xs px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                      {ACTION_LABELS[row.action] ?? row.action}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1 text-xs"
                    onClick={() => openDetail(row)}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Tümünü gör / farklar
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  Özet: {snap.whose ? `${snap.whose} · ` : ""}
                  {snap.payment_status ?? ""}
                  {snap.price != null && !Number.isNaN(Number(snap.price))
                    ? ` · ${formatPrice(Number(snap.price))} ₺`
                    : ""}
                </p>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[min(85vh,720px)] flex flex-col gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-2 shrink-0 border-b border-border">
            <DialogTitle className="pr-8">
              Geçmiş kayıt —{" "}
              {activeRow &&
                new Date(activeRow.recorded_at).toLocaleString("tr-TR", {
                  dateStyle: "short",
                  timeStyle: "medium",
                })}
            </DialogTitle>
            <DialogDescription>
              {activeRow
                ? `${ACTION_LABELS[activeRow.action] ?? activeRow.action}. ${
                    changes.length > 0
                      ? "Önce / sonra tablosu bu adımdaki farkları gösterir."
                      : "Kayıttaki tüm alanlar aşağıdadır."
                  }`
                : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-y-auto px-6 py-4 space-y-6 flex-1 min-h-0">
            {changes.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground">
                  Bu adımda değişen alanlar
                </h4>
                <div className="rounded-lg border border-amber-700/40 bg-amber-950/20 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40 text-left text-xs">
                        <th className="p-2 font-medium">Alan</th>
                        <th className="p-2 font-medium">Önce</th>
                        <th className="p-2 font-medium">Sonra</th>
                      </tr>
                    </thead>
                    <tbody>
                      {changes.map((c) => (
                        <tr key={c.key} className="border-b border-border/60 last:border-0">
                          <td className="p-2 align-top text-muted-foreground">{c.label}</td>
                          <td className="p-2 align-top text-destructive/90 break-words">
                            <SnapshotPhoneCell fieldKey={c.key} display={c.before} />
                          </td>
                          <td className="p-2 align-top text-green-600 dark:text-green-400 break-words">
                            <SnapshotPhoneCell fieldKey={c.key} display={c.after} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-foreground">
                Kayıttaki tüm alanlar (bu anlık görüntü)
              </h4>
              <p className="text-xs text-muted-foreground">
                Tetikleyicinin kaydettiği snapshot; boş alanlar çizgi ile gösterilir.
              </p>
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <tbody>
                    {SNAPSHOT_FIELDS.map(({ key, label }) => (
                      <tr key={key} className="border-b border-border last:border-0">
                        <td className="p-2.5 w-[40%] align-top text-muted-foreground bg-muted/20 text-xs font-medium">
                          {label}
                        </td>
                        <td className="p-2.5 align-top break-words">
                          <SnapshotPhoneCell
                            fieldKey={key}
                            display={formatField(key, activeRow?.snapshot[key])}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
