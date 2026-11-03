import https from "node:https";
import { z } from "zod";
import { isValidBistSymbol, normalizeBistSymbol, yahooBistSymbol } from "../src/bist";
import { ASSET_TYPES, assetKey, type AssetType, type PriceQuote } from "../src/types";

export const assetRequestSchema = z.object({
  type: z.enum(ASSET_TYPES),
  symbol: z.string().trim().min(1).max(80)
});

export type AssetRequest = z.infer<typeof assetRequestSchema>;

type MarketPoint = { asOf: string; close: number };
type ProviderValue = { priceTry: number; changePct?: number; asOf: string; source: string };

const CACHE_MS = 15 * 60 * 1000;
const valueCache = new Map<string, { expires: number; value: ProviderValue }>();
const seriesCache = new Map<string, { expires: number; rows: MarketPoint[] }>();
const seriesInflight = new Map<string, Promise<MarketPoint[]>>();
const usSearchCache = new Map<string, { expires: number; stocks: UsStockInfo[] }>();
const usEtfSearchCache = new Map<string, { expires: number; etfs: UsEtfInfo[] }>();
let yahooQueue: Promise<unknown> = Promise.resolve();

export type UsStockInfo = {
  symbol: string;
  name: string;
  exchange: string;
  currency: "USD";
  source: string;
  securityType: "stock";
};

export type UsEtfInfo = {
  symbol: string;
  name: string;
  exchange: string;
  currency: "USD";
  source: string;
  securityType: "etf";
};

export type YahooSearchQuote = {
  symbol?: string;
  shortname?: string;
  longname?: string;
  quoteType?: string;
  exchange?: string;
  exchDisp?: string;
  market?: string;
};

const US_EQUITY_EXCHANGES = new Set(["NMS", "NGM", "NCM", "NAS", "NYQ", "NYS"]);
const US_ETF_EXCHANGES = new Set(["PCX", "NMS", "NGM", "NCM", "NAS", "NYQ", "NYS", "ASE"]);

export function parseUsStockSearch(quotes: YahooSearchQuote[]) {
  return Array.from(new Map(quotes
    .filter((quote) => quote.quoteType === "EQUITY" && quote.symbol && (
      US_EQUITY_EXCHANGES.has(quote.exchange ?? "") ||
      ["NASDAQ", "NYSE"].includes((quote.exchDisp ?? "").toUpperCase())
    ))
    .map((quote) => {
      const symbol = quote.symbol!.toLocaleUpperCase("en-US");
      const stock: UsStockInfo = {
        symbol,
        name: quote.longname || quote.shortname || symbol,
        exchange: quote.exchDisp || quote.exchange || "ABD",
        currency: "USD",
        source: "Yahoo Finance · gecikmeli",
        securityType: "stock"
      };
      return [symbol, stock] as const;
    })).values()).slice(0, 20);
}

export function parseUsEtfSearch(quotes: YahooSearchQuote[]) {
  return Array.from(new Map(quotes
    .filter((quote) => quote.quoteType === "ETF" && quote.symbol && US_ETF_EXCHANGES.has(quote.exchange ?? ""))
    .map((quote) => {
      const symbol = quote.symbol!.toUpperCase();
      const etf: UsEtfInfo = {
        symbol,
        name: quote.longname || quote.shortname || symbol,
        exchange: quote.exchDisp || quote.exchange || "ABD",
        currency: "USD",
        source: "Yahoo Finance · gecikmeli",
        securityType: "etf"
      };
      return [symbol, etf] as const;
    })).values()).slice(0, 20);
}

const browserHeaders = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "application/json,text/plain;q=0.9,*/*;q=0.8"
};
const yahooHeaders = { "User-Agent": "Mozilla/5.0" };

function pct(current: number, previous?: number) {
  return previous && previous !== 0 ? ((current - previous) / previous) * 100 : undefined;
}

function latestPair(rows: MarketPoint[]) {
  const current = rows.at(-1)!;
  const previous = rows.at(-2);
  return { current, previous };
}

async function withCache(key: string, loader: () => Promise<ProviderValue>) {
  const found = valueCache.get(key);
  if (found && found.expires > Date.now()) return found.value;
  const value = await loader();
  valueCache.set(key, { value, expires: Date.now() + CACHE_MS });
  return value;
}

