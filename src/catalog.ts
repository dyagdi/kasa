import type { AssetType, Position } from "./types";
import { GOLD_PRODUCTS } from "./gold";

export type CatalogItem = {
  type: AssetType;
  symbol: string;
  name: string;
  short?: string;
};

export const TYPE_META: Record<AssetType, { label: string; color: string; hint: string }> = {
  fund: { label: "TEFAS Fonu", color: "#28785f", hint: "Örn. YAC, AFT, MAC" },
  stock: { label: "ABD Hissesi", color: "#446b8e", hint: "Örn. AAPL, MSFT, NVDA" },
  etf: { label: "ABD ETF", color: "#5f6f9b", hint: "Örn. NASA, COPX, VOO" },
  bist: { label: "BIST Hissesi", color: "#356d7b", hint: "Örn. THYAO, ISCTR" },
  crypto: { label: "Kripto", color: "#8b6b2d", hint: "CoinGecko kimliği, örn. bitcoin" },
  fx: { label: "Döviz", color: "#78588b", hint: "Örn. USD, EUR, GBP" },
  gold: { label: "Altın", color: "#b07331", hint: "Gram, ziynet, Ata veya Reşat" },
  bond: { label: "Bono / Tahvil", color: "#7b6351", hint: "ISIN veya kısa kod" }
};

export const CATALOG: CatalogItem[] = [
  { type: "fund", symbol: "YAC", name: "Yapı Kredi Portföy İkinci Fon Sepeti Fonu" },
  { type: "fund", symbol: "AFT", name: "Ak Portföy Yeni Teknolojiler Yabancı Hisse Senedi Fonu" },
  { type: "fund", symbol: "MAC", name: "Marmara Capital Portföy Hisse Senedi Fonu" },
  { type: "fund", symbol: "TI2", name: "İş Portföy Hisse Senedi Fonu" },
  { type: "fund", symbol: "IPB", name: "İş Portföy Birinci Değişken Fon" },
  { type: "crypto", symbol: "bitcoin", name: "Bitcoin", short: "BTC" },
  { type: "crypto", symbol: "ethereum", name: "Ethereum", short: "ETH" },
  { type: "crypto", symbol: "solana", name: "Solana", short: "SOL" },
  { type: "crypto", symbol: "tether", name: "Tether", short: "USDT" },
  { type: "crypto", symbol: "avalanche-2", name: "Avalanche", short: "AVAX" },
  { type: "fx", symbol: "USD", name: "Amerikan Doları", short: "USD" },
  { type: "fx", symbol: "EUR", name: "Euro", short: "EUR" },
  { type: "fx", symbol: "GBP", name: "İngiliz Sterlini", short: "GBP" },
  { type: "fx", symbol: "CHF", name: "İsviçre Frangı", short: "CHF" },
  ...GOLD_PRODUCTS.map((product) => ({ type: "gold" as const, symbol: product.symbol, name: product.name, short: product.short }))
];

export const SAMPLE_POSITIONS: Position[] = [
  {
    id: "sample-fund",
    type: "fund",
    symbol: "YAC",
    name: "Yapı Kredi Portföy İkinci Fon Sepeti Fonu",
    quantity: 1250,
    unitCostTry: 11.8,
    location: "İş Bankası",
    createdAt: "2026-01-10T09:00:00.000Z",
    sample: true
  },
  {
    id: "sample-stock",
    type: "stock",
    symbol: "AAPL",
    name: "Apple",
    quantity: 8,
    unitCostTry: 6850,
    location: "Midas",
    createdAt: "2026-02-12T09:00:00.000Z",
    sample: true
  },
  {
    id: "sample-crypto",
    type: "crypto",
    symbol: "bitcoin",
    name: "Bitcoin",
    quantity: 0.035,
    unitCostTry: 2680000,
    location: "Paribu",
    createdAt: "2026-03-20T09:00:00.000Z",
    sample: true
  },
  {
    id: "sample-gold",
    type: "gold",
    symbol: "GRAM_ALTIN",
    name: "Gram Altın (24 ayar)",
    quantity: 18,
    unitCostTry: 5920,
    location: "Fiziksel Kasa",
    createdAt: "2026-04-05T09:00:00.000Z",
    sample: true,
    goldKind: "gram"
  }
];

export function catalogFor(type: AssetType) {
  return CATALOG.filter((item) => item.type === type);
}

export function displaySymbol(type: AssetType, symbol: string) {
  const match = CATALOG.find(
    (item) => item.type === type && item.symbol.toLowerCase() === symbol.toLowerCase()
  );
  return match?.short ?? (type === "gold" ? "gr" : symbol.toUpperCase());
}
