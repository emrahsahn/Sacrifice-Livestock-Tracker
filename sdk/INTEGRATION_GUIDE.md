# 📡 VercelWatch Proje Log Entegrasyon Rehberi

Bu kılavuz, izlediğiniz web uygulamalarınızın (örneğin **Yalı QR Menü**, **Kontenyer QR Menü**, **Apartman Projesi**, vb.) oturum açma, hatalı parola ve güvenlik olaylarını merkezi **VercelWatch** sistemine ve Telegram botunuza anlık olarak aktarmanızı sağlar.

---

## ⚡ Hızlı Başlangıç (3 Adım)

### Adım 1: Dosyayı Projenize Kopyalayın
- Projeniz **TypeScript** ise: `sdk/vercel-watch-logger.ts` dosyasını projenizin `lib/` veya `utils/` klasörüne yapıştırın.
- Projeniz **JavaScript** ise: `sdk/vercel-watch-logger.js` dosyasını kopyalayın.

### Adım 2: Ortam Değişkenlerini Ekleyin (İsteğe Bağlı)
İzlenen projenizin `.env` veya Vercel Settings -> Environment Variables alanına ekleyin:
```env
# VercelWatch panelinizin URL adresi
VERCEL_WATCH_URL=https://vercel-website-security.vercel.app

# VercelWatch panelinizde tanımladığınız WATCH_API_KEY (Güvenlik anahtarı)
VERCEL_WATCH_API_KEY=vw_live_sec_7c4f19b6a03e82d1
```

### Adım 3: Login Rotanıza Ekleyin

#### Örnek: Next.js App Router (`app/api/auth/route.ts` - Örn. Yalı QR Menü)

```typescript
import {
  logLoginSuccess,
  logLoginFailed,
  logLoginBlocked,
  logLogout
} from "@/lib/vercel-watch-logger";

export async function POST(request: NextRequest) {
  const { username, password } = await request.json();

  // 1. Brute Force veya Kilitlenme Durumunda:
  if (rateLimit.isBlocked) {
    logLoginBlocked({
      projectId: "yali-qr-menu",
      username,
      req: request,
      details: "5 hatalı deneme sonrası IP kilitlendi."
    });
    return NextResponse.json({ error: "Kilitlendi" }, { status: 429 });
  }

  // 2. Parola veya Kullanıcı Adı Hatalıysa:
  if (!isValidPassword) {
    logLoginFailed({
      projectId: "yali-qr-menu",
      username,
      req: request,
      details: "Geçersiz şifre denemesi."
    });
    return NextResponse.json({ error: "Hatalı şifre" }, { status: 401 });
  }

  // 3. Başarılı Giriş Yapıldıysa:
  logLoginSuccess({
    projectId: "yali-qr-menu",
    username,
    req: request,
    details: "Yönetici paneline başarılı giriş yapıldı."
  });

  return NextResponse.json({ success: true });
}
```

---

## 🔒 Güvenlik & Performans Garantisi

1. **Sıfır Yavaşlama (Non-Blocking):** `sendWatchLog` fonksiyonları arka planda çalışır (`fire-and-forget`). Ana oturum açma isteğini bekletmez, milisaniye kaybettirmez.
2. **Hata İzolasyonu:** VercelWatch sunucusu o an çevrimdışı olsa veya ağ hatası alsa bile projenizin çalışması kesinlikle aksamaz; hata projenize yansımaz.
3. **Akıllı Veri Çıkarımı:** Client IP (`x-real-ip`, `x-forwarded-for`), cihaz ve tarayıcı bilgisi otomatik olarak ayrıştırılır ve Telegram'da düzgün şekilde biçimlendirilir.
