import type { GoldKind } from "./gold";
import type { BondKind } from "./fixed-income";
import type { Account } from "./accounts";

export const ASSET_TYPES = ["fund", "stock", "etf", "bist", "crypto", "fx", "gold", "bond"] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

export type Position = {
  id: string;
  type: AssetType;
  symbol: string;
  name: string;
  quantity: number;
  unitCostTry?: number;
  location: string;
  createdAt: string;
  sample?: boolean;
  goldKind?: GoldKind;
  bondKind?: BondKind;
  manualPriceTry?: number;
  maturityDate?: string;
  note?: string;
};

export type PriceStatus = "ok" | "error";

export type PriceQuote = {
  key: string;
  type: AssetType;
  symbol: string;
  priceTry?: number;
  changePct?: number;
  asOf?: string;
  fetchedAt: string;
  source: string;
  status: PriceStatus;
  error?: string;
};

export type CachedQuote = PriceQuote & {
  lastSuccessAt?: string;
};

export type PortfolioFile = {
  app: "Kasa";
  version: 1;
  exportedAt: string;
  positions: Position[];
  accounts?: Account[];
};

export const assetKey = (type: AssetType, symbol: string) =>
  `${type}:${symbol.trim().toUpperCase()}`;
