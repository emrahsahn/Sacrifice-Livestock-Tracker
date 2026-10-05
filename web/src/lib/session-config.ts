/**
 * Cookie tabanlı admin oturumu.
 * Süre: SESSION_MAX_AGE_HOURS (örn. "8") — varsayılan 8 saat. Eski davranış 7 gündü.
 */
export const SESSION_COOKIE = "ks_session";

export function getSessionCookieValue(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "SESSION_SECRET tanımlı değil. Güvenli bir değer üretip ortam değişkenlerine ekleyin."
    );
  }
  return secret;
}

/** Saniye cinsinden; tarayıcı oturumu bu süre sonunda düşer. */
export function getSessionMaxAgeSeconds(): number {
  const raw = process.env.SESSION_MAX_AGE_HOURS;
  const hours =
    raw !== undefined && raw !== "" ? Number(String(raw).trim()) : NaN;
  const h =
    Number.isFinite(hours) && hours > 0 && hours <= 24 * 365
      ? hours
      : 8;
  return Math.floor(h * 3600);
}
