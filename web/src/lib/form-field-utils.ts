import type { FieldErrors, FieldPath, UseFormSetError } from "react-hook-form";
import type { ZodIssue } from "zod";
import { cn } from "@/lib/utils";

/** Zod issue path → react-hook-form alan adı */
export function zodPathToFieldPath(path: (string | number)[]): string {
  return path.map(String).join(".");
}

export function applyZodIssuesToForm<T extends Record<string, unknown>>(
  issues: ZodIssue[],
  setError: UseFormSetError<T>
) {
  for (const issue of issues) {
    if (issue.path.length === 0) continue;
    const name = zodPathToFieldPath(issue.path.map(String)) as FieldPath<T>;
    setError(name, { type: "manual", message: issue.message });
  }
}

export function fieldHasError<T extends Record<string, unknown>>(
  errors: FieldErrors<T>,
  name: FieldPath<T>
): boolean {
  const parts = String(name).split(".");
  let cur: unknown = errors;
  for (const part of parts) {
    if (!cur || typeof cur !== "object") return false;
    cur = (cur as Record<string, unknown>)[part];
  }
  return !!cur;
}

/** Hatalı input / select için kırmızı çerçeve */
export function invalidFieldClass(hasError: boolean, className?: string) {
  return cn(
    className,
    hasError &&
      "border-destructive ring-1 ring-destructive/50 focus-visible:ring-destructive aria-invalid:border-destructive"
  );
}
