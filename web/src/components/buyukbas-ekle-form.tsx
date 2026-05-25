"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import type { FieldPath } from "react-hook-form";
import {
  buyukbasHayvanCreateSchema,
  type BuyukbasHayvanCreateInput,
} from "@/lib/validations";
import { createBuyukbasHayvan } from "@/actions/buyukbas";
import { BUYUKBAS_GROUP_CATEGORIES, PAYMENT_OPTIONS } from "@/lib/types";
import { computeHisseBirimFiyat, isDistributionGroup } from "@/lib/buyukbas-utils";
import { fieldHasError, invalidFieldClass } from "@/lib/form-field-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, Plus, Trash2 } from "lucide-react";
import { formatMoneyInputTR, formatPhoneInputTR } from "@/lib/input-format";
import { formatPrice } from "@/lib/utils";

const defaultHissedar = {
  whose: "",
  phone_number: "",
  alinan_hisse: 1,
  price: "",
  payment_method: "",
  payment_status: "Belirsiz" as const,
  address: "",
  note: "",
};

export function BuyukbasEkleForm() {
  const router = useRouter();
  const [success, setSuccess] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<BuyukbasHayvanCreateInput>({
    resolver: zodResolver(buyukbasHayvanCreateSchema),
    defaultValues: {
      toplam_hisse: 7,
      hayvan_fiyati: "",
      group_category: "",
      hissedarlar: [{ ...defaultHissedar }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "hissedarlar" });

  const toplamHisse = Number(watch("toplam_hisse")) || 0;
  const hayvanFiyatiRaw = watch("hayvan_fiyati");
  const hayvanFiyati =
    typeof hayvanFiyatiRaw === "number"
      ? hayvanFiyatiRaw
      : parseFloat(String(hayvanFiyatiRaw).replace(/\./g, "").replace(",", ".")) || 0;
  const birim = computeHisseBirimFiyat(hayvanFiyati, toplamHisse);

  const groupCategory = watch("group_category") ?? "";
  const showAddress = isDistributionGroup(groupCategory);
  const deliveryAddress = watch("hissedarlar.0.address") ?? "";

  /** Teslimat adresi tüm hissedar satırlarına kopyalanır (DB hissedar bazlı). */
  useEffect(() => {
    if (!showAddress) return;
    fields.forEach((_, i) => {
      setValue(`hissedarlar.${i}.address`, deliveryAddress, { shouldDirty: i > 0 });
    });
  }, [deliveryAddress, showAddress, fields, setValue]);

  function fieldErr(name: FieldPath<BuyukbasHayvanCreateInput>) {
    return fieldHasError(errors, name);
  }

  function hf(index: number, suffix: string) {
    return `hissedarlar.${index}.${suffix}` as FieldPath<BuyukbasHayvanCreateInput>;
  }

  async function onSubmit(values: BuyukbasHayvanCreateInput) {
    const result = await createBuyukbasHayvan(values);
    if (result?.error) {
      const msg = result.error;
      if (/numara|kayıtlı/i.test(msg)) {
        setError("number", { type: "server", message: msg });
      } else if (/hisse|pay/i.test(msg)) {
        setError("hissedarlar", { type: "server", message: msg });
      } else {
        setError("number", { type: "server", message: msg });
      }
    } else {
      setSuccess(true);
      setTimeout(() => router.push("/musteriler"), 1500);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 md:p-6 shadow-sm">
      {success && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-green-700/20 border border-green-700 px-4 py-3 text-green-400">
          <CheckCircle2 className="h-5 w-5" />
          ✅ Büyükbaş hayvan kaydedildi! Yönlendiriliyor...
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
        <section className="space-y-4">
          <h3 className="text-base font-semibold text-muted-foreground border-b border-border pb-2">
            🐄 Hayvan Bilgileri
          </h3>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="bb-number" className={fieldErr("number") ? "text-destructive" : undefined}>
              🔢 Hayvan Numarası *
            </Label>
            <Input
              id="bb-number"
              placeholder="Örn: 501"
              aria-invalid={fieldErr("number")}
              className={invalidFieldClass(fieldErr("number"))}
              {...register("number")}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className={fieldErr("toplam_hisse") ? "text-destructive" : undefined}>
                🧩 Toplam Hisse *
              </Label>
              <Input
                type="number"
                min={1}
                aria-invalid={fieldErr("toplam_hisse")}
                className={invalidFieldClass(fieldErr("toplam_hisse"))}
                {...register("toplam_hisse", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-2">
              <Label className={fieldErr("hayvan_fiyati") ? "text-destructive" : undefined}>
                💰 Hayvan Fiyatı (TL) *
              </Label>
              <Controller
                name="hayvan_fiyati"
                control={control}
                render={({ field }) => (
                  <Input
                    inputMode="decimal"
                    placeholder="Örn: 280.000,00"
                    aria-invalid={fieldErr("hayvan_fiyati")}
                    className={invalidFieldClass(fieldErr("hayvan_fiyati"))}
                    value={typeof field.value === "number" ? String(field.value) : field.value ?? ""}
                    onChange={(e) => field.onChange(formatMoneyInputTR(e.target.value))}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                  />
                )}
              />
            </div>
          </div>

          {toplamHisse > 0 && hayvanFiyati > 0 && (
            <p className="text-sm text-gold font-semibold">
              💡 Hisse birim fiyatı: {formatPrice(birim)} ₺
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>🐄 Cinsi</Label>
              <Input {...register("type")} placeholder="Örn: İnek, Dana" />
            </div>
            <div className="space-y-2">
              <Label>✨ Ekstra Özellik</Label>
              <Input {...register("special")} placeholder="Örn: Gebe" />
            </div>
            <div className="space-y-2">
              <Label>🏷️ Küpe Rengi</Label>
              <Input {...register("color_of_earring")} placeholder="Örn: Sarı" />
            </div>
            <div className="space-y-2">
              <Label>🎨 Hayvan Rengi</Label>
              <Input {...register("color_of_animal")} placeholder="Örn: Alaca" />
            </div>
            <div className="space-y-2">
              <Label>🎨 Sıkılan Boya</Label>
              <Input {...register("spray_paint_color")} placeholder="Örn: Boynuza kırmızı" />
            </div>
            <div className="space-y-2">
              <Label>📦 Kimden Alındı</Label>
              <Input {...register("from_whom")} placeholder="Tedarikçi adı" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>📂 Grup Kategorisi</Label>
            <Select
              value={groupCategory || "__none__"}
              onValueChange={(v) =>
                setValue("group_category", v === "__none__" ? "" : v, {
                  shouldDirty: true,
                  shouldTouch: true,
                })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Grup Seçin (Opsiyonel)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Grup Seçilmedi —</SelectItem>
                {BUYUKBAS_GROUP_CATEGORIES.map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {showAddress && (
            <div className="space-y-2">
              <Label htmlFor="bb-delivery-address">📍 Teslimat Adresi</Label>
              <Input
                id="bb-delivery-address"
                placeholder="Açık adres giriniz..."
                {...register("hissedarlar.0.address")}
              />
              {fields.length > 1 && (
                <p className="text-xs text-muted-foreground">
                  Bu adres tüm hissedar kayıtlarına uygulanır.
                </p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>📝 Not</Label>
            <Textarea
              rows={3}
              placeholder="Önemli notlarınızı buraya yazabilirsiniz..."
              className="resize-y min-h-[72px]"
              {...register("note")}
            />
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <h3
              className={`text-base font-semibold text-muted-foreground ${fieldErr("hissedarlar") ? "text-destructive" : ""}`}
            >
              👥 Hissedarlar
            </h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                append({
                  ...defaultHissedar,
                  address: showAddress ? deliveryAddress : "",
                })
              }
            >
              <Plus className="h-4 w-4 mr-1" /> ➕ Hissedar Ekle
            </Button>
          </div>

          {fields.map((field, index) => {
            const rowHasError =
              fieldErr(hf(index, "alinan_hisse")) ||
              fieldErr(hf(index, "phone_number")) ||
              fieldErr(hf(index, "price"));

            return (
              <div
                key={field.id}
                className={`rounded-lg border p-4 space-y-3 bg-muted/20 ${
                  rowHasError ? "border-destructive/60" : "border-border"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">👤 Hissedar {index + 1}</span>
                  {fields.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>👤 Sahip (Müşteri)</Label>
                    <Input {...register(hf(index, "whose"))} placeholder="Ad Soyad" />
                  </div>
                  <div className="space-y-2">
                    <Label className={fieldErr(hf(index, "alinan_hisse")) ? "text-destructive" : undefined}>
                      🧩 Alınan Hisse *
                    </Label>
                    <Input
                      type="number"
                      min={1}
                      aria-invalid={fieldErr(hf(index, "alinan_hisse"))}
                      className={invalidFieldClass(fieldErr(hf(index, "alinan_hisse")))}
                      {...register(hf(index, "alinan_hisse"), { valueAsNumber: true })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className={fieldErr(hf(index, "phone_number")) ? "text-destructive" : undefined}>
                      📞 Telefon Numarası
                    </Label>
                    <Controller
                      name={hf(index, "phone_number")}
                      control={control}
                      render={({ field: f }) => (
                        <Input
                          inputMode="tel"
                          autoComplete="tel"
                          placeholder="Örn: 0532 123 45 67"
                          aria-invalid={fieldErr(hf(index, "phone_number"))}
                          className={invalidFieldClass(fieldErr(hf(index, "phone_number")))}
                          value={String(f.value ?? "")}
                          onChange={(e) => f.onChange(formatPhoneInputTR(e.target.value))}
                          onBlur={f.onBlur}
                          name={f.name}
                          ref={f.ref}
                        />
                      )}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className={fieldErr(hf(index, "price")) ? "text-destructive" : undefined}>
                      💰 Kalan / Fiyat (TL)
                    </Label>
                    <Controller
                      name={hf(index, "price")}
                      control={control}
                      render={({ field: f }) => (
                        <Input
                          inputMode="decimal"
                          placeholder="Boş = otomatik"
                          aria-invalid={fieldErr(hf(index, "price"))}
                          className={invalidFieldClass(fieldErr(hf(index, "price")))}
                          value={
                            typeof f.value === "number"
                              ? String(f.value)
                              : String(f.value ?? "")
                          }
                          onChange={(e) => f.onChange(formatMoneyInputTR(e.target.value))}
                          onBlur={f.onBlur}
                          name={f.name}
                          ref={f.ref}
                        />
                      )}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>📋 Ödeme Durumu</Label>
                    <Controller
                      name={hf(index, "payment_status")}
                      control={control}
                      render={({ field: f }) => (
                        <Select
                          value={String(f.value ?? "Belirsiz")}
                          onValueChange={f.onChange}
                        >
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
                      )}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        <Button type="submit" className="w-full mt-2" disabled={isSubmitting}>
          {isSubmitting ? "Kaydediliyor..." : "✅ Büyükbaş Kaydını Oluştur"}
        </Button>
      </form>
    </div>
  );
}
