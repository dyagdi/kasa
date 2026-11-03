export const BOND_KIND_IDS = ["bono", "tahvil", "eurobond"] as const;
export type BondKind = (typeof BOND_KIND_IDS)[number];

export const BOND_KINDS: Array<{ id: BondKind; label: string; hint: string }> = [
  { id: "bono", label: "Bono", hint: "Bir yıldan kısa vadeli borçlanma aracı" },
  { id: "tahvil", label: "Tahvil", hint: "Bir yıl veya daha uzun vadeli borçlanma aracı" },
  { id: "eurobond", label: "Eurobond", hint: "Yabancı para cinsi uzun vadeli borçlanma aracı" }
];

export function getBondKind(kind?: BondKind) {
  return BOND_KINDS.find((item) => item.id === kind) ?? BOND_KINDS[0];
}

