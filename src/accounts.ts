import { z } from "zod";
import type { Position } from "./types";

export const ACCOUNT_KINDS = ["bank", "broker", "exchange", "physical", "other"] as const;
export type AccountKind = (typeof ACCOUNT_KINDS)[number];

export type Account = {
  id: string;
  name: string;
  kind: AccountKind;
};

export const ACCOUNT_KIND_LABELS: Record<AccountKind, string> = {
  bank: "Banka",
  broker: "Yatırım uygulaması",
  exchange: "Kripto borsası",
  physical: "Fiziksel",
  other: "Diğer"
};

export const ACCOUNT_SUGGESTIONS: Array<{ name: string; kind: AccountKind }> = [
  { name: "Ziraat Bankası", kind: "bank" },
  { name: "İş Bankası", kind: "bank" },
  { name: "Garanti BBVA", kind: "bank" },
  { name: "Akbank", kind: "bank" },
  { name: "Yapı Kredi", kind: "bank" },
  { name: "VakıfBank", kind: "bank" },
  { name: "Halkbank", kind: "bank" },
  { name: "Kuveyt Türk", kind: "bank" },
  { name: "QNB", kind: "bank" },
  { name: "Enpara", kind: "bank" },
  { name: "Midas", kind: "broker" },
  { name: "Paribu", kind: "exchange" },
  { name: "Binance TR", kind: "exchange" },
  { name: "BtcTurk", kind: "exchange" },
  { name: "Fiziksel Kasa", kind: "physical" }
];

const ACCOUNTS_KEY = "kasa.accounts.v1";
export const accountSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  kind: z.enum(ACCOUNT_KINDS)
});

function legacyKind(name: string): AccountKind {
  const known = ACCOUNT_SUGGESTIONS.find((item) => item.name.toLocaleLowerCase("tr-TR") === name.toLocaleLowerCase("tr-TR"));
  return known?.kind ?? "other";
}

export function mergeAccountsWithPositions(accounts: Account[], positions: Position[]): Account[] {
  const next = [...accounts];
  for (const position of positions) {
    const name = position.location.trim();
    if (!name || next.some((account) => account.name.toLocaleLowerCase("tr-TR") === name.toLocaleLowerCase("tr-TR"))) continue;
    next.push({ id: crypto.randomUUID(), name, kind: legacyKind(name) });
  }
  return next.sort((a, b) => a.name.localeCompare(b.name, "tr"));
}

export function loadAccounts(positions: Position[] = []): Account[] {
  try {
    const parsed = z.array(accountSchema).safeParse(JSON.parse(localStorage.getItem(ACCOUNTS_KEY) ?? "[]"));
    return mergeAccountsWithPositions(parsed.success ? parsed.data : [], positions);
  } catch {
    return mergeAccountsWithPositions([], positions);
  }
}

export function saveAccounts(accounts: Account[]) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

