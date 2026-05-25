"use client";
import { useState, useMemo } from "react";
import type { BuyukbasHayvanWithHissedarlar, Customer } from "@/lib/types";
import { BUYUKBAS_GROUP_CATEGORIES, GROUP_CATEGORIES } from "@/lib/types";
import { BuyukbasCard } from "@/components/buyukbas-card";
import { CustomerCard } from "@/components/customer-card";
import {
  downloadBuyukbasExcel,
  downloadCombinedExcel,
  downloadKucukbasExcel,
} from "@/lib/excel-export";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Download, ChevronDown, ChevronUp, LayoutGrid, Layers } from "lucide-react";
import { compareHayvanNumarasi, formatPrice, formatPhoneDisplay } from "@/lib/utils";
const PAGE_SIZE = 12;

type SortField = "default" | "number" | "price" | "type" | "whose" | "from_whom";
type SortDir = "asc" | "desc";
type ViewMode = "all" | "grouped";

function sortCustomers(list: Customer[], field: SortField, dir: SortDir): Customer[] {
  if (field === "default") return dir === "desc" ? [...list].reverse() : list;

  return [...list].sort((a, b) => {
    let av: string | number, bv: string | number;
    if (field === "number") {
      const cmp = compareHayvanNumarasi(a.number, b.number);
      return dir === "asc" ? cmp : -cmp;
    } else if (field === "price") {
      av = Number(a.price) || 0;
      bv = Number(b.price) || 0;
    } else {
      av = String((a as unknown as Record<string, unknown>)[field] ?? "").toLowerCase();
      bv = String((b as unknown as Record<string, unknown>)[field] ?? "").toLowerCase();
    }
    if (av < bv) return dir === "asc" ? -1 : 1;
    if (av > bv) return dir === "asc" ? 1 : -1;
    return 0;
  });
}

interface Props {
  initialCustomers: Customer[];
  initialBuyukbas: BuyukbasHayvanWithHissedarlar[];
}

type SpeciesFilter = "all" | "kucukbas" | "buyukbas";