function queueYahoo<T>(task: () => Promise<T>) {
  const run = yahooQueue.then(task, task);
  yahooQueue = run.then(
    () => new Promise((resolve) => setTimeout(resolve, 120)),
    () => new Promise((resolve) => setTimeout(resolve, 120))
  );
  return run;
}

async function loadYahooSeries(symbol: string): Promise<MarketPoint[]> {
  return queueYahoo(async () => {
  const url = new URL(`https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`);
  url.searchParams.set("range", "5d");
  url.searchParams.set("interval", "1d");
  const { status, data: body } = await getJson(url);
  if (status < 200 || status >= 300) throw new Error(`Gecikmeli piyasa fiyatı servisi ${status} yanıtı verdi.`);
  const typedBody = body as {
    chart?: {
      result?: Array<{
        timestamp?: number[];
        indicators?: { quote?: Array<{ close?: Array<number | null> }> };
      }> | null;
      error?: { description?: string } | null;
    };
  };
  const result = typedBody.chart?.result?.[0];
  if (!result) throw new Error(typedBody.chart?.error?.description || `${symbol} için fiyat bulunamadı.`);
  const timestamps = result.timestamp ?? [];
  const closes = result.indicators?.quote?.[0]?.close ?? [];
  const rows = timestamps
    .map((timestamp, index) => ({ asOf: new Date(timestamp * 1000).toISOString(), close: Number(closes[index]) }))
    .filter((point) => Number.isFinite(point.close));
  if (!rows.length) throw new Error(`${symbol} için fiyat bulunamadı.`);
  return rows;
  });
}

function getJson(url: URL): Promise<{ status: number; data: unknown }> {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { headers: yahooHeaders, timeout: 25_000 }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      response.on("end", () => {
        try {
          const status = response.statusCode ?? 500;
          const raw = Buffer.concat(chunks).toString("utf8");
          resolve({ status, data: status >= 200 && status < 300 ? JSON.parse(raw) : null });
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on("timeout", () => request.destroy(new Error("Fiyat kaynağı zaman aşımına uğradı.")));
    request.on("error", reject);
  });
}

async function fetchYahooSeries(symbol: string) {
  const found = seriesCache.get(symbol);
  if (found && found.expires > Date.now()) return found.rows;
  const pending = seriesInflight.get(symbol);
  if (pending) return pending;

  const request = loadYahooSeries(symbol)
    .then((rows) => {
      seriesCache.set(symbol, { rows, expires: Date.now() + CACHE_MS });
      seriesInflight.delete(symbol);
      return rows;
    })
    .catch((error) => {
      seriesInflight.delete(symbol);
      throw error;
    });
  seriesInflight.set(symbol, request);
  return request;
}

async function tefasValue(symbol: string): Promise<ProviderValue> {
  if (!/^[A-Z0-9]{2,10}$/.test(symbol)) throw new Error("Geçersiz TEFAS fon kodu.");
  const response = await fetch("https://www.tefas.gov.tr/api/funds/fonFiyatBilgiGetir", {
    method: "POST",
    headers: { ...browserHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ fonKodu: symbol, dil: "TR", periyod: 1 }),
    signal: AbortSignal.timeout(25_000)
  });
  if (!response.ok) throw new Error("TEFAS fiyat servisi yanıt vermedi.");
  const body = await response.json() as { resultList?: Array<{ tarih: string; fiyat: number }> };
  const rows = (body.resultList ?? [])
    .filter((row) => row.tarih && Number.isFinite(Number(row.fiyat)))
    .sort((a, b) => a.tarih.localeCompare(b.tarih));
  if (!rows.length) throw new Error(`${symbol} için TEFAS fiyatı bulunamadı.`);
  const current = rows.at(-1)!;
  const previous = rows.at(-2);
  return {
    priceTry: Number(current.fiyat),
    changePct: pct(Number(current.fiyat), previous ? Number(previous.fiyat) : undefined),
    asOf: `${current.tarih}T12:00:00+03:00`,
    source: "TEFAS"
  };
}

