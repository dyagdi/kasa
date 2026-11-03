export function parseLocalizedQuantity(value: string) {
  const normalized = value.trim().replace(/\s+/g, "");
  if (!/^(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(normalized)) return undefined;
  const parsed = Number(normalized.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function numberToPlainDecimal(value: number) {
  if (!Number.isFinite(value)) return "";
  const raw = String(value);
  if (!/[eE]/.test(raw)) return raw;
  const [coefficient, exponentText] = raw.toLowerCase().split("e");
  const exponent = Number(exponentText);
  const negative = coefficient.startsWith("-");
  const unsigned = negative ? coefficient.slice(1) : coefficient;
  const [integer, fraction = ""] = unsigned.split(".");
  const digits = `${integer}${fraction}`;
  const decimalIndex = integer.length + exponent;
  const expanded = decimalIndex <= 0
    ? `0.${"0".repeat(-decimalIndex)}${digits}`
    : decimalIndex >= digits.length
      ? `${digits}${"0".repeat(decimalIndex - digits.length)}`
      : `${digits.slice(0, decimalIndex)}.${digits.slice(decimalIndex)}`;
  return negative ? `-${expanded}` : expanded;
}