// ────────────────────────────────────────────────────────────────────────────
// Gruplu görünüm — tek bir grup paneli
// ────────────────────────────────────────────────────────────────────────────
function GroupPanel({
  groupName,
  customers,
  icon,
}: {
  groupName: string;
  customers: Customer[];
  icon: string;
}) {
  const [open, setOpen] = useState(false);
  const total = customers.reduce((s, c) => s + Number(c.price ?? 0), 0);

  return (
    <div className="group premium-card-interactive rounded-xl border border-border bg-card overflow-hidden">
      {/* Başlık satırı */}
      <div
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors text-left cursor-pointer"
      >
        <span className="text-lg transition-transform duration-300 group-hover:scale-125 origin-center">{icon}</span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-foreground truncate">{groupName}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {customers.length} hayvan &nbsp;·&nbsp;{" "}
            <span className="text-gold font-semibold">{formatPrice(total)} ₺</span>
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              const safeName = groupName.replace(/[^a-zA-ZğüşıöçĞÜŞİÖÇ0-9\s]/g, "").trim();
              downloadKucukbasExcel(customers, `${safeName}.xlsx`);
            }}
            className="h-7 px-2 text-xs"
            disabled={customers.length === 0}
          >
            <Download className="h-3 w-3 mr-1" />
            Excel
          </Button>
          {open ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Açılan kartlar */}
      {open && (
        <div className="border-t border-border p-4">
          {customers.length === 0 ? (
            <p className="text-center text-muted-foreground py-6 text-sm">Bu grupta kayıt bulunmuyor.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {customers.map((c, i) => (
                <CustomerCard key={c.random_id || `${c.phone_number}-${c.number}-${i}`} customer={c} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const GROUP_ICONS: Record<string, string> = {
  "1.Gün Kesilecek Küçük Mallar": "🔪",
  "1.Gün Kesilecek Büyük Mallar": "🔪",
  "2.Gün Kesilecek Küçük Mallar": "✂️",
  "2.Gün Kesilecek Büyük Mallar": "✂️",
  "Pazardan Kendi Alacaklar": "🛒",
  "Köyden Kendi Alacaklar": "🏘️",
  "Çarşıya Dağıtılacaklar": "🏪",
  "Köye Dağıtılacaklar": "🚚",
  "Kesilip Dükkana Gönderilecekler": "🏬",
};

// ────────────────────────────────────────────────────────────────────────────
// Ana bileşen
// ────────────────────────────────────────────────────────────────────────────
function BuyukbasGroupPanel({
  groupName,
  hayvanlar,
  icon,
}: {
  groupName: string;
  hayvanlar: BuyukbasHayvanWithHissedarlar[];
  icon: string;
}) {
  const [open, setOpen] = useState(false);
  const total = hayvanlar.reduce(
    (s, h) => s + h.hissedarlar.reduce((ss, hs) => ss + Number(hs.price ?? 0), 0),
    0
  );

  return (
    <div className="group premium-card-interactive rounded-xl border border-border bg-card overflow-hidden">
      <div
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors text-left cursor-pointer"
      >
        <span className="text-lg">{icon}</span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{groupName}</p>
          <p className="text-xs text-muted-foreground">
            {hayvanlar.length} hayvan ·{" "}
            <span className="text-gold font-semibold">{formatPrice(total)} ₺</span>
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            const safe = groupName.replace(/[^a-zA-ZğüşıöçĞÜŞİÖÇ0-9\s]/g, "").trim();
            downloadBuyukbasExcel(hayvanlar, `buyukbas-${safe}.xlsx`);
          }}
          className="h-7 px-2 text-xs"
          disabled={hayvanlar.length === 0}
        >
          <Download className="h-3 w-3 mr-1" />
          Excel
        </Button>
      </div>
      {open && (
        <div className="border-t border-border p-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {hayvanlar.map((h) => (
            <BuyukbasCard key={h.number} hayvan={h} />
          ))}
        </div>
      )}
    </div>
  );
}

export function CustomersClient({ initialCustomers, initialBuyukbas }: Props) {
  const [sortField, setSortField] = useState<SortField>("default");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [speciesFilter, setSpeciesFilter] = useState<SpeciesFilter>("all");

  const sortedKucuk = useMemo(
    () => sortCustomers(initialCustomers, sortField, sortDir),
    [initialCustomers, sortField, sortDir]
  );

  const sortedBuyuk = useMemo(() => {
    const list = [...initialBuyukbas];
    list.sort((a, b) => compareHayvanNumarasi(a.number, b.number));
    return speciesFilter === "kucukbas" ? [] : list;
  }, [initialBuyukbas, speciesFilter]);

  const sorted =
    speciesFilter === "buyukbas"
      ? []
      : sortedKucuk;

  const displayItems = useMemo(() => {
    if (speciesFilter === "kucukbas") return { kucuk: sorted, buyuk: [] as BuyukbasHayvanWithHissedarlar[] };
    if (speciesFilter === "buyukbas") return { kucuk: [] as Customer[], buyuk: sortedBuyuk };
    return { kucuk: sorted, buyuk: sortedBuyuk };
  }, [speciesFilter, sorted, sortedBuyuk]);

  const flatCount =
    speciesFilter === "kucukbas"
      ? displayItems.kucuk.length
      : speciesFilter === "buyukbas"
        ? displayItems.buyuk.length
        : displayItems.kucuk.length + displayItems.buyuk.length;

  const totalPages = Math.max(1, Math.ceil(flatCount / PAGE_SIZE));

  const paginatedKucuk =
    speciesFilter === "buyukbas"
      ? []
      : displayItems.kucuk.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const paginatedBuyuk =
    speciesFilter === "kucukbas"
      ? []
      : (() => {
          const offset =
            speciesFilter === "all"
              ? Math.max(0, (page - 1) * PAGE_SIZE - displayItems.kucuk.length)
              : (page - 1) * PAGE_SIZE;
          const limit =
            speciesFilter === "all"
              ? Math.max(0, page * PAGE_SIZE - displayItems.kucuk.length)
              : page * PAGE_SIZE;
          return displayItems.buyuk.slice(offset, limit);
        })();

  function handleSortField(v: string) {
    setSortField(v as SortField);
    setPage(1);
  }
  function handleSortDir(v: string) {
    setSortDir(v as SortDir);
    setPage(1);
  }

  // Grup bazlı gruplama
  const grouped = useMemo(() => {
    const map: Record<string, Customer[]> = {};
    for (const g of GROUP_CATEGORIES) map[g] = [];
    map["__grupsuz__"] = [];
    for (const c of sorted) {
      const key = c.group_category && GROUP_CATEGORIES.includes(c.group_category as typeof GROUP_CATEGORIES[number])
        ? c.group_category
        : "__grupsuz__";
      map[key].push(c);
    }
    return map;
  }, [sorted]);

  const grupsuzList = grouped["__grupsuz__"] ?? [];

  return (
    <div className="space-y-4">
      {/* Kontroller */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap">
        {/* Görünüm modu toggle */}
        <div className="flex rounded-lg border border-border overflow-hidden shrink-0">
          <button
            type="button"
            onClick={() => setViewMode("all")}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${
              viewMode === "all"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent"
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Tümü
          </button>
          <button
            type="button"
            onClick={() => setViewMode("grouped")}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors border-l border-border ${
              viewMode === "grouped"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent"
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            Gruplara Göre
          </button>
        </div>

        <div className="flex rounded-lg border border-border overflow-hidden shrink-0">
          {(
            [
              ["all", "Hepsi"],
              ["kucukbas", "Küçükbaş"],
              ["buyukbas", "Büyükbaş"],
            ] as const
          ).map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => {
                setSpeciesFilter(val);
                setPage(1);
              }}
              className={`px-3 py-2 text-xs font-medium transition-colors border-l border-border first:border-l-0 ${
                speciesFilter === val
                  ? "bg-violet-600 text-white"
                  : "text-muted-foreground hover:bg-accent"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Sıralama (sadece "Tümü" modunda) */}
        {viewMode === "all" && speciesFilter !== "buyukbas" && (
          <div className="flex gap-2 flex-1">
            <Select value={sortField} onValueChange={handleSortField}>
              <SelectTrigger className="flex-1 sm:flex-none sm:w-48">
                <SelectValue placeholder="Sıralama ölçütü" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Varsayılan</SelectItem>
                <SelectItem value="number">Numara</SelectItem>
                <SelectItem value="price">Fiyat</SelectItem>
                <SelectItem value="type">Cins</SelectItem>
                <SelectItem value="whose">Kime Ait</SelectItem>
                <SelectItem value="from_whom">Kimden Alındı</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortDir} onValueChange={handleSortDir}>
              <SelectTrigger className="w-28 sm:w-36 shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="asc">Artan ↑</SelectItem>
                <SelectItem value="desc">Azalan ↓</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Tüm Excel indirme */}
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            downloadCombinedExcel(initialCustomers, initialBuyukbas, "musteriler.xlsx")
          }
          className="w-full sm:w-auto sm:ml-auto"
        >
          <Download className="h-4 w-4 mr-2" />
          Tümünü Excel İndir
        </Button>
      </div>

      {/* ── TÜMÜ görünümü ── */}
      {viewMode === "all" && (
        <>
          {flatCount === 0 ? (
            <p className="text-center text-muted-foreground py-12">Kayıt bulunamadı.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {paginatedKucuk.map((c, i) => (
                <CustomerCard key={c.random_id || `${c.phone_number}-${c.number}-${i}`} customer={c} />
              ))}
              {paginatedBuyuk.map((h) => (
                <BuyukbasCard key={h.number} hayvan={h} />
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button
                variant="outline" size="icon"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                Sayfa {page} / {totalPages}
              </span>
              <Button
                variant="outline" size="icon"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}

      {/* ── GRUPLU görünüm ── */}
      {viewMode === "grouped" && (
        <div className="space-y-3">
          {speciesFilter !== "buyukbas" &&
            GROUP_CATEGORIES.filter((g) => !g.includes("Büyük")).map((group) => (
              <GroupPanel
                key={group}
                groupName={group}
                customers={grouped[group] ?? []}
                icon={GROUP_ICONS[group] ?? "📂"}
              />
            ))}

          {speciesFilter !== "buyukbas" && grupsuzList.length > 0 && (
            <GroupPanel groupName="Grupsuz Kayıtlar" customers={grupsuzList} icon="❓" />
          )}

          {speciesFilter !== "kucukbas" &&
            BUYUKBAS_GROUP_CATEGORIES.map((group) => {
              const list = initialBuyukbas.filter((h) => h.group_category === group);
              if (list.length === 0) return null;
              return (
                <BuyukbasGroupPanel
                  key={group}
                  groupName={group}
                  hayvanlar={list}
                  icon={GROUP_ICONS[group] ?? "📂"}
                />
              );
            })}

          {speciesFilter !== "kucukbas" &&
            (() => {
              const list = initialBuyukbas.filter((h) => !h.group_category);
              if (list.length === 0) return null;
              return (
                <BuyukbasGroupPanel
                  groupName="Grupsuz Büyükbaş"
                  hayvanlar={list}
                  icon="❓"
                />
              );
            })()}
        </div>
      )}
    </div>
  );
}
