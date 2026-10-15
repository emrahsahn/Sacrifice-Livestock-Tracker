/**
 * VercelWatch Logger SDK (TypeScript)
 * -------------------------------------------------------------
 * Vercel üzerindeki projelerinizden merkezi VercelWatch güvenlik
 * ve denetim sistemine giriş loglarını ve güvenlik olaylarını anında
 * aktaran hafif, sıfır bağımlılıklı istemci.
 */

export interface VercelWatchConfig {
  /**
   * VercelWatch sisteminizin yayınlandığı canlı adres veya yerel adres
   * Örn: "https://vercel-website-security.vercel.app" veya process.env.VERCEL_WATCH_URL
   */
  watchUrl?: string;
  /**
   * Tanımlıysa güvenlik için x-api-key anahtarınız
   */
  apiKey?: string;
  /**
   * Projenizin benzersiz kimliği (projects.json içerisindeki id)
   * Varsayılan: "kurbanlik-yonetim-sistemi"
   */
  defaultProjectId?: string;
}

export interface WatchLogPayload {
  projectId?: string;
  projectName?: string;
  projectUrl?: string;
  event: "LOGIN_SUCCESS" | "LOGIN_FAILED" | "LOGIN_BLOCKED" | "LOGOUT" | "SUSPICIOUS_ACCESS" | string;
  username: string;
  ip?: string;
  userAgent?: string;
  details?: string;
  notifyTelegram?: boolean;
}

// Varsayılan yapılandırma
const defaultConfig: VercelWatchConfig = {
  watchUrl:
    process.env.VERCEL_WATCH_URL ||
    process.env.NEXT_PUBLIC_VERCEL_WATCH_URL ||
    "https://vercel-website-security.vercel.app",
  apiKey: process.env.VERCEL_WATCH_API_KEY || process.env.WATCH_API_KEY,
  defaultProjectId: process.env.VERCEL_WATCH_PROJECT_ID || "kurbanlik-yonetim-sistemi",
};

/**
 * HTTP İsteğinden (NextRequest, Request, Headers veya Node IncomingMessage) güvenli IP çıkarır
 */
export function extractClientIp(req: unknown): string {
  if (!req) return "127.0.0.1";

  const obj = req as Record<string, unknown>;

  // Next.js Headers nesnesi (from await headers())
  if (typeof (obj as { get?: unknown }).get === "function") {
    const getter = obj as { get(name: string): string | null };
    const realIp = getter.get("x-real-ip");
    if (realIp) return realIp.trim();

    const forwarded = getter.get("x-forwarded-for");
    if (forwarded) {
      const parts = forwarded.split(",").map((p: string) => p.trim()).filter(Boolean);
      if (parts.length > 0) return parts[0];
    }
    return "127.0.0.1";
  }

  // Next.js / Web Request headers
  const headers = obj.headers as Record<string, unknown> | { get?(name: string): string | null } | undefined;
  if (headers && typeof (headers as { get?: unknown }).get === "function") {
    const getter = headers as { get(name: string): string | null };
    const realIp = getter.get("x-real-ip");
    if (realIp) return realIp.trim();

    const forwarded = getter.get("x-forwarded-for");
    if (forwarded) {
      const parts = forwarded.split(",").map((p: string) => p.trim()).filter(Boolean);
      if (parts.length > 0) return parts[0];
    }
    return "127.0.0.1";
  }

  // Node.js / Express headers object
  if (headers && typeof headers === "object") {
    const rawHeaders = headers as Record<string, string | string[] | undefined>;
    const realIp = rawHeaders["x-real-ip"];
    if (realIp) return String(realIp).trim();

    const forwarded = rawHeaders["x-forwarded-for"];
    if (forwarded) {
      const parts = String(forwarded).split(",").map((p: string) => p.trim()).filter(Boolean);
      if (parts.length > 0) return parts[0];
    }
  }

  const socket = obj.socket as { remoteAddress?: string } | undefined;
  return (obj.ip as string) || socket?.remoteAddress || "127.0.0.1";
}

/**
 * HTTP İsteğinden User-Agent başlığını çıkarır
 */
