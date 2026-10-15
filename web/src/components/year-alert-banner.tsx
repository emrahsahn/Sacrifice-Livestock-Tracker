"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Sezon } from "@/lib/types";
import { selectYear } from "@/actions/seasons";
import { AlertCircle, Lock, ArrowRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface YearAlertBannerProps {
  currentSeason: Sezon;
  defaultSeason?: Sezon;
}

export function YearAlertBanner({
  currentSeason,
  defaultSeason,
}: YearAlertBannerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const isClosed = currentSeason.durum === "kapali";
  const isNotDefault = defaultSeason && currentSeason.yil !== defaultSeason.yil;

  if (!isClosed && !isNotDefault) {
    return null;
  }

  function handleReturnToDefault() {
    if (!defaultSeason) return;
    startTransition(async () => {
      await selectYear(defaultSeason.yil);
      router.refresh();
    });
  }

  if (isClosed) {
    return (
      <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-500 shadow-sm animate-fade-slide-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-amber-500/20 p-2 text-amber-500 shrink-0">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">
                {currentSeason.yil} Sezonu Kapatılmıştır (Salt-Okunur)
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Bu sezondaki veriler yalnızca incelenebilir. Yeni kayıt ekleme, düzenleme ve silme işlemleri kilitlenmiştir.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {defaultSeason && isNotDefault && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleReturnToDefault}
                disabled={isPending}
                className="h-8 text-xs border-amber-500/40 text-foreground hover:bg-amber-500/20"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                {defaultSeason.yil} Sezonuna Dön
              </Button>
            )}
            <Button
              variant="default"
              size="sm"
              asChild
              className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white"
            >
              <Link href="/sezonlar">
                Sezonları Yönet
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-xl border border-primary/30 bg-primary/10 p-3.5 text-primary shadow-sm animate-fade-slide-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <AlertCircle className="h-4 w-4 shrink-0 text-primary" />
          <p className="text-xs font-medium text-foreground">
            Şu anda <strong className="text-primary">{currentSeason.yil} Sezonu</strong> arşivini görüntülüyorsunuz.
          </p>
        </div>
        {defaultSeason && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleReturnToDefault}
            disabled={isPending}
            className="h-7 text-xs border-primary/40 text-primary hover:bg-primary/20 shrink-0"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Aktif Sezona ({defaultSeason.yil}) Dön
          </Button>
        )}
      </div>
    </div>
  );
}
