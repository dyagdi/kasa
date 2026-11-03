import { describe, expect, it } from "vitest";
import { formatNumber, formatTry } from "./format";

describe("küçük değer gösterimi", () => {
  it("çok küçük miktarı sıfır gibi göstermez", () => {
    expect(formatNumber(0.0000003)).toBe("0,0000003");
  });

  it("sıfır olmayan kuruş altı değeri görünür tutar", () => {
    expect(formatTry(0.0000003)).not.toBe("₺0,00");
  });
});
