import { describe, expect, it } from "vitest";
import { mergeAccountsWithPositions } from "./accounts";
import type { Position } from "./types";

describe("hesap listesi göçü", () => {
  it("mevcut pozisyonlardaki Ziraat konumunu kaybetmeden hesap listesine ekler", () => {
    const position: Position = {
      id: "ziraat-fon",
      type: "fund",
      symbol: "TI1",
      name: "Para Piyasası Fonu",
      quantity: 10,
      location: "Ziraat Bankası",
      createdAt: "2026-11-03T00:00:00.000Z"
    };
    const merged = mergeAccountsWithPositions([], [position]);
    expect(merged).toEqual([expect.objectContaining({ name: "Ziraat Bankası", kind: "bank" })]);
  });

  it("aynı hesabı büyük-küçük harf farkıyla çoğaltmaz", () => {
    const positions = [{
      id: "1", type: "stock", symbol: "AAPL", name: "Apple", quantity: 1,
      location: "midas", createdAt: "2026-11-03T00:00:00.000Z"
    }] as Position[];
    const merged = mergeAccountsWithPositions([{ id: "midas", name: "Midas", kind: "broker" }], positions);
    expect(merged).toHaveLength(1);
  });
});

