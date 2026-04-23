/**
 * Prosty fuzzy-match do dopasowania imion z pisma odręcznego do pracowników.
 * Zwraca najlepszego kandydata lub null, jeśli pewność < threshold.
 */

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // usuń diakrytyki
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const m: number[][] = [];
  for (let i = 0; i <= b.length; i++) m[i] = [i];
  for (let j = 0; j <= a.length; j++) m[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = a[j - 1] === b[i - 1] ? 0 : 1;
      m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + cost);
    }
  }
  return m[b.length][a.length];
}

/** Score 0..1 — im wyżej, tym lepiej. */
function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  // Token overlap (pojedyncze słowa)
  const aTokens = na.split(" ").filter(Boolean);
  const bTokens = nb.split(" ").filter(Boolean);
  const common = aTokens.filter((t) => bTokens.includes(t)).length;
  if (common > 0 && (aTokens.length === 1 || bTokens.length === 1)) {
    // jedno pasujące słowo przy krótkim imieniu → wystarczy
    return 0.9;
  }
  if (common > 0) {
    const tokenScore = common / Math.max(aTokens.length, bTokens.length);
    if (tokenScore >= 0.5) return 0.85;
  }
  // Levenshtein na całych stringach
  const maxLen = Math.max(na.length, nb.length);
  const dist = levenshtein(na, nb);
  return 1 - dist / maxLen;
}

export interface MatchCandidate {
  id: string;
  name: string;
}

export function matchEmployee<T extends MatchCandidate>(
  raw: string | undefined | null,
  candidates: T[],
  threshold = 0.72,
): { match: T | null; score: number } {
  if (!raw || !raw.trim() || raw.includes("[?]")) return { match: null, score: 0 };
  let best: { match: T | null; score: number } = { match: null, score: 0 };
  for (const c of candidates) {
    const score = similarity(raw, c.name);
    if (score > best.score) best = { match: c, score };
  }
  return best.score >= threshold ? best : { match: null, score: best.score };
}
