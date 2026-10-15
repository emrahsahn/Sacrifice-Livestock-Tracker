/**
 * VercelWatch Logger SDK (TypeScript)
 * -------------------------------------------------------------
 * Vercel üzerindeki projelerinizden (Next.js, Express, Fastify, vb.)
 * merkezi VercelWatch güvenlik ve denetim sistemine giriş loglarını
 * ve güvenlik olaylarını anında aktaran hafif, sıfır bağımlılıklı istemci.
 * 
 * Özellikler:
 * - Sıfır ek kütüphane (Native fetch kullanır)
 * - Non-blocking (Sitenizi veya login hızınızı asla yavaşlatmaz)
 * - Otomatik IP ve User-Agent çıkarma
 * - Anlık Telegram uyarısı ve /logs paneline kayıt
 */

export interface VercelWatchConfig {
  /**
   * VercelWatch sisteminizin yayınlandığı canlı adres veya yerel adres
   * Örn: "https://vercel-website-security.vercel.app" veya process.env.VERCEL_WATCH_URL
   */
  watchUrl?: string;
  /**
   * Tanımlıysa güvenlik için x-api-key anahtarınız
   * Örn: process.env.VERCEL_WATCH_API_KEY
   */
  apiKey?: string;
  /**
   * Projenizin benzersiz kimliği (projects.json içerisindeki id)
   * Örn: "kurbanlık-yonetim-sistemi", "yali-qr-menu"
   */
  defaultProjectId?: string;
}

export interface WatchLogPayload {
  projectId: string;
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
  defaultProjectId: process.env.VERCEL_WATCH_PROJECT_ID,
};

/**
 * HTTP İsteğinden (NextRequest, Request veya Node IncomingMessage) güvenli IP çıkarır
 */
export function extractClientIp(req: any): string {
  if (!req) return "127.0.0.1";

  // Next.js / Web Request headers
  if (typeof req.headers?.get === "function") {
    const realIp = req.headers.get("x-real-ip");
    if (realIp) return realIp.trim();

    const forwarded = req.headers.get("x-forwarded-for");
    if (forwarded) {
      const parts = forwarded.split(",").map((p: string) => p.trim()).filter(Boolean);
      if (parts.length > 0) return parts[0];
    }
    return "127.0.0.1";
  }

  // Node.js / Express headers object
  if (req.headers) {
    const realIp = req.headers["x-real-ip"];
    if (realIp) return String(realIp).trim();

    const forwarded = req.headers["x-forwarded-for"];
    if (forwarded) {
      const parts = String(forwarded).split(",").map((p: string) => p.trim()).filter(Boolean);
      if (parts.length > 0) return parts[0];
    }
  }

  return req.ip || req.socket?.remoteAddress || "127.0.0.1";
}

/**
 * HTTP İsteğinden User-Agent başlığını çıkarır
 */
export function extractUserAgent(req: any): string {
  if (!req) return "";
  if (typeof req.headers?.get === "function") {
    return req.headers.get("user-agent") || "";
  }
  return req.headers?.["user-agent"] || "";
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

    // Non-blocking istek
    const response = await fetch(targetUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        projectId: payload.projectId || finalConfig.defaultProjectId || "unknown-project",
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
    // Projenizin akışını asla bozmaması için hata loglanır fakat fırlatılmaz
    console.warn("[VercelWatch Logger] Log aktarım uyarısı:", error);
  }
}

/**
 * Kolaylaştırıcı Yardımcı Metodlar (Next.js / Node Route Handler'lar için)
 */

export function logLoginSuccess(params: {
  projectId: string;
  username: string;
  req?: any;
  details?: string;
  config?: VercelWatchConfig;
}) {
  return sendWatchLog(
    {
      projectId: params.projectId,
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
  projectId: string;
  username: string;
  req?: any;
  details?: string;
  config?: VercelWatchConfig;
}) {
  return sendWatchLog(
    {
      projectId: params.projectId,
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
  projectId: string;
  username: string;
  req?: any;
  details?: string;
  config?: VercelWatchConfig;
}) {
  return sendWatchLog(
    {
      projectId: params.projectId,
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
  projectId: string;
  username: string;
  req?: any;
  details?: string;
  notifyTelegram?: boolean;
  config?: VercelWatchConfig;
}) {
  return sendWatchLog(
    {
      projectId: params.projectId,
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
