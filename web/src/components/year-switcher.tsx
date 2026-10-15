"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Sezon } from "@/lib/types";
import { selectYear } from "@/actions/seasons";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, Lock, Settings } from "lucide-react";

interface YearSwitcherProps {
  currentYear: number;
  seasons: Sezon[];
  className?: string;
  compact?: boolean;
}

export function YearSwitcher({
  currentYear,
  seasons,
  className = "",
  compact = false,
}: YearSwitcherProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const activeSeason = seasons.find((s) => s.yil === currentYear);

  async function handleValueChange(val: string) {
    if (val === "__manage__") {
      router.push("/sezonlar");
      return;
    }

    const yearNum = parseInt(val, 10);
    if (!Number.isFinite(yearNum) || yearNum === currentYear) return;

    startTransition(async () => {
      await selectYear(yearNum);
      router.refresh();
    });
  }

  return (
    <div className={`relative ${className}`}>
      <Select
        value={String(currentYear)}
        onValueChange={handleValueChange}
        disabled={isPending}
      >
        <SelectTrigger
          className={`h-9 border-border bg-sidebar text-xs font-semibold focus:ring-1 focus:ring-primary ${
            compact ? "w-[105px] sm:w-28 px-2" : "w-full"
          } ${activeSeason?.durum === "kapali" ? "border-amber-500/50 text-amber-500" : ""}`}
        >
          <div className="flex items-center gap-1.5 truncate">
            <Calendar className="h-3.5 w-3.5 shrink-0 text-primary" />
            <SelectValue placeholder="Sezon Seç">
              <span className="truncate">
                {currentYear} Sezonu
                {activeSeason?.durum === "kapali" && " 🔒"}
              </span>
            </SelectValue>
          </div>
        </SelectTrigger>
        <SelectContent align="start" className="min-w-[13rem]">
          <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Çalışma Sezonu
          </div>
          {seasons.map((s) => (
            <SelectItem key={s.yil} value={String(s.yil)} className="text-xs">
              <div className="flex items-center justify-between gap-2 w-full">
                <span className="font-semibold text-foreground">
                  {s.yil} {s.ad && s.ad !== `${s.yil} Kurban Sezonu` ? `· ${s.ad}` : ""}
                </span>
                <span className="flex items-center gap-1">
                  {s.is_default && (
                    <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded font-medium">
                      Aktif
                    </span>
                  )}
                  {s.durum === "kapali" && (
                    <span className="inline-flex items-center text-[10px] bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded font-medium gap-0.5">
                      <Lock className="h-2.5 w-2.5" /> Kapalı
                    </span>
                  )}
                </span>
              </div>
            </SelectItem>
          ))}
          <SelectSeparator />
          <SelectItem value="__manage__" className="text-xs text-primary font-medium cursor-pointer">
            <div className="flex items-center gap-2">
              <Settings className="h-3.5 w-3.5" />
              <span>Sezonları Yönet</span>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
