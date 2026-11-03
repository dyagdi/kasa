import { describe, expect, it } from "vitest";
import { parseUsEtfSearch, parseUsStockSearch } from "./providers";

describe("ABD hisse araması", () => {
  it("yalnızca NASDAQ/NYSE equity sonuçlarını tutar", () => {
    const results = parseUsStockSearch([
      { symbol: "AAPL", longname: "Apple Inc.", quoteType: "EQUITY", exchange: "NMS", exchDisp: "NASDAQ" },
      { symbol: "TSLA", longname: "Tesla, Inc.", quoteType: "EQUITY", exchange: "NMS", exchDisp: "NASDAQ" },
      { symbol: "SPY", longname: "SPDR S&P 500 ETF", quoteType: "ETF", exchange: "PCX", exchDisp: "NYSEArca" },
      { symbol: "NASA", longname: "Tema Space Innovators ETF", quoteType: "EQUITY", exchange: "PCX", exchDisp: "NYSEArca", market: "us_market" },
      { symbol: "7203.T", longname: "Toyota", quoteType: "EQUITY", exchange: "JPX", exchDisp: "Tokyo" }
    ]);

    expect(results.map((stock) => stock.symbol)).toEqual(["AAPL", "TSLA"]);
    expect(results[0]).toMatchObject({ name: "Apple Inc.", currency: "USD" });
  });

  it("NASA, COPX ve VOO ETF'lerini kabul edip uygun olmayan türleri reddeder", () => {
    const results = parseUsEtfSearch([
      { symbol: "NASA", shortname: "Tema Space Innovators ETF", quoteType: "ETF", exchange: "PCX", exchDisp: "NYSEArca" },
      { symbol: "COPX", longname: "Global X Copper Miners ETF", quoteType: "ETF", exchange: "PCX", exchDisp: "NYSEArca" },
      { symbol: "VOO", longname: "Vanguard S&P 500 ETF", quoteType: "ETF", exchange: "PCX", exchDisp: "NYSEArca" },
      { symbol: "AAPL", longname: "Apple Inc.", quoteType: "EQUITY", exchange: "NMS", exchDisp: "NASDAQ" },
      { symbol: "VFIAX", longname: "Vanguard 500 Index Fund", quoteType: "MUTUALFUND", exchange: "NAS" },
      { symbol: "BTC-USD", longname: "Bitcoin USD", quoteType: "CRYPTOCURRENCY", exchange: "CCC" },
      { symbol: "BAD", longname: "Foreign ETF", quoteType: "ETF", exchange: "JPX", exchDisp: "Tokyo" }
    ]);

    expect(results.map((etf) => etf.symbol)).toEqual(["NASA", "COPX", "VOO"]);
    expect(results.every((etf) => etf.securityType === "etf")).toBe(true);
  });
});
