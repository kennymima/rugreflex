const RESEARCH_PATTERNS = [
  /\btoday\b/i,
  /\btonight\b/i,
  /\bcurrently\b/i,
  /\bcurrent\b/i,
  /\bright now\b/i,
  /\blatest\b/i,
  /\brecent\b/i,
  /\bthis week\b/i,
  /\bthis month\b/i,
  /\btrending\b/i,
  /\bnews\b/i,
  /\bwhat(?:'s| is) happening\b/i,
  /\bwhat are people saying\b/i,
  /\bsentiment\b/i,
  /\bsearch the web\b/i,
  /\bsearch online\b/i,
  /\blook online\b/i,
  /\bonline research\b/i,
];

export function shouldResearch(question: string): boolean {
  const normalized = question.trim();

  if (!normalized) {
    return false;
  }

  return RESEARCH_PATTERNS.some((pattern) =>
    pattern.test(normalized)
  );
}
