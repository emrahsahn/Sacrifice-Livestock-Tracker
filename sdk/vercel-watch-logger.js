/**
 * VercelWatch Logger SDK (JavaScript / CommonJS & ES Module uyumlu)
 * -------------------------------------------------------------
 * Projelerinizden merkezi VercelWatch güvenlik sistemine giriş ve denetim loglarını iletir.
 */

function extractClientIp(req) {
  if (!req) return "127.0.0.1";
  if (typeof req.headers?.get === "function") {
    const realIp = req.headers.get("x-real-ip");
    if (realIp) return realIp.trim();
    const forwarded = req.headers.get("x-forwarded-for");
    if (forwarded) {
      const parts = forwarded.split(",").map((p) => p.trim()).filter(Boolean);
      if (parts.length > 0) return parts[0];
    }
    return "127.0.0.1";
  }
  if (req.headers) {
    const realIp = req.headers["x-real-ip"];
    if (realIp) return String(realIp).trim();
    const forwarded = req.headers["x-forwarded-for"];
    if (forwarded) {
      const parts = String(forwarded).split(",").map((p) => p.trim()).filter(Boolean);
      if (parts.length > 0) return parts[0];
    }
  }
  return req.ip || req.socket?.remoteAddress || "127.0.0.1";
}

function extractUserAgent(req) {
  if (!req) return "";
  if (typeof req.headers?.get === "function") {
    return req.headers.get("user-agent") || "";
  }
  return req.headers?.["user-agent"] || "";
}

async function sendWatchLog(payload, config = {}) {
  const watchUrl =
    config.watchUrl ||
    process.env.VERCEL_WATCH_URL ||
    "https://vercel-website-security.vercel.app";
  const apiKey = config.apiKey || process.env.VERCEL_WATCH_API_KEY || process.env.WATCH_API_KEY;
  const targetUrl = `${watchUrl.replace(/\/+$/, "")}/api/ingest`;

  try {
    const headers = { "Content-Type": "application/json" };
    if (apiKey) headers["x-api-key"] = apiKey;

    const response = await fetch(targetUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        projectId: payload.projectId,
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
  } catch (err) {
    console.warn("[VercelWatch Logger] Log aktarım uyarısı:", err);
  }
}

function logLoginSuccess({ projectId, username, req, details, config }) {
  return sendWatchLog(
    {
      projectId,
      event: "LOGIN_SUCCESS",
      username,
      ip: extractClientIp(req),
      userAgent: extractUserAgent(req),
      details: details || "Başarılı yönetici girişi yapıldı.",
    },
    config
  );
}

function logLoginFailed({ projectId, username, req, details, config }) {
  return sendWatchLog(
    {
      projectId,
      event: "LOGIN_FAILED",
      username,
      ip: extractClientIp(req),
      userAgent: extractUserAgent(req),
      details: details || "Hatalı parola denemesi.",
    },
    config
  );
}

function logLoginBlocked({ projectId, username, req, details, config }) {
  return sendWatchLog(
    {
      projectId,
      event: "LOGIN_BLOCKED",
      username,
      ip: extractClientIp(req),
      userAgent: extractUserAgent(req),
      details: details || "Brute-force koruması nedeniyle IP kilitlendi.",
    },
    config
  );
}

function logLogout({ projectId, username, req, details, notifyTelegram, config }) {
  return sendWatchLog(
    {
      projectId,
      event: "LOGOUT",
      username,
      ip: extractClientIp(req),
      userAgent: extractUserAgent(req),
      details: details || "Oturum kapatıldı.",
      notifyTelegram: notifyTelegram ?? false,
    },
    config
  );
}

module.exports = {
  extractClientIp,
  extractUserAgent,
  sendWatchLog,
  logLoginSuccess,
  logLoginFailed,
  logLoginBlocked,
  logLogout,
};
