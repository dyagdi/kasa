import { TYPE_META } from "./catalog";
import type { AssetType, CachedQuote, Position } from "./types";
import { assetKey } from "./types";
import { goldMetalUnitPrice } from "./gold";

export type ValuedPosition = Position & {
  quote?: CachedQuote;
  value?: number;
  cost?: number;
  profit?: number;
  dailyChangeValue?: number;
  unitPrice?: number;
};

export function valuePosition(position: Position, quotes: Record<string, CachedQuote>): ValuedPosition {
  const quote = quotes[assetKey(position.type, position.symbol)];
  const unitPrice = position.type === "bond"
    ? position.manualPriceTry
    : quote?.priceTry == null
    ? undefined
    : position.type === "gold"
      ? goldMetalUnitPrice(quote.priceTry, position.goldKind)
      : quote.priceTry;
  const value = unitPrice == null ? undefined : unitPrice * position.quantity;
  const cost = position.unitCostTry == null ? undefined : position.unitCostTry * position.quantity;
  const profit = value == null || cost == null ? undefined : value - cost;
  const dailyChangeValue = position.type === "bond" ? undefined :
    value == null || quote?.changePct == null
      ? undefined
      : value - value / (1 + quote.changePct / 100);
  return { ...position, quote, unitPrice, value, cost, profit, dailyChangeValue };
}

export function portfolioTotals(items: ValuedPosition[]) {
  const totalValue = items.reduce((sum, item) => sum + (item.value ?? 0), 0);
  const totalCost = items.reduce((sum, item) => sum + (item.cost ?? 0), 0);
  const totalProfit = items.reduce((sum, item) => sum + (item.profit ?? 0), 0);
  const knownDailyChange = items.reduce((sum, item) => sum + (item.dailyChangeValue ?? 0), 0);
  const previousValue = totalValue - knownDailyChange;
  return {
    totalValue,
    totalCost,
    totalProfit,
    dailyChangeValue: knownDailyChange,
    dailyChangePct: previousValue > 0 ? (knownDailyChange / previousValue) * 100 : 0
  };
}

export function allocationByType(items: ValuedPosition[]) {
  const values = new Map<AssetType, number>();
  for (const item of items) {
    values.set(item.type, (values.get(item.type) ?? 0) + (item.value ?? 0));
  }
  return Array.from(values.entries())
    .map(([type, value]) => ({ type, value, label: TYPE_META[type].label, color: TYPE_META[type].color }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);
}

export function allocationByLocation(items: ValuedPosition[]) {
  const values = new Map<string, number>();
  for (const item of items) {
    values.set(item.location, (values.get(item.location) ?? 0) + (item.value ?? 0));
  }
  return Array.from(values.entries())
    .map(([location, value]) => ({ location, value }))
    .sort((a, b) => b.value - a.value);
}
