export const formatTry = (value?: number, compact = false) => {
  if (value == null || Number.isNaN(value)) return "—";
  const tiny = value !== 0 && Math.abs(value) < 0.01;
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : tiny ? 8 : 2
  }).format(value);
};

export const formatNumber = (value: number) => {
  const absolute = Math.abs(value);
  return new Intl.NumberFormat("tr-TR", absolute > 0 && absolute < 1
    ? { maximumSignificantDigits: 12 }
    : { maximumFractionDigits: 6 }).format(value);
};

export const formatPct = (value?: number) => {
  if (value == null || Number.isNaN(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(value)}%`;
};

export const relativeTime = (iso?: string) => {
  if (!iso) return "Henüz güncellenmedi";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "Az önce";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} dk önce`;
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(iso));
};
