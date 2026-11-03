import { describe, expect, it } from "vitest";
import { assetKey, type CachedQuote, type Position } from "./types";
import { portfolioTotals, valuePosition } from "./domain";

const position: Position = {
  id: "1",
  type: "stock",
  symbol: "AAPL",
  name: "Apple",
  quantity: 2,
  unitCostTry: 5000,
  location: "Midas",
  createdAt: new Date().toISOString()
};

const quote: CachedQuote = {
  key: assetKey("stock", "AAPL"),
  type: "stock",
  symbol: "AAPL",
  priceTry: 6000,
  changePct: 2,
  source: "test",
  status: "ok",
  fetchedAt: new Date().toISOString()
};

describe("portföy hesapları", () => {
  it("pozisyon değeri ve kârı hesaplar", () => {
    const valued = valuePosition(position, { [quote.key]: quote });
    expect(valued.value).toBe(12000);
    expect(valued.cost).toBe(10000);
    expect(valued.profit).toBe(2000);
  });

  it("toplamları birleştirir", () => {
    const valued = valuePosition(position, { [quote.key]: quote });
    const totals = portfolioTotals([valued]);
    expect(totals.totalValue).toBe(12000);
    expect(totals.totalCost).toBe(10000);
    expect(totals.dailyChangePct).toBeCloseTo(2);
  });

  it("ziynet altının metal değerini brüt ağırlık ve saflıkla hesaplar", () => {
    const gold: Position = {
      id: "gold-1",
      type: "gold",
      symbol: "ZIYNET_CEYREK",
      name: "Çeyrek Ziynet Altın",
      goldKind: "ziynet_quarter",
      quantity: 2,
      unitCostTry: 9500,
      location: "Fiziksel Kasa",
      createdAt: new Date().toISOString()
    };
    const goldQuote: CachedQuote = {
      key: assetKey("gold", "ZIYNET_CEYREK"),
      type: "gold",
      symbol: "ZIYNET_CEYREK",
      priceTry: 6000,
      source: "test",
      status: "ok",
      fetchedAt: new Date().toISOString()
    };

    const valued = valuePosition(gold, { [goldQuote.key]: goldQuote });
    const expectedUnitPrice = 6000 * 1.754 * 0.9166;
    expect(valued.unitPrice).toBeCloseTo(expectedUnitPrice);
    expect(valued.value).toBeCloseTo(expectedUnitPrice * 2);
    expect(valued.cost).toBe(19000);
  });

  it("tür bilgisi olmayan eski altını saf gram gibi değerler", () => {
    const legacyGold: Position = {
      id: "legacy-gold",
      type: "gold",
      symbol: "GRAM_ALTIN",
      name: "Gram Altın",
      quantity: 5,
      location: "Kasa",
      createdAt: new Date().toISOString()
    };
    const goldQuote: CachedQuote = {
      key: assetKey("gold", "GRAM_ALTIN"),
      type: "gold",
      symbol: "GRAM_ALTIN",
      priceTry: 6000,
      source: "test",
      status: "ok",
      fetchedAt: new Date().toISOString()
    };

    expect(valuePosition(legacyGold, { [goldQuote.key]: goldQuote }).value).toBe(30000);
  });

  it("çok küçük kripto ve kesirli hisse miktarlarını sıfıra yuvarlamadan değerler", () => {
    const cryptoPosition: Position = { ...position, id: "c", type: "crypto", symbol: "bitcoin", name: "Bitcoin", quantity: 0.0000003 };
    const cryptoQuote: CachedQuote = { ...quote, key: assetKey("crypto", "bitcoin"), type: "crypto", symbol: "bitcoin", priceTry: 4_000_000 };
    const stockPosition: Position = { ...position, id: "s", quantity: 0.25 };

    expect(valuePosition(cryptoPosition, { [cryptoQuote.key]: cryptoQuote }).value).toBeCloseTo(1.2, 12);
    expect(valuePosition(stockPosition, { [quote.key]: quote }).value).toBe(1500);
  });

  it("kesirli VOO ETF miktarını TL birim fiyatıyla değerler", () => {
    const etfPosition: Position = {
      id: "voo",
      type: "etf",
      symbol: "VOO",
      name: "Vanguard S&P 500 ETF",
      quantity: 0.070582987,
      location: "Midas",
      createdAt: new Date().toISOString()
    };
    const etfQuote: CachedQuote = {
      key: assetKey("etf", "VOO"),
      type: "etf",
      symbol: "VOO",
      priceTry: 30_000,
      source: "test",
      status: "ok",
      fetchedAt: new Date().toISOString()
    };
    expect(valuePosition(etfPosition, { [etfQuote.key]: etfQuote }).value).toBeCloseTo(2117.48961, 5);
  });

  it("bonoyu uydurma piyasa fiyatı yerine elle girilen birim değerle hesaplar", () => {
    const bond: Position = {
      id: "bond-1",
      type: "bond",
      symbol: "TRB-TEST",
      name: "Test Bonosu",
      bondKind: "bono",
      quantity: 4,
      unitCostTry: 950,
      manualPriceTry: 1_020,
      location: "Ziraat Bankası",
      createdAt: new Date().toISOString()
    };
    const valued = valuePosition(bond, {});
    expect(valued.unitPrice).toBe(1_020);
    expect(valued.value).toBe(4_080);
    expect(valued.profit).toBe(280);
    expect(valued.dailyChangeValue).toBeUndefined();
  });
});
