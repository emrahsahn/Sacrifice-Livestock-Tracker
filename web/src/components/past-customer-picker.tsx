"use client";

import { useState, useTransition } from "react";
import { searchPastCustomers, type PastCustomerSuggestion } from "@/actions/seasons";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { UserCheck, Search, Loader2, Sparkles, X } from "lucide-react";
import { formatPhoneDisplay } from "@/lib/utils";

interface PastCustomerPickerProps {
  onSelect: (customer: PastCustomerSuggestion) => void;
  className?: string;
}

export function PastCustomerPicker({
  onSelect,
  className = "",
}: PastCustomerPickerProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<PastCustomerSuggestion[]>([]);
  const [isPending, startTransition] = useTransition();
  const [hasSearched, setHasSearched] = useState(false);

  function handleSearch(val: string) {
    setSearchTerm(val);
    if (val.trim().length < 2) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    startTransition(async () => {
      try {
        const list = await searchPastCustomers(val);
        setResults(list);
        setHasSearched(true);
      } catch (err) {
        console.error("Müşteri arama hatası:", err);
      }
    });
  }

  function handlePick(item: PastCustomerSuggestion) {
    onSelect(item);
    setOpen(false);
    setSearchTerm("");
    setResults([]);
    setHasSearched(false);
  }

  return (
    <div className={`rounded-xl border border-primary/20 bg-primary/5 p-3.5 ${className}`}>
      {!open ? (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary shrink-0" />
            <p className="text-xs font-semibold text-foreground">
              Geçmiş Yıllardan Müşteri Aktar
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setOpen(true)}
            className="h-7 text-xs border-primary/30 text-primary hover:bg-primary/20"
          >
            <Search className="h-3 w-3 mr-1" />
            Eski Müşteri Ara
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Önceki Sezonlardan Müşteri Seç</span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setOpen(false);
                setSearchTerm("");
                setResults([]);
              }}
              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="İsim veya telefon numarası yazın..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              className="h-8 pl-8 text-xs bg-background"
              autoFocus
            />
            {isPending && (
              <Loader2 className="absolute right-2.5 top-2.5 h-3.5 w-3.5 animate-spin text-muted-foreground" />
            )}
          </div>

          {results.length > 0 && (
            <div className="max-h-52 overflow-y-auto rounded-lg border border-border bg-card divide-y divide-border">
              {results.map((c, idx) => (
                <button
                  key={`${c.phone_number}_${c.whose}_${idx}`}
                  type="button"
                  onClick={() => handlePick(c)}
                  className="w-full text-left p-2.5 hover:bg-accent/60 transition-colors flex items-center justify-between gap-2 cursor-pointer group"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-foreground truncate group-hover:text-primary">
                      {c.whose || "İsimsiz"}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {c.phone_number ? formatPhoneDisplay(c.phone_number) : "Telefonsuz"}
                      {c.address ? ` · ${c.address}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-primary/10 text-primary">
                      Son: {c.lastYear}
                    </span>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {c.count} sezon kayıtlı
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {hasSearched && !isPending && results.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-2">
              Eşleşen eski müşteri kaydı bulunamadı.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
