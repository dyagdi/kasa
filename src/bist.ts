export function normalizeBistSymbol(value: string) {
  return value.trim().toUpperCase().replace(/\.IS$/i, "");
}

export function isValidBistSymbol(value: string) {
  return /^[A-Z0-9]{2,10}$/.test(normalizeBistSymbol(value));
}

export function yahooBistSymbol(value: string) {
  const symbol = normalizeBistSymbol(value);
  return `${symbol}.IS`;
}
