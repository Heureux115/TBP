export function normalizeSearchText(value: string | null | undefined) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function searchTokens(value: string | null | undefined) {
  const normalized = normalizeSearchText(value);
  return normalized ? normalized.split(" ").filter(Boolean) : [];
}

export function matchesSearchTokens(value: string, tokens: string[]) {
  if (!tokens.length) return true;
  const normalized = normalizeSearchText(value);
  return tokens.every((token) => normalized.includes(token));
}
