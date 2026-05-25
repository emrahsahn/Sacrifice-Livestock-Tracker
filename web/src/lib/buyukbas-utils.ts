export function computeHisseBirimFiyat(hayvanFiyati: number, toplamHisse: number): number {
  if (toplamHisse <= 0) return 0;
  return Math.round((hayvanFiyati / toplamHisse) * 100) / 100;
}

/** Köye / çarşıya dağıtım gruplarında hissedar adresi gösterilir. */
export function isDistributionGroup(group: string | null | undefined): boolean {
  return group === "Köye Dağıtılacaklar" || group === "Çarşıya Dağıtılacaklar";
}
