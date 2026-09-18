import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// .env.local dosyasından değişkenleri yükle
function loadEnv() {
  const envPath = path.resolve(__dirname, "../web/.env.local");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Hata: NEXT_PUBLIC_SUPABASE_URL veya SUPABASE_ANON_KEY bulunamadı.");
  process.exit(1);
}

const cleanUrl = supabaseUrl.replace(/\/+$/, "");
// Supabase REST endpoint'inde Türkçe karakter içeren tablo adı encode edilir
const encodedTable = encodeURIComponent("kurbanlık_hesap");
const targetEndpoint = `${cleanUrl}/rest/v1/${encodedTable}?select=random_id&limit=1`;

console.log(`📡 Supabase Ping gönderiliyor: ${targetEndpoint}`);

const startTime = Date.now();

try {
  const response = await fetch(targetEndpoint, {
    method: "GET",
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    },
  });

  const duration = Date.now() - startTime;

  if (response.ok) {
    const data = await response.json();
    console.log(`✅ [${response.status} OK] Supabase aktif ve çalışıyor!`);
    console.log(`⏱️ Yanıt Süresi: ${duration}ms`);
    console.log(`📦 Dönen Yanıt:`, JSON.stringify(data));
  } else {
    const text = await response.text();
    console.error(`❌ [${response.status} Hata]:`, text);
    process.exit(1);
  }
} catch (error) {
  console.error("❌ İstek sırasında hata:", error.message);
  process.exit(1);
}
