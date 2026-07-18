import { formatCurrency } from "./epfoParser.js";

const TOTAL_LABELS = [
  /total\s+(?:nps\s+)?(?:corpus|holding|value|valuation|balance|amount)/i,
  /current\s+(?:value|valuation|balance|corpus)/i,
  /market\s+value/i,
  /valuation\s+amount/i,
  /account\s+balance/i
];

const CONTRIBUTION_LABELS = [
  /total\s+contribution/i,
  /contribution\s+amount/i,
  /amount\s+contributed/i
];

const TIER_PATTERN = /\btier\s*-?\s*(?:i|ii|1|2)\b/i;
const PRAN_PATTERN = /\b\d{12}\b/;

export function parseNpsInput(rawInput) {
  const text = normalizeNpsInput(rawInput);
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const labelledTotal = findLabelledTotal(lines);
  const holdings = findHoldings(lines);
  const holdingsTotal = sumHoldings(holdings);
  const contributionTotal = findLabelledAmount(lines, CONTRIBUTION_LABELS);
  const selected = labelledTotal
    || (holdingsTotal !== null ? { value: holdingsTotal, source: "holding-sum", confidence: 0.72 } : null);
  const warnings = [];

  if (!selected) {
    warnings.push("No NPS total value could be detected. Try copying the NPS holdings/statement page or a full transaction/holding export.");
  }

  if (!labelledTotal && holdingsTotal !== null) {
    warnings.push("NPS value was calculated by summing detected holding values. Please verify it against the NPS portal.");
  }

  if (selected && selected.confidence < 0.8) {
    warnings.push("The detected NPS value has medium confidence because it was inferred from holdings.");
  }

  return {
    totalValue: selected?.value ?? null,
    formattedTotalValue: selected ? formatCurrency(selected.value) : null,
    valueSource: selected?.source ?? "not-found",
    confidence: selected?.confidence ?? 0,
    contributionTotal,
    pran: findPran(lines),
    holdings,
    warnings,
    lineCount: lines.length
  };
}

export function normalizeNpsInput(rawInput) {
  return stripHtml(String(rawInput || ""))
    .replace(/\u00a0/g, " ")
    .replace(/[|]+/g, "\n")
    .replace(/\t+/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripHtml(value) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(?:tr|p|div|li|h[1-6]|table)>/gi, "\n")
    .replace(/<\/(?:td|th)>/gi, " | ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#8377;/g, "₹");
}

function findLabelledTotal(lines) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!TOTAL_LABELS.some((pattern) => pattern.test(line))) {
      continue;
    }

    const sameLineAmounts = extractAmounts(line);
    const nextLineAmounts = extractAmounts(lines[index + 1] || "");
    const amounts = sameLineAmounts.length > 0 ? sameLineAmounts : nextLineAmounts;

    if (amounts.length > 0) {
      return {
        value: amounts.at(-1),
        source: "labelled-total",
        confidence: 0.9
      };
    }
  }

  return null;
}

function findLabelledAmount(lines, labels) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!labels.some((pattern) => pattern.test(line))) {
      continue;
    }

    const amounts = extractAmounts(`${line} ${lines[index + 1] || ""}`);
    if (amounts.length > 0) {
      return amounts.at(-1);
    }
  }

  return null;
}

function findHoldings(lines) {
  return lines
    .map(parseHoldingLine)
    .filter(Boolean);
}

function parseHoldingLine(line) {
  const hasSchemeSignal = /\b(?:scheme|asset\s+class|equity|corporate|government|alternate|e\s*-?\s*tier|c\s*-?\s*tier|g\s*-?\s*tier|a\s*-?\s*tier)\b/i.test(line);
  const hasUnitsOrNav = /\b(?:units?|nav|value|amount|corpus)\b/i.test(line);

  if (!hasSchemeSignal || !hasUnitsOrNav || TOTAL_LABELS.some((pattern) => pattern.test(line))) {
    return null;
  }

  const amounts = extractAmounts(line);
  if (amounts.length < 2) {
    return null;
  }

  const scheme = sanitizeSchemeName(line);
  const tier = line.match(TIER_PATTERN)?.[0]?.replace(/\s+/g, " ") || null;
  const value = amounts.at(-1);
  const nav = amounts.length >= 3 ? amounts.at(-2) : null;
  const units = amounts.length >= 3 ? amounts.at(-3) : amounts[0];

  return {
    scheme,
    tier,
    units,
    nav,
    value,
    raw: line
  };
}

function sanitizeSchemeName(line) {
  const scheme = line
    .replace(/(?:rs\.?|inr|₹)?\s*[-+]?\d[\d,]*(?:\.\d+)?/gi, " ")
    .replace(/\b(?:units?|nav|value|amount|corpus|current|balance|total)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  return scheme || "NPS holding";
}

function sumHoldings(holdings) {
  if (holdings.length === 0) {
    return null;
  }

  return roundMoney(holdings.reduce((total, holding) => total + (holding.value || 0), 0));
}

function findPran(lines) {
  for (const line of lines) {
    if (!/\bpran\b/i.test(line)) {
      continue;
    }

    const match = PRAN_PATTERN.exec(line);
    if (match) {
      return match[0];
    }
  }

  return null;
}

function extractAmounts(value) {
  const amountPattern = /(?<![A-Za-z0-9])(?:rs\.?|inr|₹)?\s*[-+]?\d[\d,]*(?:\.\d{1,4})?/gi;
  return [...value.matchAll(amountPattern)]
    .map((match) => Number.parseFloat(match[0].replace(/(?:rs\.?|inr|₹)/gi, "").replace(/,/g, "").trim()))
    .filter((amount) => Number.isFinite(amount));
}

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
