import { describe, expect, it } from "vitest";
import { makeExportFile, parseImportFile } from "./storage";
import type { Position } from "./types";

const legacyGold = {
  id: "legacy-gold",
  type: "gold",
  symbol: "ALTIN",
  name: "Eski gram altın kaydı",
  quantity: 12.5,
  unitCostTry: 4500,
  location: "Fiziksel Kasa",
  createdAt: "2025-01-01T00:00:00.000Z"
};

describe("altın veri göçü", () => {
  it("türü olmayan eski altın kaydını veri kaybetmeden grama taşır", () => {
    const parsed = parseImportFile(JSON.stringify({
      app: "Kasa",
      version: 1,
      exportedAt: "2026-01-01T00:00:00.000Z",
      positions: [legacyGold]
    }));

    expect(parsed.positions[0]).toMatchObject({
      id: legacyGold.id,
      type: "gold",
      symbol: "GRAM_ALTIN",
      name: legacyGold.name,
      goldKind: "gram",
      quantity: legacyGold.quantity,
      unitCostTry: legacyGold.unitCostTry,
      location: legacyGold.location,
      createdAt: legacyGold.createdAt,
      note: ""
    });
  });

  it("seçilen altın türünü JSON dışa/içe aktarmada korur", () => {
    const position: Position = {
      id: "ata-1",
      type: "gold",
      symbol: "ATA_LIRA",
      name: "Cumhuriyet / Ata Lira",
      goldKind: "ata_lira",
      quantity: 3,
      location: "Fiziksel Kasa",
      note: "Teyzemin hediyesi",
      createdAt: "2026-01-02T00:00:00.000Z"
    };

    const parsed = parseImportFile(JSON.stringify(makeExportFile([position])));
    expect(parsed.positions[0]).toEqual(position);
  });

  it("çok küçük miktarı ve düz metin notunu JSON turunda korur", () => {
    const position: Position = {
      id: "crypto-small",
      type: "crypto",
      symbol: "bitcoin",
      name: "Bitcoin",
      quantity: 0.0000003,
      location: "Paribu",
      note: "<b>HTML değil, düz metin</b>",
      createdAt: "2026-01-03T00:00:00.000Z"
    };

    const parsed = parseImportFile(JSON.stringify(makeExportFile([position])));
    expect(parsed.positions[0].quantity).toBe(0.0000003);
    expect(parsed.positions[0].note).toBe(position.note);
  });

  it("içe aktarılan BIST sağlayıcı ekini temizler", () => {
    const parsed = parseImportFile(JSON.stringify(makeExportFile([{
      id: "bist-1",
      type: "bist",
      symbol: "thyao.is",
      name: "Türk Hava Yolları",
      quantity: 0.25,
      location: "Banka",
      createdAt: "2026-01-04T00:00:00.000Z"
    }])));
    expect(parsed.positions[0]).toMatchObject({ symbol: "THYAO", quantity: 0.25, note: "" });
  });

  it("kesirli ABD ETF miktarını ve türünü JSON turunda korur", () => {
    const position: Position = {
      id: "voo-etf",
      type: "etf",
      symbol: "VOO",
      name: "Vanguard S&P 500 ETF",
      quantity: 0.070582987,
      location: "Midas",
      note: "Uzun vadeli ETF",
      createdAt: "2026-11-03T12:00:00.000Z"
    };
    const parsed = parseImportFile(JSON.stringify(makeExportFile([position])));
    expect(parsed.positions[0]).toEqual(position);
  });

  it("bono türünü, manuel değeri ve vadeyi JSON turunda korur", () => {
    const position: Position = {
      id: "bond-json",
      type: "bond",
      symbol: "TRB-TEST",
      name: "Özel Sektör Bonosu",
      bondKind: "bono",
      quantity: 2,
      manualPriceTry: 1_050,
      maturityDate: "2027-05-10",
      location: "Ziraat Bankası",
      createdAt: "2026-11-03T12:00:00.000Z"
    };
    expect(parseImportFile(JSON.stringify(makeExportFile([position]))).positions[0]).toEqual({ ...position, note: "" });
  });

  it("hesap listesini JSON yedeğinde korur", () => {
    const accounts = [{ id: "ziraat", name: "Ziraat Bankası", kind: "bank" as const }];
    const parsed = parseImportFile(JSON.stringify(makeExportFile([], accounts)));
    expect(parsed.accounts).toEqual(accounts);
  });
});