async function usSecurityValue(symbol: string): Promise<ProviderValue> {
  if (!/^[A-Z0-9.\-]{1,12}$/.test(symbol)) throw new Error("Geçersiz ABD menkul kıymet sembolü.");
  const [stockRows, usdTryRows] = await Promise.all([
    fetchYahooSeries(symbol),
    fetchYahooSeries("TRY=X")
  ]);
  const stock = latestPair(stockRows);
  const usdTry = latestPair(usdTryRows);
  const current = stock.current.close * usdTry.current.close;
  const previous = stock.previous && usdTry.previous
    ? stock.previous.close * usdTry.previous.close
    : undefined;
  return {
    priceTry: current,
    changePct: pct(current, previous),
    asOf: stock.current.asOf,
    source: "Yahoo Finance · gecikmeli"
  };
}

async function bistValue(symbol: string): Promise<ProviderValue> {
  const cleanSymbol = normalizeBistSymbol(symbol);
  if (!isValidBistSymbol(cleanSymbol)) throw new Error("Geçersiz BIST hisse kodu.");
  const pair = latestPair(await fetchYahooSeries(yahooBistSymbol(cleanSymbol)));
  return {
    priceTry: pair.current.close,
    changePct: pct(pair.current.close, pair.previous?.close),
    asOf: pair.current.asOf,
    source: "Yahoo Finance · BIST gecikmeli"
  };
}

export async function resolveBistStock(value: string) {
  const symbol = normalizeBistSymbol(value);
  if (!isValidBistSymbol(symbol)) throw new Error("Geçerli bir BIST kodu girin.");
  const providerSymbol = yahooBistSymbol(symbol);
  const url = new URL(`https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(providerSymbol)}`);
  url.searchParams.set("range", "5d");
  url.searchParams.set("interval", "1d");
  const { status, data: body } = await getJson(url);
  if (status < 200 || status >= 300) throw new Error(`${symbol} Yahoo Finance üzerinde bulunamadı.`);
  const typedBody = body as {
    chart?: {
      result?: Array<{
        meta?: { symbol?: string; currency?: string; longName?: string; shortName?: string };
        timestamp?: number[];
        indicators?: { quote?: Array<{ close?: Array<number | null> }> };
      }> | null;
      error?: { description?: string } | null;
    };
  };
  const result = typedBody.chart?.result?.[0];
  const closes = result?.indicators?.quote?.[0]?.close ?? [];
  if (!result || !closes.some((close) => Number.isFinite(Number(close)))) {
    throw new Error(typedBody.chart?.error?.description || `${symbol} için fiyat bulunamadı.`);
  }
  if (result.meta?.currency && result.meta.currency !== "TRY") {
    throw new Error(`${symbol} için TL fiyatı doğrulanamadı.`);
  }
  return {
    symbol,
    providerSymbol,
    name: result.meta?.longName || result.meta?.shortName || symbol,
    currency: "TRY" as const,
    source: "Yahoo Finance · BIST gecikmeli"
  };
}

export async function searchUsStocks(value: string) {
  const query = value.trim();
  if (!query || query.length > 80) return [];
  const cacheKey = query.toLocaleLowerCase("en-US");
  const cached = usSearchCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.stocks;
  const url = new URL("https://query2.finance.yahoo.com/v1/finance/search");
  url.searchParams.set("q", query);
  url.searchParams.set("quotesCount", "20");
  url.searchParams.set("newsCount", "0");
  const { status, data: body } = await queueYahoo(() => getJson(url));
  if (status < 200 || status >= 300) throw new Error(`Yahoo Finance hisse araması ${status} yanıtı verdi.`);
  const typedBody = body as { quotes?: YahooSearchQuote[] };
  const stocks = parseUsStockSearch(typedBody.quotes ?? []);
  usSearchCache.set(cacheKey, { stocks, expires: Date.now() + 10 * 60 * 1000 });
  return stocks;
}

export async function searchUsEtfs(value: string) {
  const query = value.trim();
  if (!query || query.length > 80) return [];
  const cacheKey = query.toLocaleLowerCase("en-US");
  const cached = usEtfSearchCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.etfs;
  const url = new URL("https://query2.finance.yahoo.com/v1/finance/search");
  url.searchParams.set("q", query);
  url.searchParams.set("quotesCount", "20");
  url.searchParams.set("newsCount", "0");
  const { status, data: body } = await queueYahoo(() => getJson(url));
  if (status < 200 || status >= 300) throw new Error(`Yahoo Finance ETF araması ${status} yanıtı verdi.`);
  const typedBody = body as { quotes?: YahooSearchQuote[] };
  const etfs = parseUsEtfSearch(typedBody.quotes ?? []);
  usEtfSearchCache.set(cacheKey, { etfs, expires: Date.now() + 10 * 60 * 1000 });
  return etfs;
}

