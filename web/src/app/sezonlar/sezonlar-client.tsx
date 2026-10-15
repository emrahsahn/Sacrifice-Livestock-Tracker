"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Sezon } from "@/lib/types";
import {
  createSeason,
  deleteSeason,
  selectYear,
  setDefaultSeason,
  toggleSeasonStatus,
} from "@/actions/seasons";
import { formatPrice } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Calendar,
  CheckCircle2,
  Lock,
  Unlock,
  Plus,
  Star,
  Trash2,
  ArrowRight,
  AlertTriangle,
  Loader2,
} from "lucide-react";

export interface SeasonWithStats extends Sezon {
  kucukbasCount: number;
  buyukbasCount: number;
  totalAnimals: number;
  totalExpected: number;
  totalCollected: number;
  totalUnpaid: number;
}

interface SezonlarClientProps {
  seasons: SeasonWithStats[];
  activeYear: number;
}

export function SezonlarClient({ seasons, activeYear }: SezonlarClientProps) {
  const router = useRouter();

  // Yeni Sezon Ekleme Modalı
  const [addOpen, setAddOpen] = useState(false);
  const nextYearSuggestion = Math.max(...seasons.map((s) => s.yil), new Date().getFullYear()) + 1;
  const [newYil, setNewYil] = useState<number>(nextYearSuggestion);
  const [newAd, setNewAd] = useState<string>(`${nextYearSuggestion} Kurban Sezonu`);
  const [newNotlar, setNewNotlar] = useState<string>("");
  const [newIsDefault, setNewIsDefault] = useState<boolean>(false);
  const [newSwitchAfter, setNewSwitchAfter] = useState<boolean>(true);

  // Aksiyon Onay Modalı
  const [confirmDialog, setConfirmDialog] = useState<{
    type: "close" | "reopen" | "default" | "delete";
    season: SeasonWithStats;
  } | null>(null);

  // Yüklenme & Hata Durumları
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  function notifySuccess(msg: string) {
    setActionSuccess(msg);
    setTimeout(() => setActionSuccess(""), 4000);
  }

  async function handleSwitchYear(yil: number) {
    setIsSubmitting(true);
    setActionError("");
    try {
      await selectYear(yil);
      router.refresh();
      notifySuccess(`Aktif sezon ${yil} olarak değiştirildi.`);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Sezon değiştirilemedi.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCreateSeason(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setActionError("");

    try {
      const res = await createSeason({
        yil: Number(newYil),
        ad: newAd,
        is_default: newIsDefault,
        notlar: newNotlar,
        switchAfter: newSwitchAfter,
      });

      if (res?.error) {
        setActionError(res.error);
      } else {
        setAddOpen(false);
        router.refresh();
        notifySuccess(`${newYil} sezonu başarıyla oluşturuldu!`);
      }
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Sezon oluşturulamadı.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function executeConfirmAction() {
    if (!confirmDialog) return;
    setIsSubmitting(true);
    setActionError("");

    const { type, season } = confirmDialog;
    try {
      if (type === "close") {
        const res = await toggleSeasonStatus(season.yil, "kapali");
        if (res?.error) setActionError(res.error);
        else notifySuccess(`${season.yil} sezonu arşive alındı ve kilitlendi.`);
      } else if (type === "reopen") {
        const res = await toggleSeasonStatus(season.yil, "acik");
        if (res?.error) setActionError(res.error);
        else notifySuccess(`${season.yil} sezonu yeniden düzenlemeye açıldı.`);
      } else if (type === "default") {
        const res = await setDefaultSeason(season.yil);
        if (res?.error) setActionError(res.error);
        else notifySuccess(`${season.yil} varsayılan sezon olarak ayarlandı.`);
      } else if (type === "delete") {
        const res = await deleteSeason(season.yil);
        if (res?.error) setActionError(res.error);
        else notifySuccess(`${season.yil} sezonu silindi.`);
      }
      setConfirmDialog(null);
      router.refresh();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "İşlem sırasında hata oluştu.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Üst Çubuk: Bildirimler & Yeni Ekle Butonu */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          {actionSuccess && (
            <div className="flex items-center gap-2 text-sm text-green font-medium animate-fade-slide-in">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{actionSuccess}</span>
            </div>
          )}
          {actionError && (
            <div className="flex items-center gap-2 text-sm text-destructive font-medium animate-fade-slide-in">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{actionError}</span>
            </div>
          )}
        </div>
        <Button
          onClick={() => {
            const next = Math.max(...seasons.map((s) => s.yil), new Date().getFullYear()) + 1;
            setNewYil(next);
            setNewAd(`${next} Kurban Sezonu`);
            setNewNotlar("");
            setNewIsDefault(false);
            setNewSwitchAfter(true);
            setAddOpen(true);
          }}
          className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-md self-start sm:self-auto"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Yeni Sezon / Yıl Ekle
        </Button>
      </div>

      {/* Sezon Kartları Listesi */}
      <div className="space-y-4">
        {seasons.map((season) => {
          const isCurrentActive = season.yil === activeYear;
          const isClosed = season.durum === "kapali";
          const isDefault = Boolean(season.is_default);

          return (
            <div
              key={season.yil}
              className={`rounded-2xl border-2 p-5 sm:p-6 transition-all bg-card ${
                isCurrentActive
                  ? "border-primary shadow-lg ring-1 ring-primary/20"
                  : "border-border hover:border-border/80"
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                {/* Sol: Sezon Bilgisi ve Rozetler */}
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xl font-bold text-foreground">
                      {season.ad || `${season.yil} Kurban Sezonu`}
                    </span>
                    <span className="text-sm font-semibold px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                      {season.yil}
                    </span>

                    {/* Aktif Rozeti */}
                    {isCurrentActive && (
                      <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30">
                        <CheckCircle2 className="h-3 w-3" />
                        Şu An Görüntülenen
                      </span>
                    )}

                    {/* Varsayılan Rozeti */}
                    {isDefault && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-gold/15 text-gold border border-gold/30">
                        <Star className="h-3 w-3 fill-gold" />
                        Varsayılan
                      </span>
                    )}

                    {/* Durum Rozeti */}
                    {isClosed ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-500 border border-amber-500/30">
                        <Lock className="h-3 w-3" />
                        Kapalı (Arşiv)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-green/15 text-green border border-green/30">
                        <Unlock className="h-3 w-3" />
                        Açık
                      </span>
                    )}
                  </div>

                  {season.notlar && (
                    <p className="text-xs text-muted-foreground italic">
                      📝 {season.notlar}
                    </p>
                  )}
                </div>

                {/* Sağ: Aksiyon Butonları */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {/* Sezon Değiştir */}
                  {!isCurrentActive ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSwitchYear(season.yil)}
                      disabled={isSubmitting}
                      className="border-primary/40 text-primary hover:bg-primary/10"
                    >
                      <ArrowRight className="h-4 w-4 mr-1" />
                      Bu Sezona Geç
                    </Button>
                  ) : (
                    <span className="text-xs font-semibold text-primary px-3 py-1.5 rounded-lg bg-primary/10">
                      Aktif Sezon
                    </span>
                  )}

                  {/* Varsayılan Yap */}
                  {!isDefault && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmDialog({ type: "default", season })}
                      disabled={isSubmitting}
                      className="text-muted-foreground hover:text-gold"
                      title="Yeni oturumlarda varsayılan sezon olarak açılır"
                    >
                      <Star className="h-4 w-4 mr-1" />
                      Varsayılan Yap
                    </Button>
                  )}

                  {/* Kapat / Aç */}
                  {isClosed ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setConfirmDialog({ type: "reopen", season })}
                      disabled={isSubmitting}
                      className="border-green/30 text-green hover:bg-green/10"
                    >
                      <Unlock className="h-4 w-4 mr-1" />
                      Yeniden Aç
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setConfirmDialog({ type: "close", season })}
                      disabled={isSubmitting}
                      className="border-amber-500/30 text-amber-500 hover:bg-amber-500/10"
                    >
                      <Lock className="h-4 w-4 mr-1" />
                      Sezonu Kapat
                    </Button>
                  )}

                  {/* Sil (Yalnızca içi tamamen boş olanlar) */}
                  {season.totalAnimals === 0 && !isDefault && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmDialog({ type: "delete", season })}
                      disabled={isSubmitting}
                      className="text-destructive hover:bg-destructive/10"
                      title="Boş sezonu sil"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* İstatistikler Şeridi */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-border/60">
                <div className="bg-muted/30 rounded-xl p-3 text-center sm:text-left">
                  <span className="text-[11px] text-muted-foreground font-medium block">
                    Kayıtlı Hayvan
                  </span>
                  <span className="text-base sm:text-lg font-bold text-foreground">
                    {season.totalAnimals} adet
                  </span>
                  <span className="text-[10px] text-muted-foreground block">
                    {season.kucukbasCount} Küçük · {season.buyukbasCount} Büyük
                  </span>
                </div>

                <div className="bg-muted/30 rounded-xl p-3 text-center sm:text-left">
                  <span className="text-[11px] text-muted-foreground font-medium block">
                    Anlaşılan Ciro
                  </span>
                  <span className="text-base sm:text-lg font-bold text-gold">
                    {formatPrice(season.totalExpected)} ₺
                  </span>
                  <span className="text-[10px] text-muted-foreground block">
                    Toplam anlaşma
                  </span>
                </div>

                <div className="bg-muted/30 rounded-xl p-3 text-center sm:text-left">
                  <span className="text-[11px] text-muted-foreground font-medium block">
                    Tahsil Edilen
                  </span>
                  <span className="text-base sm:text-lg font-bold text-green">
                    {formatPrice(season.totalCollected)} ₺
                  </span>
                  <span className="text-[10px] text-muted-foreground block">
                    Tahsilat oranı: %
                    {season.totalExpected > 0
                      ? Math.round((season.totalCollected / season.totalExpected) * 100)
                      : 0}
                  </span>
                </div>

                <div className="bg-muted/30 rounded-xl p-3 text-center sm:text-left">
                  <span className="text-[11px] text-muted-foreground font-medium block">
                    Kalan Alacak (Borç)
                  </span>
                  <span className="text-base sm:text-lg font-bold text-red">
                    {formatPrice(season.totalUnpaid)} ₺
                  </span>
                  <span className="text-[10px] text-muted-foreground block">
                    Bekleyen ödeme
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── YENİ SEZON EKLEME MODALI ── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Yeni Kurban Sezonu Ekle
            </DialogTitle>
            <DialogDescription>
              Gelecek veya geçmiş bir yılı sisteme ekleyin. İlgili yıla ait veriler bağımsız saklanır.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateSeason} className="space-y-4 pt-2">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5 col-span-1">
                <Label htmlFor="season-yil">Yıl *</Label>
                <Input
                  id="season-yil"
                  type="number"
                  min={2020}
                  max={2100}
                  value={newYil}
                  onChange={(e) => {
                    const y = Number(e.target.value);
                    setNewYil(y);
                    setNewAd(`${y} Kurban Sezonu`);
                  }}
                  required
                />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="season-ad">Sezon Adı *</Label>
                <Input
                  id="season-ad"
                  value={newAd}
                  onChange={(e) => setNewAd(e.target.value)}
                  placeholder="Örn: 2027 Kurban Sezonu"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="season-notlar">Notlar (Opsiyonel)</Label>
              <Textarea
                id="season-notlar"
                value={newNotlar}
                onChange={(e) => setNewNotlar(e.target.value)}
                placeholder="Bu sezon ile ilgili hatırlatıcı notlar..."
                rows={2}
              />
            </div>

            <div className="space-y-2 pt-2 border-t border-border">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={newSwitchAfter}
                  onChange={(e) => setNewSwitchAfter(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary"
                />
                <span>Oluşturduktan sonra hemen bu sezona geç</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={newIsDefault}
                  onChange={(e) => setNewIsDefault(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary"
                />
                <span>Sistemin varsayılan sezonu yap</span>
              </label>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddOpen(false)}
                disabled={isSubmitting}
              >
                İptal
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Oluşturuluyor...
                  </>
                ) : (
                  "Sezonu Oluştur"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── İŞLEM ONAY MODALI ── */}
      <Dialog open={confirmDialog !== null} onOpenChange={(open) => !open && setConfirmDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {confirmDialog?.type === "close" && `${confirmDialog.season.yil} Sezonunu Kapat`}
              {confirmDialog?.type === "reopen" && `${confirmDialog.season.yil} Sezonunu Yeniden Aç`}
              {confirmDialog?.type === "default" && `${confirmDialog.season.yil} Sezonunu Varsayılan Yap`}
              {confirmDialog?.type === "delete" && `${confirmDialog.season.yil} Sezonunu Sil`}
            </DialogTitle>
            <DialogDescription className="pt-2 text-sm text-foreground">
              {confirmDialog?.type === "close" && (
                <>
                  Bu sezon kapatıldığında <strong>salt okunur (arşiv)</strong> moduna geçecektir.
                  Yeni müşteri/hayvan eklenemez, mevcut kayıtlar silinemez veya düzenlenemez.
                  İstediğiniz zaman tekrar açabilirsiniz. Devam etmek istiyor musunuz?
                </>
              )}
              {confirmDialog?.type === "reopen" && (
                <>
                  Bu sezon yeniden düzenlemeye açılacak ve yeni kayıt ekleme / güncelleme işlemleri
                  aktif olacaktır. Onaylıyor musunuz?
                </>
              )}
              {confirmDialog?.type === "default" && (
                <>
                  {confirmDialog.season.yil} sezonu, tüm kullanıcılar ve yeni oturumlar için varsayılan sezon
                  olarak belirlenecektir. Onaylıyor musunuz?
                </>
              )}
              {confirmDialog?.type === "delete" && (
                <>
                  {confirmDialog.season.yil} sezon kaydı tamamen silinecektir. Bu işlem geri alınamaz.
                  Onaylıyor musunuz?
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmDialog(null)}
              disabled={isSubmitting}
            >
              Vazgeç
            </Button>
            <Button
              type="button"
              variant={confirmDialog?.type === "delete" ? "destructive" : "default"}
              onClick={executeConfirmAction}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  İşleniyor...
                </>
              ) : (
                "Onayla"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
