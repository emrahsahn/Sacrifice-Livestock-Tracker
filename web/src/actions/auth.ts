"use server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  SESSION_COOKIE,
  getSessionCookieValue,
  getSessionMaxAgeSeconds,
} from "@/lib/session-config";
import {
  logLoginSuccess,
  logLoginFailed,
  logLoginBlocked,
  logLogout,
} from "@/lib/vercel-watch-logger";

// ── Rate Limiting & Kilitleme Mekanizması ────────────────────────────
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000; // 5 dakika

interface AttemptRecord {
  count: number;
  firstAttempt: number;
  blockedUntil?: number;
}

const loginAttempts = new Map<string, AttemptRecord>();

function getAttemptKey(ip: string, username: string): string {
  return `${ip}::${username.toLowerCase()}`;
}

function checkRateLimit(key: string): { isBlocked: boolean; remainingSec: number } {
  const now = Date.now();
  const record = loginAttempts.get(key);
  if (!record) return { isBlocked: false, remainingSec: 0 };

  if (record.blockedUntil && record.blockedUntil > now) {
    return {
      isBlocked: true,
      remainingSec: Math.ceil((record.blockedUntil - now) / 1000),
    };
  }

  // Süre dolduysa kaydı temizle
  if (now - record.firstAttempt > LOCKOUT_MS) {
    loginAttempts.delete(key);
    return { isBlocked: false, remainingSec: 0 };
  }

  return { isBlocked: false, remainingSec: 0 };
}

function recordFailedAttempt(key: string): boolean {
  const now = Date.now();
  const record = loginAttempts.get(key);

  if (!record || now - record.firstAttempt > LOCKOUT_MS) {
    loginAttempts.set(key, { count: 1, firstAttempt: now });
    return false;
  }

  record.count += 1;
  if (record.count >= MAX_ATTEMPTS) {
    record.blockedUntil = now + LOCKOUT_MS;
    return true; // Kilitlendi
  }
  return false;
}

function resetAttempts(key: string) {
  loginAttempts.delete(key);
}

// ───────────────────────────────────────────────────────────────────

export async function login(_state: unknown, formData: FormData) {
  const username = ((formData.get("username") as string) || "").trim();
  const password = ((formData.get("password") as string) || "").trim();

  const reqHeaders = await headers();
  const request = { headers: reqHeaders };
  const clientIp =
    reqHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    reqHeaders.get("x-real-ip") ||
    "127.0.0.1";
  const attemptKey = getAttemptKey(clientIp, username || "admin");

  // 1. Kilitlenme / Rate Limit kontrolü
  const { isBlocked, remainingSec } = checkRateLimit(attemptKey);
  if (isBlocked) {
    await logLoginBlocked({ username: username || "admin", req: request });
    return {
      error: `Çok sayıda başarısız deneme yapıldı. Lütfen ${Math.ceil(remainingSec / 60)} dakika sonra tekrar deneyin.`,
    };
  }

  const validUser = process.env.ADMIN_USERNAME;
  const validPass = process.env.ADMIN_PASSWORD;

  // Env tanımlı değilse sabit/varsayılan bir kimlikle girişe izin verme (fail-closed)
  if (!validUser || !validPass) {
    await logLoginFailed({ username: username || "admin", req: request });
    return {
      error:
        "Sunucu yapılandırması eksik: ADMIN_USERNAME / ADMIN_PASSWORD tanımlı değil.",
    };
  }

  if (username !== validUser || password !== validPass) {
    const isNowBlocked = recordFailedAttempt(attemptKey);
    if (isNowBlocked) {
      await logLoginBlocked({ username: username || "admin", req: request });
      return {
        error:
          "Çok sayıda hatalı deneme nedeniyle hesabınız 5 dakika süreyle kilitlendi.",
      };
    }

    await logLoginFailed({ username: username || "admin", req: request });
    return { error: "Kullanıcı adı veya şifre hatalı." };
  }

  // 2. Başarılı giriş
  resetAttempts(attemptKey);
  await logLoginSuccess({ username: username || "admin", req: request });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, getSessionCookieValue(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: getSessionMaxAgeSeconds(),
    path: "/",
  });

  redirect("/");
}

export async function logout() {
  const reqHeaders = await headers();
  const request = { headers: reqHeaders };
  const username = process.env.ADMIN_USERNAME || "admin";

  await logLogout({ username, req: request });

  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  redirect("/login");
}

export async function getSession() {
  const cookieStore = await cookies();
  const val = cookieStore.get(SESSION_COOKIE)?.value;
  return val === getSessionCookieValue();
}

