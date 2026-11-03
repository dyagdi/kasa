export type TefasFundType = "YAT" | "EMK" | "BYF";
export type FundMatchType = TefasFundType | "CODE";

export type FundCatalogItem = {
  code: string;
  name: string;
  fundType: FundMatchType;
  fundTypeLabel: string;
};

type TefasCatalogRow = {
  fonKodu?: string;
  fonUnvan?: string;
  tefasDurum?: boolean;
};

type TefasPriceRow = {
  fonKodu?: string;
  fonUnvan?: string;
  tarih?: string;
  fiyat?: number;
};

type CatalogSnapshot = {
  funds: FundCatalogItem[];
  fetchedAt: string;
  stale: boolean;
  warning?: string;
};

const TEFAS_CATALOG_URL = "https://www.tefas.gov.tr/api/funds/fonGetiriBazliBilgiGetir";
const FUND_TYPES: TefasFundType[] = ["YAT", "EMK", "BYF"];
const FUND_TYPE_LABELS: Record<TefasFundType, string> = {
  YAT: "Yatırım Fonu",
  EMK: "Emeklilik Fonu",
  BYF: "Borsa Yatırım Fonu"
};
const CATALOG_TTL_MS = 6 * 60 * 60 * 1000;
const CODE_VERIFY_TTL_MS = 15 * 60 * 1000;

let catalogCache: { snapshot: CatalogSnapshot; expiresAt: number } | undefined;
let catalogInflight: Promise<CatalogSnapshot> | undefined;
const codeVerifyCache = new Map<string, { fund: FundCatalogItem; expiresAt: number }>();

const requestHeaders = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "application/json",
  "Content-Type": "application/json"
};

function catalogPayload(fonTipi: TefasFundType) {
  return {
    dil: "TR",
    fonTipi,
    kurucuKodu: null,
    sfonTurKod: null,
    fonTurAciklama: null,
    islem: 1,
    fonTurKod: null,
    fonGrubu: null,
    donemGetiri1a: "1",
    donemGetiri3a: "1",
    donemGetiri6a: "1",
    donemGetiri1y: "1",
    donemGetiriyb: "1",
    donemGetiri3y: "1",
    donemGetiri5y: "1",
    basTarih: null,
    bitTarih: null,
    calismaTipi: 2,
    getiriOrani: "1"
  };
}

export function parseTefasCatalog(rows: TefasCatalogRow[], fundType: TefasFundType) {
  return rows
    .filter((row) => row.tefasDurum === true && row.fonKodu?.trim() && row.fonUnvan?.trim())
    .map((row): FundCatalogItem => ({
      code: row.fonKodu!.trim().toUpperCase(),
      name: row.fonUnvan!.trim(),
      fundType,
      fundTypeLabel: FUND_TYPE_LABELS[fundType]
    }));
}

export function parseTefasFundByCode(rows: TefasPriceRow[], requestedCode: string): FundCatalogItem | undefined {
  const code = requestedCode.trim().toUpperCase();
  const matches = rows
    .filter((row) => row.fonKodu?.trim().toUpperCase() === code && row.fonUnvan?.trim() && row.tarih && Number.isFinite(Number(row.fiyat)))
    .sort((a, b) => String(a.tarih).localeCompare(String(b.tarih)));
  const latest = matches.at(-1);
  if (!latest) return undefined;
  return {
    code,
    name: latest.fonUnvan!.trim(),
    fundType: "CODE",
    fundTypeLabel: "TEFAS koduyla doğrulandı · katalog dışı"
  };
}