async function resolveUsSecurity(value: string, securityType: "stock" | "etf"): Promise<UsStockInfo | UsEtfInfo> {
  const symbol = value.trim().toLocaleUpperCase("en-US");
  if (!/^[A-Z0-9.\-]{1,12}$/.test(symbol)) throw new Error("Geçerli bir ABD menkul kıymet sembolü girin.");
  const url = new URL(`https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`);
  url.searchParams.set("range", "5d");
  url.searchParams.set("interval", "1d");
  const { status, data: body } = await getJson(url);
  if (status < 200 || status >= 300) throw new Error(`${symbol} Yahoo Finance üzerinde bulunamadı.`);
  const typedBody = body as {
    chart?: {
      result?: Array<{
        meta?: { symbol?: string; currency?: string; longName?: string; shortName?: string; exchangeName?: string; fullExchangeName?: string; instrumentType?: string };
        indicators?: { quote?: Array<{ close?: Array<number | null> }> };
      }> | null;
      error?: { description?: string } | null;
    };
  };
  const result = typedBody.chart?.result?.[0];
  const meta = result?.meta;
  const closes = result?.indicators?.quote?.[0]?.close ?? [];
  if (!result || !closes.some((close) => Number.isFinite(Number(close)))) {
    throw new Error(typedBody.chart?.error?.description || `${symbol} için fiyat bulunamadı.`);
  }
  const exchange = meta?.exchangeName ?? "";
  const exchangeLabel = meta?.fullExchangeName ?? exchange;
  const normalizedExchangeLabel = exchangeLabel.toUpperCase();
  const validStockExchange = US_EQUITY_EXCHANGES.has(exchange) || normalizedExchangeLabel === "NYSE" || normalizedExchangeLabel.startsWith("NASDAQ");
  const validEtfExchange = US_ETF_EXCHANGES.has(exchange) || normalizedExchangeLabel === "NYSEARCA" || normalizedExchangeLabel.startsWith("NASDAQ");
  const validType = securityType === "stock"
    ? meta?.instrumentType === "EQUITY" && validStockExchange
    : meta?.instrumentType === "ETF" && validEtfExchange;
  if (meta?.currency !== "USD" || !validType) {
    throw new Error(`${symbol}, doğrulanmış bir ABD ${securityType === "etf" ? "ETF'i" : "hissesi"} değil.`);
  }
  return {
    symbol,
    name: meta?.longName || meta?.shortName || symbol,
    exchange: exchangeLabel || exchange,
    currency: "USD",
    source: "Yahoo Finance · gecikmeli",
    securityType
  };
}

export async function resolveUsStock(value: string) {
  return resolveUsSecurity(value, "stock") as Promise<UsStockInfo>;
}

export async function resolveUsEtf(value: string) {
  return resolveUsSecurity(value, "etf") as Promise<UsEtfInfo>;
}

async function fxValue(symbol: string): Promise<ProviderValue> {
  if (symbol === "TRY") {
    return { priceTry: 1, changePct: 0, asOf: new Date().toISOString(), source: "Sabit kur" };
  }
  if (!/^[A-Z]{3}$/.test(symbol)) throw new Error("Geçersiz döviz kodu.");
  const yahooSymbol = symbol === "USD" ? "TRY=X" : `${symbol}TRY=X`;
  const pair = latestPair(await fetchYahooSeries(yahooSymbol));
  return {
    priceTry: pair.current.close,
    changePct: pct(pair.current.close, pair.previous?.close),
    asOf: pair.current.asOf,
    source: "Yahoo Finance · gecikmeli"
  };
}

