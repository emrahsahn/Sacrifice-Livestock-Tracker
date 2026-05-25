export type PaymentStatus = "Belirsiz" | "Ödendi" | "Kısmi Ödeme" | "Ödenmedi";

export interface Customer {
  /**
   * Müşteri kaydını benzersiz tanımlayan rastgele üretilmiş kısa kimlik
   * (composite primary key'in parçası). Kayıt eklenirken DB tarafında üretilir.
   */
  random_id: string;
  /**
   * Hayvan numarası (composite PK'nin parçası). Birden fazla hayvan
   * virgülle ayrılarak tutulur, örn. "101, 102, 103".
   */
  number: string;
  type: string;
  special: string;
  color_of_earring: string;
  color_of_animal: string;
  whose: string;
  from_whom: string;
  /** Anlaşılan / sözleşme tutarı; kısmi ödemede sabit kalır. */
  agreed_total?: number | null;
  price: number;
  /** 11 haneli, '0' ile başlayan normalize edilmiş telefon. */
  phone_number: string;
  payment_method: string;
  payment_status: PaymentStatus;
  group_category: string;
  address: string;
  spray_paint_color: string;
  /** Boş string veya migrasyon öncesi kayıtlarda eksik olabilir. */
  note?: string | null;
}

/** Composite primary key bileşenleri — update / delete işlemlerinde kayıt eşleştirmek için. */
export interface CustomerKey {
  random_id: string;
  number: string;
}

export const PAYMENT_OPTIONS: PaymentStatus[] = [
  "Belirsiz",
  "Ödendi",
  "Kısmi Ödeme",
  "Ödenmedi",
];

export const GROUP_CATEGORIES = [
  "1.Gün Kesilecek Küçük Mallar",
  "1.Gün Kesilecek Büyük Mallar",
  "2.Gün Kesilecek Küçük Mallar",
  "2.Gün Kesilecek Büyük Mallar",
  "Pazardan Kendi Alacaklar",
  "Köyden Kendi Alacaklar",
  "Çarşıya Dağıtılacaklar",
  "Köye Dağıtılacaklar",
  "Kesilip Dükkana Gönderilecekler",
] as const;

export type GroupCategory = typeof GROUP_CATEGORIES[number];

export const TABLE = "kurbanlık_hesap";

export const HISTORY_TABLE = "kurbanlik_hesap_history";

export const BUYUKBAS_TABLE = "buyukbas_hayvan";
export const BUYUKBAS_HISSEDAR_TABLE = "buyukbas_hissedar";

/** Büyükbaş grupları (UI filtreleri). */
export const BUYUKBAS_GROUP_CATEGORIES = [
  "1.Gün Kesilecek Büyük Mallar",
  "2.Gün Kesilecek Büyük Mallar",
  "Pazardan Kendi Alacaklar",
  "Köyden Kendi Alacaklar",
  "Çarşıya Dağıtılacaklar",
  "Köye Dağıtılacaklar",
  "Kesilip Dükkana Gönderilecekler",
] as const;

/** Küçükbaş grupları (UI filtreleri). */
export const KUCUKBAS_GROUP_CATEGORIES = [
  "1.Gün Kesilecek Küçük Mallar",
  "2.Gün Kesilecek Küçük Mallar",
  "Pazardan Kendi Alacaklar",
  "Köyden Kendi Alacaklar",
  "Çarşıya Dağıtılacaklar",
  "Köye Dağıtılacaklar",
  "Kesilip Dükkana Gönderilecekler",
] as const;

export interface BuyukbasHayvan {
  number: string;
  toplam_hisse: number;
  hayvan_fiyati: number;
  hisse_birim_fiyat: number;
  type: string;
  special: string;
  color_of_earring: string;
  color_of_animal: string;
  spray_paint_color: string;
  from_whom: string;
  group_category: string;
  note?: string | null;
  created_at?: string;
}

export interface BuyukbasHissedar {
  id: string;
  hayvan_number: string;
  whose: string;
  phone_number: string;
  alinan_hisse: number;
  agreed_total: number;
  price: number;
  payment_method: string;
  payment_status: PaymentStatus;
  address: string;
  note?: string | null;
  created_at?: string;
}

export interface BuyukbasHayvanWithHissedarlar extends BuyukbasHayvan {
  hissedarlar: BuyukbasHissedar[];
}

export type HistoryAction = "create" | "update" | "delete";

/** Tetikleyicide kaydedilen jsonb snapshot (alanlar DB ile uyumlu). */
export interface CustomerSnapshot {
  random_id?: string | null;
  number?: string;
  type?: string | null;
  special?: string | null;
  color_of_earring?: string | null;
  color_of_animal?: string | null;
  whose?: string | null;
  from_whom?: string | null;
  price?: number | null;
  agreed_total?: number | null;
  phone_number?: string | null;
  payment_method?: string | null;
  payment_status?: string | null;
  group_category?: string | null;
  address?: string | null;
  spray_paint_color?: string | null;
  note?: string | null;
}

export interface HistoryEntry {
  id: string;
  hayvan_number: string;
  /** Migrasyon sonrası mevcut: composite key'in benzersiz parçası. */
  random_id?: string | null;
  snapshot: CustomerSnapshot;
  recorded_at: string;
  action: HistoryAction;
}
