import { describe, expect, it } from "vitest";
import { normalizeFundSearch, parseTefasCatalog, parseTefasFundByCode, searchFundCatalog, type FundCatalogItem } from "./fund-catalog";

const funds: FundCatalogItem[] = [
  { code: "AFT", name: "AK PORTFÖY YENİ TEKNOLOJİLER YABANCI HİSSE SENEDİ FONU", fundType: "YAT", fundTypeLabel: "Yatırım Fonu" },
  { code: "TI2", name: "İŞ PORTFÖY HİSSE SENEDİ FONU", fundType: "YAT", fundTypeLabel: "Yatırım Fonu" },
  { code: "EAE", name: "AGESA HAYAT VE EMEKLİLİK ALTIN EMEKLİLİK YATIRIM FONU", fundType: "EMK", fundTypeLabel: "Emeklilik Fonu" }
];

describe("TEFAS fon kataloğu", () => {
  it("Türkçe karakterleri kullanıcı dostu biçimde normalleştirir", () => {
    expect(normalizeFundSearch("İŞ Portföy Şemsiye Fönü")).toBe("is portfoy semsiye fonu");
  });

  it("kod ve Türkçe ad üzerinden arar, tam kodu öne alır", () => {
    expect(searchFundCatalog(funds, "aft")[0]?.code).toBe("AFT");
    expect(searchFundCatalog(funds, "is portfoy")[0]?.code).toBe("TI2");
    expect(searchFundCatalog(funds, "emeklilik altın")[0]?.code).toBe("EAE");
  });

  it("yalnızca aktif ve geçerli TEFAS satırlarını kataloğa alır", () => {
    const parsed = parseTefasCatalog([
      { fonKodu: "AAA", fonUnvan: "Aktif Fon", tefasDurum: true },
      { fonKodu: "BBB", fonUnvan: "Pasif Fon", tefasDurum: false },
      { fonKodu: "", fonUnvan: "Eksik Fon", tefasDurum: true }
    ], "YAT");
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({ code: "AAA", name: "Aktif Fon" });
  });

  it("katalog dışı tam kodu resmî fiyat geçmişinden adıyla doğrular", () => {
    const parsed = parseTefasFundByCode([
      { fonKodu: "TI1", fonUnvan: "İŞ PORTFÖY PARA PİYASASI (TL) FONU", tarih: "2026-11-02", fiyat: 1789.850295 },
      { fonKodu: "TI1", fonUnvan: "İŞ PORTFÖY PARA PİYASASI (TL) FONU", tarih: "2026-11-03", fiyat: 1791.393597 },
      { fonKodu: "AAA", fonUnvan: "Başka Fon", tarih: "2026-11-03", fiyat: 1 }
    ], "ti1");
    expect(parsed).toEqual({
      code: "TI1",
      name: "İŞ PORTFÖY PARA PİYASASI (TL) FONU",
      fundType: "CODE",
      fundTypeLabel: "TEFAS koduyla doğrulandı · katalog dışı"
    });
  });
});