async function goldValue(): Promise<ProviderValue> {
  const [goldRows, usdTryRows] = await Promise.all([
    fetchYahooSeries("GC=F"),
    fetchYahooSeries("TRY=X")
  ]);
  const gold = latestPair(goldRows);
  const usdTry = latestPair(usdTryRows);
  const current = (gold.current.close * usdTry.current.close) / 31.1034768;
  const previous = gold.previous && usdTry.previous
    ? (gold.previous.close * usdTry.previous.close) / 31.1034768
    : undefined;
  return {
    priceTry: current,
    changePct: pct(current, previous),
    asOf: gold.current.asOf,
    source: "Yahoo Finance · GC=F × USD/TRY"
  };
}

async function cryptoValues(symbols: string[]) {
  const valid = symbols.filter((symbol) => /^[a-z0-9-]{1,80}$/.test(symbol));
  const values = new Map<string, ProviderValue>();
  if (!valid.length) return values;
  const url = new URL("https://api.coingecko.com/api/v3/simple/price");
  url.searchParams.set("ids", valid.join(","));
  url.searchParams.set("vs_currencies", "try");
  url.searchParams.set("include_24hr_change", "true");
  url.searchParams.set("include_last_updated_at", "true");
  const response = await fetch(url, { headers: browserHeaders, signal: AbortSignal.timeout(25_000) });
  if (!response.ok) throw new Error("CoinGecko fiyat servisi yanıt vermedi.");
  const body = await response.json() as Record<string, { try?: number; try_24h_change?: number; last_updated_at?: number }>;
  for (const symbol of valid) {
    const row = body[symbol];
    if (row?.try == null) continue;
    values.set(symbol, {
      priceTry: row.try,
      changePct: row.try_24h_change,
      asOf: row.last_updated_at ? new Date(row.last_updated_at * 1000).toISOString() : new Date().toISOString(),
      source: "CoinGecko · 24 saat"
    });
  }
  return values;
}

function errorMessage(error: unknown) {
  if (error instanceof Error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") return "Fiyat kaynağı zaman aşımına uğradı.";
    return error.message;
  }
  return "Fiyat alınamadı.";
}

function successQuote(asset: AssetRequest, value: ProviderValue): PriceQuote {
  return {
    key: assetKey(asset.type as AssetType, asset.symbol),
    type: asset.type,
    symbol: asset.symbol,
    ...value,
    status: "ok",
    fetchedAt: new Date().toISOString()
  };
}

function failedQuote(asset: AssetRequest, error: unknown): PriceQuote {
  return {
    key: assetKey(asset.type as AssetType, asset.symbol),
    type: asset.type,
    symbol: asset.symbol,
    source: asset.type === "fund" ? "TEFAS" : asset.type === "crypto" ? "CoinGecko" : "Yahoo Finance",
    status: "error",
    error: errorMessage(error),
    fetchedAt: new Date().toISOString()
  };
}

export async function fetchQuotes(assets: AssetRequest[]) {
  const cryptoAssets = assets.filter((asset) => asset.type === "crypto");
  let cryptos = new Map<string, ProviderValue>();
  let cryptoError: unknown;
  if (cryptoAssets.length) {
    try {
      cryptos = await cryptoValues(Array.from(new Set(cryptoAssets.map((asset) => asset.symbol.toLowerCase()))));
    } catch (error) {
      cryptoError = error;
    }
  }

  return Promise.all(assets.map(async (asset): Promise<PriceQuote> => {
    const symbol = asset.type === "crypto"
      ? asset.symbol.toLowerCase()
      : asset.type === "bist"
        ? normalizeBistSymbol(asset.symbol)
        : asset.symbol.toUpperCase();
    const normalized = { ...asset, symbol };
    try {
      if (asset.type === "crypto") {
        if (cryptoError) throw cryptoError;
        const value = cryptos.get(symbol);
        if (!value) throw new Error(`${symbol} için CoinGecko fiyatı bulunamadı.`);
        return successQuote(normalized, value);
      }
      if (asset.type === "bond") throw new Error("Bono ve tahviller kullanıcı tarafından girilen birim değerle izlenir.");
      const value = await withCache(assetKey(asset.type, symbol), () => {
        if (asset.type === "fund") return tefasValue(symbol);
        if (asset.type === "stock" || asset.type === "etf") return usSecurityValue(symbol);
        if (asset.type === "bist") return bistValue(symbol);
        if (asset.type === "fx") return fxValue(symbol);
        return goldValue();
      });
      return successQuote(normalized, value);
    } catch (error) {
      return failedQuote(normalized, error);
    }
  }));
}
