import { z } from "zod";
import { ASSET_TYPES, type CachedQuote, type PortfolioFile, type Position } from "./types";
import { GOLD_KIND_IDS, getGoldProduct, isGoldKind } from "./gold";
import { normalizeBistSymbol } from "./bist";
import { BOND_KIND_IDS } from "./fixed-income";
import { accountSchema, mergeAccountsWithPositions, type Account } from "./accounts";

const POSITIONS_KEY = "kasa.positions.v1";
const QUOTES_KEY = "kasa.quotes.v1";
const ONBOARDING_KEY = "kasa.onboarding.v1";

const positionSchema = z.object({
  id: z.string().min(1),
  type: z.enum(ASSET_TYPES),
  symbol: z.string().min(1).max(80),
  name: z.string().min(1).max(160),
  quantity: z.number().positive(),
  unitCostTry: z.number().nonnegative().optional(),
  location: z.string().min(1).max(80),
  createdAt: z.string(),
  sample: z.boolean().optional(),
  goldKind: z.enum(GOLD_KIND_IDS).optional(),
  bondKind: z.enum(BOND_KIND_IDS).optional(),
  manualPriceTry: z.number().nonnegative().optional(),
  maturityDate: z.string().max(10).optional(),
  note: z.string().max(500).optional()
});

const portfolioSchema = z.object({
  app: z.literal("Kasa"),
  version: z.literal(1),
  exportedAt: z.string(),
  positions: z.array(positionSchema).max(500),
  accounts: z.array(accountSchema).max(100).optional()
});

export function loadPositions(): Position[] {
  try {
    const parsed = z.array(positionSchema).safeParse(JSON.parse(localStorage.getItem(POSITIONS_KEY) ?? "[]"));
    if (!parsed.success) return [];
    const legacySample = parsed.data.length === 4 && parsed.data.every((item) =>
      ["sample-fund", "sample-stock", "sample-crypto", "sample-gold"].includes(item.id) ||
      ["2026-01-10T09:00:00.000Z", "2026-02-12T09:00:00.000Z", "2026-03-20T09:00:00.000Z", "2026-04-05T09:00:00.000Z"].includes(item.createdAt)
    );
    const samplesMarked = legacySample ? parsed.data.map((item) => ({ ...item, sample: true })) : parsed.data;
    return migratePositions(samplesMarked);
  } catch {
    return [];
  }
}

export function savePositions(positions: Position[]) {
  localStorage.setItem(POSITIONS_KEY, JSON.stringify(positions));
}

export function loadQuotes(): Record<string, CachedQuote> {
  try {
    return JSON.parse(localStorage.getItem(QUOTES_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function saveQuotes(quotes: Record<string, CachedQuote>) {
  localStorage.setItem(QUOTES_KEY, JSON.stringify(quotes));
}

export function isOnboardingDone() {
  return localStorage.getItem(ONBOARDING_KEY) === "done";
}

export function finishOnboarding() {
  localStorage.setItem(ONBOARDING_KEY, "done");
}

export function makeExportFile(positions: Position[], accounts: Account[] = []): PortfolioFile {
  return { app: "Kasa", version: 1, exportedAt: new Date().toISOString(), positions, accounts };
}

export function parseImportFile(raw: string): PortfolioFile {
  const result = portfolioSchema.safeParse(JSON.parse(raw));
  if (!result.success) throw new Error("Bu dosya geçerli bir Kasa yedeği değil.");
  const positions = migratePositions(result.data.positions);
  return { ...result.data, positions, accounts: mergeAccountsWithPositions(result.data.accounts ?? [], positions) };
}

export function migratePositions(positions: Position[]): Position[] {
  return positions.map((position) => {
    const withNote = { ...position, note: position.note ?? "" };
    if (position.type === "bist") return { ...withNote, symbol: normalizeBistSymbol(position.symbol) };
    if (position.type === "bond") return { ...withNote, bondKind: position.bondKind ?? "bono" };
    if (position.type !== "gold") return withNote;
    const goldKind = isGoldKind(position.goldKind) ? position.goldKind : "gram";
    const product = getGoldProduct(goldKind);
    return {
      ...withNote,
      goldKind,
      symbol: product.symbol
    };
  });
}
