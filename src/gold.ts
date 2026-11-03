export const GOLD_KIND_IDS = [
  "gram",
  "ziynet_quarter",
  "ziynet_half",
  "ziynet_full",
  "ziynet_two_half",
  "ziynet_five",
  "ata_lira",
  "resat_full",
  "resat_five"
] as const;

export type GoldKind = (typeof GOLD_KIND_IDS)[number];

export type GoldProduct = {
  id: GoldKind;
  symbol: string;
  name: string;
  short: string;
  unit: "gram" | "adet";
  grossWeightGrams: number;
  purity: number;
  purityLabel: string;
};

// Cumhuriyet altınları ve Reşat ağırlıkları Darphane tarafından yayımlanan
// standartlardır. Gram altın burada mevcut saf gram gösterge fiyatının birimidir.
export const GOLD_PRODUCTS: GoldProduct[] = [
  { id: "gram", symbol: "GRAM_ALTIN", name: "Gram Altın (24 ayar)", short: "gr", unit: "gram", grossWeightGrams: 1, purity: 1, purityLabel: "Saf gram" },
  { id: "ziynet_quarter", symbol: "ZIYNET_CEYREK", name: "Çeyrek Ziynet Altın", short: "¼", unit: "adet", grossWeightGrams: 1.754, purity: 0.9166, purityLabel: "916,6 milyem · 22 ayar" },
  { id: "ziynet_half", symbol: "ZIYNET_YARIM", name: "Yarım Ziynet Altın", short: "½", unit: "adet", grossWeightGrams: 3.508, purity: 0.9166, purityLabel: "916,6 milyem · 22 ayar" },
  { id: "ziynet_full", symbol: "ZIYNET_TAM", name: "Tam Ziynet Altın", short: "Tam", unit: "adet", grossWeightGrams: 7.016, purity: 0.9166, purityLabel: "916,6 milyem · 22 ayar" },
  { id: "ziynet_two_half", symbol: "ZIYNET_IKI_BUCUK", name: "Gremse (İki Buçukluk Ziynet)", short: "2,5", unit: "adet", grossWeightGrams: 17.54, purity: 0.9166, purityLabel: "916,6 milyem · 22 ayar" },
  { id: "ziynet_five", symbol: "ZIYNET_BESLI", name: "Beşli Ziynet Altın", short: "5'li", unit: "adet", grossWeightGrams: 35.08, purity: 0.9166, purityLabel: "916,6 milyem · 22 ayar" },
  { id: "ata_lira", symbol: "ATA_LIRA", name: "Cumhuriyet / Ata Lira", short: "Ata", unit: "adet", grossWeightGrams: 7.216, purity: 0.9166, purityLabel: "916,6 milyem · 22 ayar" },
  { id: "resat_full", symbol: "RESAT_BIRLIK", name: "Reşat Altın (Birlik)", short: "R", unit: "adet", grossWeightGrams: 7.216, purity: 0.9166, purityLabel: "916,6 milyem · 22 ayar" },
  { id: "resat_five", symbol: "RESAT_BESLI", name: "Reşat Beşli", short: "R5", unit: "adet", grossWeightGrams: 36.08, purity: 0.9166, purityLabel: "916,6 milyem · 22 ayar" }
];

export function isGoldKind(value: unknown): value is GoldKind {
  return typeof value === "string" && (GOLD_KIND_IDS as readonly string[]).includes(value);
}

export function getGoldProduct(kind?: GoldKind) {
  return GOLD_PRODUCTS.find((product) => product.id === kind) ?? GOLD_PRODUCTS[0];
}

export function pureGoldGramsPerUnit(kind?: GoldKind) {
  const product = getGoldProduct(kind);
  return product.grossWeightGrams * product.purity;
}

export function goldMetalUnitPrice(pureGramPriceTry: number, kind?: GoldKind) {
  return pureGramPriceTry * pureGoldGramsPerUnit(kind);
}
