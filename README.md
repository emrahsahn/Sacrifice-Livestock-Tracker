# Kurbanlık Takip Sistemi

Kurban döneminde küçükbaş ve büyükbaş hayvan kayıtlarını, müşteri bilgilerini ve ödeme durumlarını tek bir yerden yönetmek için geliştirilmiş modern bir web uygulaması.

Eski Streamlit/Python tabanlı yapıdan tamamen ayrılarak **Next.js + Supabase** mimarisine taşınmıştır. Mobil uyumlu arayüz, Türkçe form alanları ve kurban operasyonlarına özel iş akışları sunar.

---

## Özellikler

### Genel

- **Dashboard** — Kayıtlı hayvan sayısı, anlaşılan toplam, tahsil edilen tutar ve bekleyen ödeme özeti
- **Giriş koruması** — Cookie tabanlı admin oturumu
- **Karanlık / aydınlık tema** — Tüm sayfalarda tema desteği
- **Mobil uyumlu arayüz** — Alt navigasyon ve responsive kart düzeni

### Küçükbaş (kurbanlık hesap)

- Müşteri ekleme, güncelleme ve silme
- Gelişmiş sorgulama: hayvan numarası, sahip, tür, telefon
- Müşteri listeleme: sıralama, sayfalama, Excel/CSV dışa aktarma
- Grup kategorileri (kesim günü, dağıtım vb.)
- Ödeme durumu takibi: Ödendi, Kısmi Ödeme, Ödenmedi, Belirsiz
- Anlaşılan tutar (`agreed_total`) ve tahsil edilen tutar ayrımı
- Değişiklik geçmişi (`kurbanlik_hesap_history`)

### Büyükbaş

- Hayvan bazlı kayıt (toplam hisse, birim fiyat, hayvan fiyatı)
- Hissedar yönetimi: her hissedar için ayrı ödeme ve iletişim bilgisi
- Büyükbaş sorgulama ve kart görünümü

### Toplu işlemler

- Excel dosyasından toplu küçükbaş ve büyükbaş içe aktarma
- Hatalı satırlar için atlama ve raporlama

### İstatistikler

- Küçükbaş ve büyükbaş birleşik özet
- Grup kategorisine göre hayvan sayısı ve tutar dağılımı

---

## Teknolojiler

| Katman | Teknoloji |
|--------|-----------|
| Frontend | Next.js 16 (App Router), React 19, TypeScript |
| Stil | Tailwind CSS v4, shadcn/ui, Radix UI |
| Form & doğrulama | react-hook-form, zod |
| Veritabanı | Supabase (PostgreSQL) |
| Tablo & dışa aktarma | TanStack Table, SheetJS (xlsx) |
| Dağıtım | Vercel |

---

## Proje yapısı

```text
new_query_system/
├── web/                    # Next.js uygulaması (aktif kod tabanı)
│   ├── src/
│   │   ├── app/            # Sayfalar (dashboard, müşteriler, sorgula, ekle, vb.)
│   │   ├── actions/        # Server Actions (auth, müşteri, büyükbaş)
│   │   ├── components/     # UI bileşenleri
│   │   └── lib/            # Supabase, validasyon, yardımcılar
│   └── public/             # Statik dosyalar
├── supabase/
│   ├── migrations/         # Veritabanı migration dosyaları
│   └── seed.sql            # Örnek test verisi
├── data/                   # Örnek CSV ve görseller
└── package.json            # Kök npm script'leri (web/ yönlendirmesi)
```

---

## Gereksinimler

- **Node.js** 20+
- **npm** 10+
- **Supabase** hesabı ve proje
- (İsteğe bağlı) [Supabase CLI](https://supabase.com/docs/guides/cli) — migration yönetimi için

---

## Kurulum

### 1. Depoyu klonlayın

```bash
git clone https://github.com/emrahsahn/query_system.git
cd query_system
```

### 2. Bağımlılıkları yükleyin

```bash
cd web
npm install
```

Kök dizinden çalıştırmak isterseniz:

```bash
npm install --prefix web
```

### 3. Ortam değişkenlerini ayarlayın

`web/.env.local.example` dosyasını kopyalayarak `web/.env.local` oluşturun:

```bash
cp web/.env.local.example web/.env.local
```

Ardından aşağıdaki değerleri doldurun:

```env
# Supabase — Dashboard → Project Settings → API
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Admin giriş bilgileri (üretimde mutlaka değiştirin)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=guclu-bir-sifre

# Oturum imzası (rastgele, uzun bir dize kullanın)
SESSION_SECRET=super-secret-string

# İsteğe bağlı — oturum süresi (saat), varsayılan: 8
SESSION_MAX_AGE_HOURS=8
```

> **Güvenlik:** `ADMIN_PASSWORD` ve `SESSION_SECRET` değerlerini üretim ortamında varsayılan değerlerle bırakmayın.

### 4. Veritabanını hazırlayın

Migration dosyalarını Supabase projenize uygulayın.

**Supabase CLI ile:**

```bash
supabase db push
```

**SQL Editor ile:** `supabase/migrations/` altındaki dosyaları tarih sırasına göre tek tek çalıştırın.

Test verisi yüklemek için:

```sql
-- supabase/seed.sql içeriğini SQL Editor'de çalıştırın
```

> Migration geçmişi çakışması yaşarsanız `supabase/clear_migration_history.sql` dosyasındaki talimatları uygulayın; ardından `db push` işlemini tekrarlayın.

RLS (Row Level Security) politikalarının uygulandığından emin olun — `20260501170000_add_rls_policies.sql` ve büyükbaş migration'ları bunları içerir.

---

## Geliştirme

```bash
# web/ dizininden
npm run dev

# veya kök dizinden
npm run dev
```

Uygulama [http://localhost:3000](http://localhost:3000) adresinde açılır. Giriş sayfası: `/login`.

---

## Üretim derlemesi

```bash
cd web
npm run build
npm run start
```

Lint kontrolü:

```bash
npm run lint
```

---

## Vercel'e dağıtım

| Ayar | Değer |
|------|-------|
| Root Directory | `web` |
| Framework | Next.js |

**Ortam değişkenleri:**

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `SESSION_SECRET`
- `SESSION_MAX_AGE_HOURS` *(isteğe bağlı)*

---

## Sayfalar

| Rota | Açıklama |
|------|----------|
| `/` | Dashboard ve hızlı erişim menüsü |
| `/musteriler` | Müşteri listesi ve dışa aktarma |
| `/sorgula` | Küçükbaş ve büyükbaş arama |
| `/ekle` | Tekil kayıt, büyükbaş ve Excel toplu içe aktarma |
| `/guncelle` | Kayıt güncelleme |
| `/sil` | Kayıt silme |
| `/istatistikler` | Grup ve ödeme istatistikleri |
| `/login` | Admin girişi |

---

## Veritabanı tabloları

| Tablo | Açıklama |
|-------|----------|
| `kurbanlık_hesap` | Küçükbaş müşteri kayıtları |
| `kurbanlik_hesap_history` | Küçükbaş değişiklik geçmişi |
| `buyukbas_hayvan` | Büyükbaş hayvan kayıtları |
| `buyukbas_hissedar` | Büyükbaş hissedar kayıtları |

---

## Lisans

Bu proje özel kullanım içindir. Dağıtım veya ticari kullanım için depo sahibiyle iletişime geçin.