export async function verifyTefasFundCode(value: string) {
  const code = value.trim().toUpperCase();
  if (!/^[A-Z0-9]{2,10}$/.test(code)) throw new Error("Geçersiz TEFAS fon kodu.");
  const cached = codeVerifyCache.get(code);
  if (cached && cached.expiresAt > Date.now()) return cached.fund;

  const response = await fetch("https://www.tefas.gov.tr/api/funds/fonFiyatBilgiGetir", {
    method: "POST",
    headers: requestHeaders,
    body: JSON.stringify({ fonKodu: code, dil: "TR", periyod: 1 }),
    signal: AbortSignal.timeout(25_000)
  });
  if (!response.ok) throw new Error(`TEFAS fiyat servisi ${response.status} yanıtı verdi.`);
  const body = await response.json() as { resultList?: TefasPriceRow[] };
  const fund = parseTefasFundByCode(body.resultList ?? [], code);
  if (!fund) throw new Error(`${code} için resmî TEFAS kaydı doğrulanamadı.`);
  codeVerifyCache.set(code, { fund, expiresAt: Date.now() + CODE_VERIFY_TTL_MS });
  return fund;
}

async function fetchCatalogType(fundType: TefasFundType) {
  const response = await fetch(TEFAS_CATALOG_URL, {
    method: "POST",
    headers: requestHeaders,
    body: JSON.stringify(catalogPayload(fundType)),
    signal: AbortSignal.timeout(30_000)
  });
  if (!response.ok) throw new Error(`TEFAS katalog servisi ${response.status} yanıtı verdi.`);
  const body = await response.json() as { resultList?: TefasCatalogRow[]; errorMessage?: string | null };
  if (!Array.isArray(body.resultList)) throw new Error(body.errorMessage || "TEFAS katalog yanıtı geçersiz.");
  return parseTefasCatalog(body.resultList, fundType);
}

async function loadCatalog(): Promise<CatalogSnapshot> {
  const lists = await Promise.all(FUND_TYPES.map(fetchCatalogType));
  const funds = Array.from(
    new Map(lists.flat().map((fund) => [fund.code, fund])).values()
  ).sort((a, b) => a.code.localeCompare(b.code, "tr-TR"));
  if (!funds.length) throw new Error("TEFAS aktif fon listesi boş döndü.");
  return { funds, fetchedAt: new Date().toISOString(), stale: false };
}

export async function getTefasFundCatalog(): Promise<CatalogSnapshot> {
  if (catalogCache && catalogCache.expiresAt > Date.now()) return catalogCache.snapshot;
  if (catalogInflight) return catalogInflight;

  catalogInflight = loadCatalog()
    .then((snapshot) => {
      catalogCache = { snapshot, expiresAt: Date.now() + CATALOG_TTL_MS };
      catalogInflight = undefined;
      return snapshot;
    })
    .catch((error) => {
      catalogInflight = undefined;
      if (catalogCache) {
        return {
          ...catalogCache.snapshot,
          stale: true,
          warning: "TEFAS kataloğu yenilenemedi; son başarılı katalog gösteriliyor."
        };
      }
      throw error;
    });
  return catalogInflight;
}

export function normalizeFundSearch(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replaceAll("ı", "i")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function searchFundCatalog(funds: FundCatalogItem[], query: string, limit = 30) {
  const normalizedQuery = normalizeFundSearch(query);
  if (!normalizedQuery) return funds.slice(0, limit);
  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);

  return funds
    .map((fund) => {
      const code = normalizeFundSearch(fund.code);
      const name = normalizeFundSearch(fund.name);
      const haystack = `${code} ${name}`;
      if (!tokens.every((token) => haystack.includes(token))) return undefined;
      const score = code === normalizedQuery ? 0
        : code.startsWith(normalizedQuery) ? 1
          : code.includes(normalizedQuery) ? 2
            : name.startsWith(normalizedQuery) ? 3
              : 4;
      return { fund, score };
    })
    .filter((item): item is { fund: FundCatalogItem; score: number } => Boolean(item))
    .sort((a, b) => a.score - b.score || a.fund.code.localeCompare(b.fund.code, "tr-TR"))
    .slice(0, limit)
    .map((item) => item.fund);
}
