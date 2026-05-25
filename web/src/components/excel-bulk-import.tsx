"use client";
import { useRef, useState, useCallback } from "react";
import * as XLSX from "xlsx";
import { importBuyukbasBulk } from "@/actions/buyukbas";
import { addCustomersBulk, type BulkSkippedRow } from "@/actions/customers";
import {
  groupBuyukbasRows,
  isBuyukbasHeaders,
  parseBuyukbasExcelRows,
  type BuyukbasParsedRow,
} from "@/lib/excel-buyukbas-parser";
import { PAYMENT_OPTIONS, GROUP_CATEGORIES } from "@/lib/types";
import { CustomerFormValues } from "@/lib/validations";
import { formatMoneyInputTR, formatPhoneInputTR } from "@/lib/input-format";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Upload,
  FileText,
  Loader2,
} from "lucide-react";

// ─── Excel helpers ─────────────────────────────────────────────────────────────

function normH(text: string) {
  return text
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\uFEFF/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Sayfa adı: Kucukbas, Küçükbaş, buyukbas, Büyükbaş vb. */
function findSheetByKind(
  names: string[],
  kind: "kucukbas" | "buyukbas"
): string | undefined {
  return names.find((n) => {
    const h = normH(n);
    if (kind === "kucukbas") {
      return h.includes("kucuk") || h.includes("kucukbas");
    }
    return h.includes("buyuk") || h.includes("buyukbas");
  });
}

interface ParsedRow {
  rowIndex: number;
  raw: Record<string, string>;
  formData: Partial<CustomerFormValues>;
  validationError?: string;
}

function parseExcelRows(data: any[][]): { rows: ParsedRow[]; headerError?: string } {
  if (data.length < 2) return { rows: [], headerError: "Excel dosyası en az bir başlık ve bir veri satırı içermeli." };

  const headers = data[0].map((h: any) => normH(String(h || "")));
  const rows: ParsedRow[] = [];

  for (let i = 1; i < data.length; i++) {
    const cols = data[i];
    if (!cols || cols.length === 0 || cols.every((c: any) => c === null || c === undefined || c === "")) continue;

    const map = new Map<string, string>();
    headers.forEach((h: string, idx: number) => map.set(h, String(cols[idx] ?? "").trim()));
    const get = (h: string) => map.get(normH(h)) ?? "";

    // Hayvan numarası: tekil ya da virgülle ayrılmış birden fazla numara olabilir.
    // Geçerli karakterler: rakam, virgül, boşluk. Diğer her karakter ayıklanır.
    const rawNum = get("Numara").trim();
    const cleanedNum = rawNum.replace(/[^\d,\s]/g, "").trim();
    const num = cleanedNum
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .join(", ");
    const rawPhone = get("Telefon").trim();
    let validationError: string | undefined;
    if (!num) {
      validationError = "Hayvan numarası boş veya geçersiz.";
    } else if (!/^\d+(\s*,\s*\d+)*$/.test(num)) {
      validationError = "Hayvan numarası rakamlardan oluşmalı; birden fazla için virgülle ayırın.";
    } else if (rawPhone) {
      const digits = rawPhone.replace(/\D/g, "");
      // Telefon opsiyonel; girildiyse en az 10 hane (operator + numara) içermeli.
      if (digits.length > 0 && digits.length < 10) {
        validationError = "Telefon numarası girildiyse geçerli formatta olmalıdır.";
      }
    }

    const parsedStatus = get("Ödeme Durumu");
    const parsedGroup = get("Grup Kategorisi");
    
    const payStatus = PAYMENT_OPTIONS.includes(parsedStatus as any)
      ? (parsedStatus as CustomerFormValues["payment_status"])
      : "Belirsiz";
    const groupCat = GROUP_CATEGORIES.includes(parsedGroup as (typeof GROUP_CATEGORIES)[number])
      ? parsedGroup
      : "";

    rows.push({
      rowIndex: i,
      raw: Object.fromEntries(map),
      formData: {
        number: num,
        type: get("Cins"),
        special: get("Özellik"),
        color_of_earring: get("Küpe Rengi"),
        color_of_animal: get("Hayvan Rengi"),
        spray_paint_color: get("Sıkılan Boya"),
        whose: get("Sahip"),
        from_whom: get("Kimden"),
        price: formatMoneyInputTR(get("Fiyat (TL)")),
        phone_number: formatPhoneInputTR(get("Telefon")),
        payment_method: get("Ödeme Detayı"),
        payment_status: payStatus,
        group_category: groupCat,
        address: get("Adres"),
        note: get("Not"),
      },
      validationError,
    });
  }

  return { rows };
}

// ─── Component ────────────────────────────────────────────────────────────────

interface BulkResult {
  inserted: number;
  skipped: BulkSkippedRow[];
  buyukbasAnimals?: number;
  buyukbasHissedarlar?: number;
  buyukbasSkipped?: { rowIndex: number; number: string; reason: string }[];
}

export default function ExcelBulkImport() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState("");
  const [headerError, setHeaderError] = useState("");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [buyukbasRows, setBuyukbasRows] = useState<BuyukbasParsedRow[]>([]);
  const [importMode, setImportMode] = useState<"kucukbas" | "buyukbas" | "mixed">("kucukbas");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BulkResult | null>(null);
  const [serverError, setServerError] = useState("");

  const validRows = rows.filter((r) => !r.validationError);
  const invalidRows = rows.filter((r) => r.validationError);

  const processFile = useCallback(async (file: File) => {
    setResult(null);
    setServerError("");
    setHeaderError("");
    setRows([]);
    setBuyukbasRows([]);
    setFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });

      let kucukRows: ParsedRow[] = [];
      let buyukRows: BuyukbasParsedRow[] = [];

      const kucukSheet = findSheetByKind(workbook.SheetNames, "kucukbas");
      const buyukSheet = findSheetByKind(workbook.SheetNames, "buyukbas");
      const sheetErrors: string[] = [];

      if (kucukSheet || buyukSheet) {
        if (kucukSheet) {
          const data = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[kucukSheet], {
            header: 1,
            defval: "",
          });
          const { rows: parsed, headerError: hErr } = parseExcelRows(data);
          if (hErr) sheetErrors.push(`Küçükbaş (${kucukSheet}): ${hErr}`);
          else kucukRows = parsed;
        }
        if (buyukSheet) {
          const data = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[buyukSheet], {
            header: 1,
            defval: "",
          });
          const { rows: parsed, headerError: hErr } = parseBuyukbasExcelRows(data);
          if (hErr) sheetErrors.push(`Büyükbaş (${buyukSheet}): ${hErr}`);
          else buyukRows = parsed;
        }
        if (sheetErrors.length > 0 && kucukRows.length === 0 && buyukRows.length === 0) {
          setHeaderError(sheetErrors.join(" "));
          return;
        }
        if (sheetErrors.length > 0) {
          setHeaderError(sheetErrors.join(" "));
        }
        setImportMode(
          kucukRows.length > 0 && buyukRows.length > 0
            ? "mixed"
            : buyukRows.length > 0
              ? "buyukbas"
              : "kucukbas"
        );
      } else {
        const firstSheetName = workbook.SheetNames[0];
        const data = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[firstSheetName], {
          header: 1,
          defval: "",
        });
        const headers = (data[0] ?? []).map((h) => String(h ?? ""));
        if (isBuyukbasHeaders(headers)) {
          const { rows: parsed, headerError: hErr } = parseBuyukbasExcelRows(data);
          if (hErr) {
            setHeaderError(hErr);
            return;
          }
          buyukRows = parsed;
          setImportMode("buyukbas");
        } else {
          const { rows: parsed, headerError: hErr } = parseExcelRows(data);
          if (hErr) {
            setHeaderError(hErr);
            return;
          }
          kucukRows = parsed;
          setImportMode("kucukbas");
        }
      }

      setRows(kucukRows);
      setBuyukbasRows(buyukRows);
    } catch (err) {
      console.error(err);
      setHeaderError("Dosya okunamadı. Geçerli bir Excel (.xlsx, .xls) dosyası olduğundan emin olun.");
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const validBuyuk = buyukbasRows.filter((r) => !r.validationError);
  const invalidBuyuk = buyukbasRows.filter((r) => r.validationError);

  async function handleBulkAdd() {
    if (validRows.length === 0 && validBuyuk.length === 0) return;
    setLoading(true);
    setServerError("");
    setResult(null);

    let inserted = 0;
    let skipped: BulkSkippedRow[] = [];
    let buyukbasAnimals = 0;
    let buyukbasHissedarlar = 0;
    let buyukbasSkipped: { rowIndex: number; number: string; reason: string }[] = [];

    if (validRows.length > 0) {
      const payload = validRows.map((r) => r.formData);
      const res = await addCustomersBulk(payload);
      if ("error" in res) {
        setServerError(res.error);
        setLoading(false);
        return;
      }
      inserted = res.inserted;
      skipped = res.skipped;
    }

    if (validBuyuk.length > 0) {
      const groups = groupBuyukbasRows(validBuyuk);
      const res = await importBuyukbasBulk(groups);
      if ("error" in res) {
        setServerError(res.error);
        setLoading(false);
        return;
      }
      buyukbasAnimals = res.insertedAnimals;
      buyukbasHissedarlar = res.insertedHissedarlar;
      buyukbasSkipped = res.skipped;
    }

    setLoading(false);
    setResult({
      inserted,
      skipped,
      buyukbasAnimals,
      buyukbasHissedarlar,
      buyukbasSkipped,
    });
    setRows([]);
    setBuyukbasRows([]);
    setFileName("");
  }

  return (
    <div className="space-y-5">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className="cursor-pointer rounded-xl border-2 border-dashed transition-all duration-200 flex flex-col items-center justify-center gap-3 py-10 px-6 text-center"
        style={{
          borderColor: isDragging ? "var(--color-primary)" : "var(--color-border)",
          background: isDragging ? "color-mix(in srgb, var(--color-primary) 8%, transparent)" : "var(--color-muted)",
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx, .xls"
          className="hidden"
          onChange={async (e) => {
            const target = e.target;
            const f = target.files?.[0];
            if (f) {
              await processFile(f);
            }
            if (target) {
              target.value = "";
            }
          }}
        />
        <div className="rounded-full p-3" style={{ background: "color-mix(in srgb, var(--color-primary) 12%, transparent)" }}>
          <Upload className="h-7 w-7" style={{ color: "var(--color-primary)" }} />
        </div>
        <div>
          <p className="font-semibold text-foreground">
            {fileName ? fileName : "Excel dosyasını buraya sürükle veya tıkla"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Yalnızca .xlsx, .xls formatları desteklenir</p>
        </div>
        {fileName && !headerError && (rows.length > 0 || buyukbasRows.length > 0) && (
          <div className="flex items-center gap-2 text-sm font-medium" style={{ color: "var(--color-primary)" }}>
            <FileText className="h-4 w-4" />
            {importMode === "mixed"
              ? `${rows.length} küçükbaş · ${buyukbasRows.length} büyükbaş satır`
              : importMode === "buyukbas"
                ? `${buyukbasRows.length} büyükbaş satır`
                : `${rows.length} küçükbaş satır`}
          </div>
        )}
      </div>

      {/* Header error */}
      {headerError && (
        <div className="flex items-center gap-2 rounded-lg px-4 py-3 text-sm border"
          style={{ background: "color-mix(in srgb, var(--color-destructive) 10%, transparent)", borderColor: "color-mix(in srgb, var(--color-destructive) 40%, transparent)", color: "var(--color-destructive)" }}>
          <XCircle className="h-4 w-4 shrink-0" />
          {headerError}
        </div>
      )}

      {/* Preview tables */}
      {(rows.length > 0 || buyukbasRows.length > 0) && (
        <div className="space-y-6">
          {rows.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-sm font-semibold text-foreground">🐑 Küçükbaş Önizleme</h3>
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1" style={{ color: "#22c55e" }}>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {validRows.length} geçerli
                  </span>
                  {invalidRows.length > 0 && (
                    <span className="flex items-center gap-1" style={{ color: "var(--color-destructive)" }}>
                      <XCircle className="h-3.5 w-3.5" />
                      {invalidRows.length} hatalı
                    </span>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-xs min-w-[680px]">
                  <thead>
                    <tr style={{ background: "var(--color-muted)" }}>
                      {["Satır", "Hayvan No(ları)", "Cins", "Sahip", "Fiyat (TL)", "Telefon", "Durum"].map((h) => (
                        <th key={h} className="text-left px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const isValid = !row.validationError;
                      return (
                        <tr
                          key={row.rowIndex}
                          className="border-t border-border"
                          style={{
                            background: isValid
                              ? "color-mix(in srgb, #22c55e 5%, transparent)"
                              : "color-mix(in srgb, var(--color-destructive) 6%, transparent)",
                          }}
                        >
                          <td className="px-3 py-2 text-muted-foreground font-mono">{row.rowIndex + 1}</td>
                          <td className="px-3 py-2 font-semibold text-foreground">
                            {row.formData.number || <span className="text-destructive italic">—</span>}
                          </td>
                          <td className="px-3 py-2 text-foreground">{row.formData.type || "—"}</td>
                          <td className="px-3 py-2 text-foreground">{row.formData.whose || "—"}</td>
                          <td className="px-3 py-2 text-foreground">{row.formData.price || "—"}</td>
                          <td className="px-3 py-2 text-foreground">{row.formData.phone_number || "—"}</td>
                          <td className="px-3 py-2">
                            {isValid ? (
                              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                                style={{ background: "color-mix(in srgb, #22c55e 15%, transparent)", color: "#16a34a" }}>
                                <CheckCircle2 className="h-3 w-3" /> Geçerli
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                                style={{ background: "color-mix(in srgb, var(--color-destructive) 15%, transparent)", color: "var(--color-destructive)" }}>
                                <XCircle className="h-3 w-3" /> Hatalı
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {invalidRows.length > 0 && (
                <div className="rounded-lg border p-3 space-y-2"
                  style={{ borderColor: "color-mix(in srgb, var(--color-destructive) 30%, transparent)", background: "color-mix(in srgb, var(--color-destructive) 5%, transparent)" }}>
                  <p className="text-xs font-semibold flex items-center gap-1.5" style={{ color: "var(--color-destructive)" }}>
                    <AlertTriangle className="h-3.5 w-3.5" /> Küçükbaş hatalı satırlar:
                  </p>
                  {invalidRows.map((r) => (
                    <p key={r.rowIndex} className="text-xs text-muted-foreground pl-5">
                      • Satır {r.rowIndex + 1}: {r.validationError}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {buyukbasRows.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-sm font-semibold text-violet-600">🐄 Büyükbaş Önizleme</h3>
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1" style={{ color: "#22c55e" }}>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {validBuyuk.length} geçerli
                  </span>
                  {invalidBuyuk.length > 0 && (
                    <span className="flex items-center gap-1" style={{ color: "var(--color-destructive)" }}>
                      <XCircle className="h-3.5 w-3.5" />
                      {invalidBuyuk.length} hatalı
                    </span>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-violet-500/30">
                <table className="w-full text-xs min-w-[820px]">
                  <thead>
                    <tr style={{ background: "color-mix(in srgb, #7c3aed 8%, var(--color-muted))" }}>
                      {[
                        "Satır",
                        "Hayvan No",
                        "Toplam Hisse",
                        "Hayvan Fiyatı",
                        "Sahip",
                        "Alınan Hisse",
                        "Telefon",
                        "Durum",
                      ].map((h) => (
                        <th key={h} className="text-left px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {buyukbasRows.map((row) => {
                      const isValid = !row.validationError;
                      return (
                        <tr
                          key={row.rowIndex}
                          className="border-t border-border"
                          style={{
                            background: isValid
                              ? "color-mix(in srgb, #7c3aed 5%, transparent)"
                              : "color-mix(in srgb, var(--color-destructive) 6%, transparent)",
                          }}
                        >
                          <td className="px-3 py-2 text-muted-foreground font-mono">{row.rowIndex + 1}</td>
                          <td className="px-3 py-2 font-semibold text-foreground">{row.number || "—"}</td>
                          <td className="px-3 py-2">{row.toplam_hisse || "—"}</td>
                          <td className="px-3 py-2">{row.hayvan_fiyati ? `${row.hayvan_fiyati}` : "—"}</td>
                          <td className="px-3 py-2">{row.whose || "—"}</td>
                          <td className="px-3 py-2">{row.alinan_hisse || "—"}</td>
                          <td className="px-3 py-2">{row.phone_number || "—"}</td>
                          <td className="px-3 py-2">
                            {isValid ? (
                              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                                style={{ background: "color-mix(in srgb, #22c55e 15%, transparent)", color: "#16a34a" }}>
                                <CheckCircle2 className="h-3 w-3" /> Geçerli
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                                style={{ background: "color-mix(in srgb, var(--color-destructive) 15%, transparent)", color: "var(--color-destructive)" }}>
                                <XCircle className="h-3 w-3" /> Hatalı
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {invalidBuyuk.length > 0 && (
                <div className="rounded-lg border p-3 space-y-2"
                  style={{ borderColor: "color-mix(in srgb, var(--color-destructive) 30%, transparent)", background: "color-mix(in srgb, var(--color-destructive) 5%, transparent)" }}>
                  <p className="text-xs font-semibold flex items-center gap-1.5" style={{ color: "var(--color-destructive)" }}>
                    <AlertTriangle className="h-3.5 w-3.5" /> Büyükbaş hatalı satırlar:
                  </p>
                  {invalidBuyuk.map((r) => (
                    <p key={r.rowIndex} className="text-xs text-muted-foreground pl-5">
                      • Satır {r.rowIndex + 1} (#{r.number || "?"}): {r.validationError}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          <Button
            onClick={handleBulkAdd}
            disabled={loading || (validRows.length === 0 && validBuyuk.length === 0)}
            className="w-full"
          >
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Ekleniyor...</>
            ) : (
              `✅ İçe Aktar (${validRows.length} küçükbaş${validBuyuk.length ? `, ${validBuyuk.length} büyükbaş satır` : ""})`
            )}
          </Button>
        </div>
      )}

      {/* Server error */}
      {serverError && (
        <div className="flex items-center gap-2 rounded-lg px-4 py-3 text-sm border"
          style={{ background: "color-mix(in srgb, var(--color-destructive) 10%, transparent)", borderColor: "color-mix(in srgb, var(--color-destructive) 40%, transparent)", color: "var(--color-destructive)" }}>
          <XCircle className="h-4 w-4 shrink-0" /> {serverError}
        </div>
      )}

      {/* Result summary */}
      {result && (
        <div className="rounded-xl border p-4 space-y-3"
          style={{ borderColor: "color-mix(in srgb, #22c55e 40%, transparent)", background: "color-mix(in srgb, #22c55e 5%, transparent)" }}>
          <div className="flex items-center gap-2 font-semibold text-sm" style={{ color: "#16a34a" }}>
            <CheckCircle2 className="h-5 w-5" />
            İçe aktarma tamamlandı
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg p-3 text-center"
              style={{ background: "color-mix(in srgb, #22c55e 10%, transparent)" }}>
              <p className="text-2xl font-bold" style={{ color: "#16a34a" }}>{result.inserted}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Küçükbaş eklendi</p>
            </div>
            <div className="rounded-lg p-3 text-center"
              style={{ background: "color-mix(in srgb, #7c3aed 10%, transparent)" }}>
              <p className="text-2xl font-bold text-violet-600">{result.buyukbasAnimals ?? 0}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Büyükbaş hayvan</p>
            </div>
            <div className="rounded-lg p-3 text-center"
              style={{ background: "color-mix(in srgb, var(--color-muted) 60%, transparent)" }}>
              <p className="text-2xl font-bold text-foreground">{result.skipped.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Satır atlandı</p>
            </div>
          </div>

          {(result.skipped.length > 0 || (result.buyukbasSkipped?.length ?? 0) > 0) && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Atlanan satır raporu:
              </p>
              {result.skipped.map((sk) => (
                <div key={`k-${sk.rowIndex}-${sk.number}`}
                  className="rounded-md px-3 py-2 text-xs border"
                  style={{ background: "color-mix(in srgb, #f59e0b 8%, transparent)", borderColor: "color-mix(in srgb, #f59e0b 30%, transparent)", color: "var(--color-foreground)" }}>
                  ⚠️ {sk.reason}
                </div>
              ))}
              {(result.buyukbasSkipped ?? []).map((sk) => (
                <div key={`b-${sk.rowIndex}-${sk.number}`}
                  className="rounded-md px-3 py-2 text-xs border"
                  style={{ background: "color-mix(in srgb, #7c3aed 8%, transparent)", borderColor: "color-mix(in srgb, #7c3aed 25%, transparent)", color: "var(--color-foreground)" }}>
                  ⚠️ Büyükbaş #{sk.number}: {sk.reason}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
