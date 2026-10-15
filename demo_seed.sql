-- =====================================================================
-- Demo için Sahte Veriler (Çok Yıllı Sezon: 2025, 2026, 2027)
-- =====================================================================

-- 1) Tabloları temizleyelim
TRUNCATE TABLE public.buyukbas_hissedar CASCADE;
TRUNCATE TABLE public.buyukbas_hayvan CASCADE;
TRUNCATE TABLE public."kurbanlık_hesap" CASCADE;
TRUNCATE TABLE public.sezon CASCADE;

-- 2) SEZONLAR (2025 Arşiv/Kapalı, 2026 Aktif/Varsayılan, 2027 Gelecek)
INSERT INTO public.sezon (yil, ad, durum, is_default, notlar, created_at, closed_at)
VALUES
  (2025, '2025 Kurban Sezonu', 'kapali', false, 'Geçen yılın tamamlanan kurban dönemi.', now() - interval '1 year', now() - interval '10 months'),
  (2026, '2026 Kurban Sezonu', 'acik', true, 'Bu yılın aktif ve varsayılan kurban dönemi.', now() - interval '3 months', null),
  (2027, '2027 Kurban Sezonu', 'acik', false, 'Gelecek yıl ön kayıtları için açılmış yeni sezon.', now(), null);

-- 3) 2025 YILI KÜÇÜKBAŞ KAYITLARI (Arşivlenmiş, geçmiş fiyatlar)
INSERT INTO public."kurbanlık_hesap" (
  yil, number, type, special, color_of_earring, color_of_animal, whose, from_whom, price, agreed_total, phone_number, payment_method, payment_status, group_category, address, spray_paint_color, note
) VALUES
  (2025, '101', 'Kuzu', 'Kuyruklu', 'Sarı', 'Siyah', 'Ahmet Yılmaz', 'Kadir', 11500, 11500, '0555 111 22 33', 'Tamamı ödendi', 'Ödendi', '1.Gün Kesilecek Küçük Mallar', 'Cumhuriyet Mah. Lale Sk. No: 12', 'Mavi', 'Geçen seneki ilk kurban'),
  (2025, '102', 'Koyun', 'Normal', 'Beyaz', 'Siyah Beyaz', 'Ayşe Demir', 'Mehmet', 13000, 13000, '0544 222 33 44', 'Tamamı ödendi', 'Ödendi', '2.Gün Kesilecek Küçük Mallar', 'Hürriyet Mah. Çiçek Sk.', 'Kırmızı', ''),
  (2025, '103', 'Koç', 'Boynuzlu', 'Mavi', 'Beyaz', 'Hasan Vural', 'Kadir', 14000, 14000, '0530 888 11 22', '10.000 TL ödendi | 4.000 TL kalan borç', 'Kısmi Ödeme', 'Pazardan Kendi Alacaklar', '', 'Yeşil', '2025 yılından kalan 4.000 TL borcu var'),
  (2025, '104', 'Kuzu', 'Yağsız', 'Sarı', 'Kahverengi', 'Osman Yıldırım', 'Mehmet', 12000, 12000, '0542 999 00 11', '', 'Ödenmedi', 'Köye Dağıtılacaklar', 'Merkez Köy', 'Sarı', '2025 yılından kalan borç');

-- 4) 2025 YILI BÜYÜKBAŞ KAYITLARI
INSERT INTO public.buyukbas_hayvan (
  yil, number, toplam_hisse, hayvan_fiyati, hisse_birim_fiyat, type, special, color_of_earring, color_of_animal, spray_paint_color, from_whom, group_category, note
) VALUES
  (2025, '501', 7, 105000, 15000, 'Dana', '2 Yaşında', 'Sarı', 'Siyah Alaca', 'Mavi', 'Çiftlik', '1.Gün Kesilecek Büyük Mallar', '2025 büyükbaş kaydı');

INSERT INTO public.buyukbas_hissedar (
  yil, hayvan_number, whose, phone_number, alinan_hisse, agreed_total, price, payment_method, payment_status, address, note
) VALUES
  (2025, '501', 'Mustafa Öztürk', '0555 999 88 77', 3, 45000, 45000, 'Banka havalesi', 'Ödendi', 'Çarşı İçi', ''),
  (2025, '501', 'Süleyman Karaca', '0505 666 55 44', 2, 30000, 30000, 'Nakit', 'Ödendi', 'OSB Lojmanları', ''),
  (2025, '501', 'Mehmet Aksoy', '0535 444 33 22', 2, 30000, 30000, '20.000 TL ödendi', 'Kısmi Ödeme', 'Sanayi', '2025 yılından 10.000 TL borcu kaldı');

