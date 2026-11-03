import { describe, expect, it } from "vitest";
import { isValidBistSymbol, normalizeBistSymbol, yahooBistSymbol } from "./bist";

describe("BIST sembol normalizasyonu", () => {
  it("kullanıcıdan gelen .IS ekini temizleyip sağlayıcı için geri ekler", () => {
    expect(normalizeBistSymbol(" thyao.is ")).toBe("THYAO");
    expect(yahooBistSymbol("THYAO")).toBe("THYAO.IS");
  });

  it("temiz BIST kodlarını doğrular", () => {
    expect(isValidBistSymbol("ISCTR")).toBe(true);
    expect(isValidBistSymbol("THYAO.IS")).toBe(true);
    expect(isValidBistSymbol("THYAO/IS")).toBe(false);
  });
});
