export type PulseCategorySummary = {
  id: string;
  name: string;
  description: string | null;
};

export type PulseKnowledgeSummary = {
  id: string;
  category: PulseCategorySummary;
  content: unknown;
  type: string;
};

export type PulseKnowledgeReference = {
  id: string;
  title: string;
  type: string;
  categoryId: string;
  categoryName: string;
};

const STOP_WORDS = new Set([
  "about",
  "also",
  "and",
  "are",
  "best",
  "can",
  "could",
  "did",
  "do",
  "does",
  "draft",
  "from",
  "give",
  "have",
  "help",
  "how",
  "into",
  "is",
  "it",
  "its",
  "just",
  "kpi",
  "kpis",
  "like",
  "may",
  "me",
  "might",
  "mine",
  "more",
  "most",
  "must",
  "my",
  "need",
  "not",
  "our",
  "please",
  "practice",
  "practices",
  "share",
  "should",
  "steps",
  "suppose",
  "that",
  "their",
  "then",
  "there",
  "these",
  "this",
  "to",
  "want",
  "was",
  "were",
  "what",
  "when",
  "where",
  "which",
  "with",
  "would",
  "you",
  "your",
]);

function normalized(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function knowledgeTitle(content: unknown) {
  if (!content || typeof content !== "object" || !("title" in content)) return "Untitled knowledge item";
  const title = (content as { title?: unknown }).title;
  return typeof title === "string" && title.trim() ? title.trim() : "Untitled knowledge item";
}

export function pulseQueryTerms(query: string) {
  return [
    ...new Set(
      normalized(query)
        .split(/\s+/)
        .filter((term) => term.length >= 2 && !STOP_WORDS.has(term)),
    ),
  ];
}

export function rankPulseCategories(
  query: string,
  categories: PulseCategorySummary[],
  limit = 2,
): PulseCategorySummary[] {
  const queryText = normalized(query);
  const terms = pulseQueryTerms(query);
  return categories
    .map((category) => {
      const name = normalized(category.name);
      const description = normalized(category.description ?? "");
      let score = name && queryText.includes(name) ? 20 : 0;
      for (const term of terms) {
        if (name.split(" ").includes(term)) score += 6;
        else if (name.includes(term)) score += 3;
        if (description.includes(term)) score += 1;
      }
      return { category, score };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.category.name.localeCompare(right.category.name))
    .slice(0, limit)
    .map((item) => item.category);
}

export function rankPulseKnowledge(query: string, entries: PulseKnowledgeSummary[], limit = 20) {
  const queryText = normalized(query);
  const terms = pulseQueryTerms(query);
  if (!terms.length) return [];
  const phrases = terms.length >= 2 ? [terms.slice(0, 3).join(" "), terms.slice(0, 2).join(" ")] : [];

  return entries
    .map((entry) => {
      const title = normalized(knowledgeTitle(entry.content));
      const category = normalized(`${entry.category.name} ${entry.category.description ?? ""}`);
      const content = normalized(JSON.stringify(entry.content));
      const matchedTerms = new Set<string>();
      let score = 0;
      for (const term of terms) {
        if (title.includes(term)) {
          score += 12;
          matchedTerms.add(term);
        } else if (category.includes(term)) {
          score += 4;
          matchedTerms.add(term);
        } else if (content.includes(term)) {
          score += 1;
          matchedTerms.add(term);
        }
      }
      for (const phrase of phrases) if (phrase && title.includes(phrase)) score += 24;
      if (title && queryText.includes(title)) score += 40;
      return { entry, score, matchedTerms: matchedTerms.size };
    })
    .filter((item) => item.score > 0 && item.matchedTerms >= Math.min(2, terms.length))
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map((item) => item.entry);
}

function requestedKnowledgeTypes(query: string) {
  return {
    SOP: /\b(sop|steps?|process|procedure|workflow|how\s+to|guide)\b/i.test(query),
    BEST_PRACTICE: /\b(best\s+practices?|recommendations?|guidelines?)\b/i.test(query),
    KPI: /\b(kpis?|metrics?|targets?|benchmarks?|measure)\b/i.test(query),
  };
}

export function selectPulseKnowledgeReferences(query: string, entries: PulseKnowledgeSummary[]) {
  const ranked = rankPulseKnowledge(query, entries, entries.length);
  const requested = requestedKnowledgeTypes(query);
  const hasRequestedTypes = Object.values(requested).some(Boolean);
  const selected: PulseKnowledgeSummary[] = [];

  if (requested.SOP) selected.push(...ranked.filter((entry) => entry.type === "SOP").slice(0, 1));
  if (requested.BEST_PRACTICE) selected.push(...entries.filter((entry) => entry.type === "BEST_PRACTICE").slice(0, 12));
  if (requested.KPI) selected.push(...entries.filter((entry) => entry.type === "KPI").slice(0, 15));
  if (!hasRequestedTypes) selected.push(...ranked.slice(0, 8));

  return [...new Map(selected.map((entry) => [entry.id, entry])).values()].map((entry): PulseKnowledgeReference => ({
    id: entry.id,
    title: knowledgeTitle(entry.content),
    type: entry.type,
    categoryId: entry.category.id,
    categoryName: entry.category.name,
  }));
}

function safeMarkdownLabel(title: string) {
  return title.replace(/[\[\]()]/g, "").slice(0, 160) || "Open knowledge item";
}

export function finalizePulseKnowledgeLinks(output: string, references: PulseKnowledgeReference[]) {
  const allowed = new Map(references.map((reference) => [reference.id.toLowerCase(), reference]));
  const linked = new Set<string>();
  const canonical = output.replace(
    /\[([^\]\n]{1,200})\]\(knowledge:([0-9a-fA-F-]{36})\)/g,
    (original, _label: string, rawId: string) => {
      const reference = allowed.get(rawId.toLowerCase());
      if (!reference) return original.replace(/\(knowledge:[^)]+\)/, "");
      linked.add(reference.id);
      return `[${safeMarkdownLabel(reference.title)}](knowledge:${reference.id})`;
    },
  );
  const missing = references.filter((reference) => !linked.has(reference.id));
  if (!missing.length) return canonical;
  const links = missing.map(
    (reference) =>
      `- [${safeMarkdownLabel(reference.title)}](knowledge:${reference.id}) — ${reference.type.replace("_", " ")}`,
  );
  return `${canonical.trim()}\n\n**Relevant knowledge**\n${links.join("\n")}`;
}

export function compactPulseValue(value: unknown, depth = 0): unknown {
  if (typeof value === "string") return value.length > 1_500 ? `${value.slice(0, 1_497)}...` : value;
  if (value === null || typeof value !== "object") return value;
  if (depth >= 8) return "[additional detail omitted]";
  if (Array.isArray(value)) return value.slice(0, 16).map((item) => compactPulseValue(item, depth + 1));
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, compactPulseValue(item, depth + 1)]),
  );
}
