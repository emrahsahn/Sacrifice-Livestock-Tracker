-- Demo için Sahte Veriler (Küçükbaş ve Büyükbaş)
-- Tüm tabloları temizleyelim
TRUNCATE TABLE public.kurbanlık_hesap CASCADE;
TRUNCATE TABLE public.buyukbas_hayvan CASCADE;
TRUNCATE TABLE public.buyukbas_hissedar CASCADE;

-- 1) KÜÇÜKBAŞ HAYVANLAR (kurbanlık_hesap)
INSERT INTO public.kurbanlık_hesap (
  number, type, special, color_of_earring, color_of_animal, whose, from_whom, price, agreed_total, phone_number, payment_method, payment_status, group_category, address, spray_paint_color, note
) VALUES
  ('K-101', 'Kuzu', 'Kuyruklu', 'Sarı', 'Siyah', 'Ahmet Yılmaz', 'Kadir', 15000, 15000, '0555 111 22 33', 'Tamamı nakit ödendi', 'Ödendi', '1.Gün Kesilecek Küçük Mallar', 'Cumhuriyet Mah. Lale Sk. No: 12', 'Mavi', 'Sabah erken kesilecek'),
  ('K-102', 'Koyun', 'Normal', 'Beyaz', 'Siyah Beyaz', 'Ayşe Demir', 'Mehmet', 17500, 17500, '0544 222 33 44', '5000 TL kapora, kalanı kesimde', 'Kısmi Ödeme', '2.Gün Kesilecek Küçük Mallar', 'Hürriyet Mah. Çiçek Sk.', 'Kırmızı', ''),
  ('K-103', 'Koç', 'Boynuzlu', 'Mavi', 'Beyaz', 'Mehmet Çelik', 'Kadir', 22000, 21500, '0533 333 44 55', '', 'Belirsiz', 'Pazardan Kendi Alacaklar', '', 'Yeşil', 'Pazarlık yapıldı, 500 TL indirim'),
  ('K-104', 'Kuzu', 'Yağsız', 'Sarı', 'Kahverengi', 'Fatma Kaya', 'Mehmet', 16000, 16000, '0505 444 55 66', 'Hesaba EFT yapıldı', 'Ödendi', 'Köye Dağıtılacaklar', 'Merkez Köyü Yolu Üzeri', 'Sarı', ''),
  ('K-105', 'Kuzu', 'Normal', 'Sarı', 'Siyah', 'Canan Yıldız', 'Kadir', 14500, 14500, '0532 555 66 77', '10000 ödendi, 4500 kaldı', 'Kısmi Ödeme', '1.Gün Kesilecek Küçük Mallar', 'Yeni Mahalle 4. Sok.', 'Beyaz', '');

-- 2) BÜYÜKBAŞ HAYVANLAR (buyukbas_hayvan)
INSERT INTO public.buyukbas_hayvan (
  number, toplam_hisse, hayvan_fiyati, hisse_birim_fiyat, type, special, color_of_earring, color_of_animal, spray_paint_color, from_whom, group_category, note
) VALUES
  ('B-01', 7, 140000, 20000, 'Dana', '2 Yaşında', 'Sarı', 'Siyah Alaca', 'Mavi', 'Çiftlik', '1.Gün Kesilecek Büyük Mallar', 'Çok uysal'),
  ('B-02', 7, 175000, 25000, 'Düve', '3 Yaşında', 'Beyaz', 'Kahverengi', 'Kırmızı', 'Ahmet Amca', '2.Gün Kesilecek Büyük Mallar', '');

-- 3) BÜYÜKBAŞ HİSSEDARLAR (buyukbas_hissedar)
-- B-01 Hayvanı Hissedarları (7 Hisse, Hepsi satılmış)
INSERT INTO public.buyukbas_hissedar (
  hayvan_number, whose, phone_number, alinan_hisse, agreed_total, price, payment_method, payment_status, address, note
) VALUES
  ('B-01', 'Mustafa Öztürk', '0555 999 88 77', 2, 40000, 40000, 'Yarısı IBAN yarısı nakit', 'Ödendi', 'Çarşı İçi', '2 hisse birden aldı'),
  ('B-01', 'Elif Doğan', '0544 888 77 66', 1, 20000, 20000, '', 'Belirsiz', 'Gazi Cd.', ''),
  ('B-01', 'Hakan Şen', '0533 777 66 55', 1, 20000, 20000, '5000 TL elden', 'Kısmi Ödeme', '', 'Bayram sabahı getirecek'),
  ('B-01', 'Süleyman Karaca', '0505 666 55 44', 3, 60000, 58000, 'Tamamı havale edildi (2000 indirim)', 'Ödendi', 'OSB Lojmanları', '3 hisse amca çocukları için');

-- B-02 Hayvanı Hissedarları (Sadece 3 hissesi satılmış)
INSERT INTO public.buyukbas_hissedar (
  hayvan_number, whose, phone_number, alinan_hisse, agreed_total, price, payment_method, payment_status, address, note
) VALUES
  ('B-02', 'Burak Tekin', '0532 111 99 88', 1, 25000, 25000, 'Hesaba geçti', 'Ödendi', 'Sanayi Sitesi', ''),
  ('B-02', 'Cemil Koç', '0542 222 88 77', 2, 50000, 50000, '10000 kapora', 'Kısmi Ödeme', '', 'Kalan 40 bin arife günü ödenecek');