export function extractUserAgent(req: unknown): string {
  if (!req) return "";
  const obj = req as Record<string, unknown>;

  if (typeof (obj as { get?: unknown }).get === "function") {
    return (obj as { get(name: string): string | null }).get("user-agent") || "";
  }
  const headers = obj.headers as Record<string, unknown> | { get?(name: string): string | null } | undefined;
  if (headers && typeof (headers as { get?: unknown }).get === "function") {
    return (headers as { get(name: string): string | null }).get("user-agent") || "";
  }
  if (headers && typeof headers === "object") {
    return String((headers as Record<string, unknown>)["user-agent"] || "");
  }
  return "";
}

/**
 * VercelWatch sistemine log gönderir (Fire-and-forget, hata fırlatmaz)
 */
export async function sendWatchLog(
  payload: WatchLogPayload,
  config?: VercelWatchConfig
): Promise<void> {
  const finalConfig = { ...defaultConfig, ...config };
  const targetUrl = `${finalConfig.watchUrl?.replace(/\/+$/, "")}/api/ingest`;

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (finalConfig.apiKey) {
      headers["x-api-key"] = finalConfig.apiKey;
    }

    const projectId =
      payload.projectId ||
      finalConfig.defaultProjectId ||
      process.env.VERCEL_WATCH_PROJECT_ID ||
      "kurbanlik-yonetim-sistemi";

    // Non-blocking istek
    const response = await fetch(targetUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        projectId,
        projectName: payload.projectName,
        projectUrl: payload.projectUrl,
        event: payload.event,
        username: payload.username,
        ip: payload.ip || "127.0.0.1",
        userAgent: payload.userAgent || "",
        details: payload.details,
        notifyTelegram: payload.notifyTelegram !== false,
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.warn(`[VercelWatch Logger] Sunucu yanıtı (${response.status}):`, errText);
    }
  } catch (error) {
    // Projenin akışını asla bozmaması için hata loglanır fakat fırlatılmaz
    console.warn("[VercelWatch Logger] Log aktarım uyarısı:", error);
  }
}

/**
 * Kolaylaştırıcı Yardımcı Metodlar (Next.js / Node Route Handler & Server Action için)
 */

export function logLoginSuccess(params: {
  username: string;
  projectId?: string;
  req?: unknown;
  details?: string;
  config?: VercelWatchConfig;
}) {
  return sendWatchLog(
    {
      projectId: params.projectId || "kurbanlik-yonetim-sistemi",
      event: "LOGIN_SUCCESS",
      username: params.username,
      ip: extractClientIp(params.req),
      userAgent: extractUserAgent(params.req),
      details: params.details || "Yönetici paneline başarılı oturum açıldı.",
    },
    params.config
  );
}

export function logLoginFailed(params: {
  username: string;
  projectId?: string;
  req?: unknown;
  details?: string;
  config?: VercelWatchConfig;
}) {
  return sendWatchLog(
    {
      projectId: params.projectId || "kurbanlik-yonetim-sistemi",
      event: "LOGIN_FAILED",
      username: params.username,
      ip: extractClientIp(params.req),
      userAgent: extractUserAgent(params.req),
      details: params.details || "Hatalı parola veya geçersiz kullanıcı adı denemesi.",
    },
    params.config
  );
}

export function logLoginBlocked(params: {
  username: string;
  projectId?: string;
  req?: unknown;
  details?: string;
  config?: VercelWatchConfig;
}) {
  return sendWatchLog(
    {
      projectId: params.projectId || "kurbanlik-yonetim-sistemi",
      event: "LOGIN_BLOCKED",
      username: params.username,
      ip: extractClientIp(params.req),
      userAgent: extractUserAgent(params.req),
      details: params.details || "Çok sayıda hatalı deneme nedeniyle IP kilitlendi.",
    },
    params.config
  );
}

export function logLogout(params: {
  username: string;
  projectId?: string;
  req?: unknown;
  details?: string;
  notifyTelegram?: boolean;
  config?: VercelWatchConfig;
}) {
  return sendWatchLog(
    {
      projectId: params.projectId || "kurbanlik-yonetim-sistemi",
      event: "LOGOUT",
      username: params.username,
      ip: extractClientIp(params.req),
      userAgent: extractUserAgent(params.req),
      details: params.details || "Oturum güvenli bir şekilde kapatıldı.",
      notifyTelegram: params.notifyTelegram ?? false,
    },
    params.config
  );
}