-- 5) 2026 YILI KÜÇÜKBAŞ KAYITLARI (Aktif sezon, güncel fiyatlar, dönen müşteriler)
INSERT INTO public."kurbanlık_hesap" (
  yil, number, type, special, color_of_earring, color_of_animal, whose, from_whom, price, agreed_total, phone_number, payment_method, payment_status, group_category, address, spray_paint_color, note
) VALUES
  (2026, '101', 'Kuzu', 'Kuyruklu', 'Sarı', 'Siyah', 'Ahmet Yılmaz', 'Kadir', 15000, 15000, '0555 111 22 33', 'Tamamı nakit ödendi', 'Ödendi', '1.Gün Kesilecek Küçük Mallar', 'Cumhuriyet Mah. Lale Sk. No: 12', 'Mavi', 'Sadık müşteri - 2. yıl tercihi'),
  (2026, '102', 'Koyun', 'Normal', 'Beyaz', 'Siyah Beyaz', 'Ayşe Demir', 'Mehmet', 17500, 17500, '0544 222 33 44', '5000 TL kapora, kalanı kesimde', 'Kısmi Ödeme', '2.Gün Kesilecek Küçük Mallar', 'Hürriyet Mah. Çiçek Sk.', 'Kırmızı', 'Sadık müşteri'),
  (2026, '103', 'Koç', 'Boynuzlu', 'Mavi', 'Beyaz', 'Mehmet Çelik', 'Kadir', 22000, 21500, '0533 333 44 55', '', 'Belirsiz', 'Pazardan Kendi Alacaklar', '', 'Yeşil', 'Pazarlık yapıldı, 500 TL indirim'),
  (2026, '104', 'Kuzu', 'Yağsız', 'Sarı', 'Kahverengi', 'Fatma Kaya', 'Mehmet', 16000, 16000, '0505 444 55 66', 'Hesaba EFT yapıldı', 'Ödendi', 'Köye Dağıtılacaklar', 'Merkez Köyü Yolu Üzeri', 'Sarı', 'Yeni müşteri'),
  (2026, '105', 'Kuzu', 'Normal', 'Sarı', 'Siyah', 'Canan Yıldız', 'Kadir', 14500, 14500, '0532 555 66 77', '10000 ödendi, 4500 kaldı', 'Kısmi Ödeme', '1.Gün Kesilecek Küçük Mallar', 'Yeni Mahalle 4. Sok.', 'Beyaz', 'Yeni müşteri');

-- 6) 2026 YILI BÜYÜKBAŞ KAYITLARI (Aktif sezon)
INSERT INTO public.buyukbas_hayvan (
  yil, number, toplam_hisse, hayvan_fiyati, hisse_birim_fiyat, type, special, color_of_earring, color_of_animal, spray_paint_color, from_whom, group_category, note
) VALUES
  (2026, '501', 7, 140000, 20000, 'Dana', '2 Yaşında', 'Sarı', 'Siyah Alaca', 'Mavi', 'Çiftlik', '1.Gün Kesilecek Büyük Mallar', 'Çok uysal'),
  (2026, '502', 7, 175000, 25000, 'Düve', '3 Yaşında', 'Beyaz', 'Kahverengi', 'Kırmızı', 'Ahmet Amca', '2.Gün Kesilecek Büyük Mallar', '');

INSERT INTO public.buyukbas_hissedar (
  yil, hayvan_number, whose, phone_number, alinan_hisse, agreed_total, price, payment_method, payment_status, address, note
) VALUES
  (2026, '501', 'Mustafa Öztürk', '0555 999 88 77', 2, 40000, 40000, 'Yarısı IBAN yarısı nakit', 'Ödendi', 'Çarşı İçi', 'Sadık hissedar'),
  (2026, '501', 'Elif Doğan', '0544 888 77 66', 1, 20000, 20000, '', 'Belirsiz', 'Gazi Cd.', ''),
  (2026, '501', 'Hakan Şen', '0533 777 66 55', 1, 20000, 20000, '5000 TL elden', 'Kısmi Ödeme', '', 'Bayram sabahı getirecek'),
  (2026, '501', 'Süleyman Karaca', '0505 666 55 44', 3, 60000, 58000, 'Tamamı havale edildi (2000 indirim)', 'Ödendi', 'OSB Lojmanları', 'Sadık hissedar (3 hisse amca çocukları için)'),
  (2026, '502', 'Burak Tekin', '0532 111 99 88', 1, 25000, 25000, 'Hesaba geçti', 'Ödendi', 'Sanayi Sitesi', ''),
  (2026, '502', 'Cemil Koç', '0542 222 88 77', 2, 50000, 50000, '10000 kapora', 'Kısmi Ödeme', '', 'Kalan 40 bin arife günü ödenecek');
