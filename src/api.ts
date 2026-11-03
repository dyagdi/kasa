import type { CachedQuote, Position, PriceQuote } from "./types";
import { assetKey } from "./types";

export type FundSearchItem = {
  code: string;
  name: string;
  fundType: "YAT" | "EMK" | "BYF" | "CODE";
  fundTypeLabel: string;
};

export type FundSearchResponse = {
  funds: FundSearchItem[];
  meta: {
    source: "TEFAS";
    endpoint: string;
    catalogVersion: number;
    total: number;
    fetchedAt: string;
    stale: boolean;
    warning?: string;
  };
};

export async function searchTefasFunds(query: string, signal?: AbortSignal): Promise<FundSearchResponse> {
  const response = await fetch(`/api/funds/search?q=${encodeURIComponent(query.trim())}`, { signal, cache: "no-store" });
  const data = await response.json() as FundSearchResponse & { error?: string };
  if (!response.ok) throw new Error(data.error || "TEFAS fon kataloğu alınamadı.");
  return data;
}

export type BistStockInfo = {
  symbol: string;
  providerSymbol: string;
  name: string;
  currency: "TRY";
  source: string;
};

export async function resolveBistStock(symbol: string, signal?: AbortSignal): Promise<BistStockInfo> {
  const response = await fetch(`/api/stocks/bist/resolve?symbol=${encodeURIComponent(symbol.trim())}`, { signal, cache: "no-store" });
  const data = await response.json() as { stock?: BistStockInfo; error?: string };
  if (!response.ok || !data.stock) throw new Error(data.error || "BIST hissesi doğrulanamadı.");
  return data.stock;
}

export type UsSecuritySearchItem = {
  symbol: string;
  name: string;
  exchange: string;
  currency: "USD";
  source: string;
  securityType: "stock" | "etf";
};

export type UsStockSearchItem = UsSecuritySearchItem & { securityType: "stock" };
export type UsEtfSearchItem = UsSecuritySearchItem & { securityType: "etf" };

export type UsStockSearchResponse = {
  stocks: UsStockSearchItem[];
  meta: { source: "Yahoo Finance"; delayed: true; warning?: string };
};

export async function searchUsStocks(query: string, signal?: AbortSignal): Promise<UsStockSearchResponse> {
  const response = await fetch(`/api/stocks/us/search?q=${encodeURIComponent(query.trim())}`, { signal, cache: "no-store" });
  const data = await response.json() as UsStockSearchResponse & { error?: string };
  if (!response.ok) throw new Error(data.error || "ABD hissesi araması kullanılamıyor.");
  return data;
}

export type UsEtfSearchResponse = {
  etfs: UsEtfSearchItem[];
  meta: { source: "Yahoo Finance"; delayed: true; warning?: string };
};

export async function searchUsEtfs(query: string, signal?: AbortSignal): Promise<UsEtfSearchResponse> {
  const response = await fetch(`/api/etfs/us/search?q=${encodeURIComponent(query.trim())}`, { signal, cache: "no-store" });
  const data = await response.json() as UsEtfSearchResponse & { error?: string };
  if (!response.ok) throw new Error(data.error || "ABD ETF araması kullanılamıyor.");
  return data;
}

export async function fetchPrices(positions: Position[], signal?: AbortSignal): Promise<PriceQuote[]> {
  const unique = Array.from(
    new Map(
      positions.filter((position) => position.type !== "bond").map((position) => [assetKey(position.type, position.symbol), {
        type: position.type,
        symbol: position.symbol
      }])
    ).values()
  );
  if (!unique.length) return [];
  const response = await fetch("/api/prices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ assets: unique }),
    signal
  });
  if (!response.ok) throw new Error("Fiyat servisine ulaşılamadı.");
  const data = (await response.json()) as { quotes: PriceQuote[] };
  return data.quotes;
}

export function mergeQuotes(previous: Record<string, CachedQuote>, incoming: PriceQuote[]) {
  const next = { ...previous };
  for (const quote of incoming) {
    const old = previous[quote.key];
    next[quote.key] = quote.status === "ok"
      ? { ...quote, lastSuccessAt: quote.fetchedAt }
      : {
          ...old,
          ...quote,
          priceTry: old?.priceTry,
          changePct: old?.changePct,
          asOf: old?.asOf,
          lastSuccessAt: old?.lastSuccessAt,
          status: "error"
        };
  }
  return next;
}
