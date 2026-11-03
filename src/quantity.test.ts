import { describe, expect, it } from "vitest";
import { numberToPlainDecimal, parseLocalizedQuantity } from "./quantity";

describe("yerelleştirilmiş miktar", () => {
  it("virgül ve noktayı aynı küçük ondalık değere dönüştürür", () => {
    expect(parseLocalizedQuantity("0,0000003")).toBe(0.0000003);
    expect(parseLocalizedQuantity("0.0000003")).toBe(0.0000003);
    expect(parseLocalizedQuantity("0,25")).toBe(0.25);
    expect(parseLocalizedQuantity("0.25")).toBe(0.25);
  });

  it("bilimsel gösterimdeki Number değerini form için düz ondalığa açar", () => {
    expect(numberToPlainDecimal(0.0000003)).toBe("0.0000003");
  });

  it("geçersiz veya birden çok ayraçlı girdiyi reddeder", () => {
    expect(parseLocalizedQuantity("0,1.2")).toBeUndefined();
    expect(parseLocalizedQuantity("bir")).toBeUndefined();
  });
});
