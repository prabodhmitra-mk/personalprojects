import { formatCurrency } from "./epfoParser.js";

const TOTAL_LABELS = [
  /total\s+(?:nps\s+)?(?:corpus|holding|value|valuation|balance|amount)/i,
  /total\s+corpus/i,
  /total\s+valuation/i,
  /total\s+value\s+of\s+holdings/i,
  /current\s+(?:value|valuation|balance|corpus)/i,
  /closing\s+(?:balance|value|corpus)/i,
  /market\s+value/i,
  /valuation\s+amount/i,
  /account\s+balance/i,
  /grand\s+total/i
];

const CONTRIBUTION_LABELS = [
  /total\s+contribution/i,
  /contribution\s+received/i,
  /contribution\s+amount/i,
  /amount\s+contributed/i,
  /subscriber\s+contribution/i
];

const TIER_PATTERN = /\btier\s*-?\s*(?:i|ii|1|2)\b/i;
const PRAN_PATTERN = /\b\d{12}\b/;
const HOLDING_HEADER_PATTERN = /\b(?:scheme|pfm|pension\s+fund|units?|nav|current\s+value|valuation|corpus)\b/i;

export function parseNpsInput(rawInput) {
  const text = normalizeNpsInput(rawInput);
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const investmentSummary = findInvestmentSummary(lines);
  const labelledTotal = findLabelledTotal(lines);
  const holdings = findHoldings(lines);
  const holdingsTotal = sumHoldings(holdings);
  const contributionTotal = investmentSummary?.contributionTotal ?? findLabelledAmount(lines, CONTRIBUTION_LABELS);
  const selected = investmentSummary
    ? { value: investmentSummary.totalValue, source: "investment-summary", confidence: 0.95 }
    : labelledTotal
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
    if (sameLineAmounts.length === 0 && /\b(?:scheme|units?|nav)\b/i.test(line)) {
      continue;
    }

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

    const sameLineAmounts = extractAmounts(line);
    const nextLineAmounts = extractAmounts(lines[index + 1] || "");
    const amounts = sameLineAmounts.length > 0 ? sameLineAmounts : nextLineAmounts;
    if (amounts.length > 0) {
      return amounts.at(-1);
    }
  }

  return null;
}

function findInvestmentSummary(lines) {
  const summaryIndex = lines.findIndex((line) => /investment\s+summary/i.test(line));
  if (summaryIndex === -1) {
    return null;
  }

  for (let index = summaryIndex + 1; index < Math.min(lines.length, summaryIndex + 20); index += 1) {
    const amounts = extractAmounts(lines[index]);
    const hasCurrencySignal = /₹|rs\.?|inr/i.test(lines[index]);

    if (!hasCurrencySignal || amounts.length < 5) {
      continue;
    }

    return {
      totalValue: amounts[0],
      contributionTotal: amounts.length >= 3 ? amounts[2] : null,
      raw: lines[index]
    };
  }

  return null;
}

function findHoldings(lines) {
  const holdings = [];
  const seen = new Set();
  const scopedLines = getHoldingSectionLines(lines);

  for (let index = 0; index < scopedLines.length; index += 1) {
    if (isHoldingNoiseLine(scopedLines[index])) {
      continue;
    }

    const candidates = [
      scopedLines[index],
      `${scopedLines[index]} ${scopedLines[index + 1] || ""}`,
      `${scopedLines[index]} ${scopedLines[index + 1] || ""} ${scopedLines[index + 2] || ""}`
    ];

    for (const candidate of candidates) {
      const holding = parseHoldingLine(candidate);
      if (!holding) {
        continue;
      }

      const key = `${holding.units}|${holding.nav}|${holding.value}`;
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      holdings.push(holding);
      break;
    }
  }

  return holdings;
}

function getHoldingSectionLines(lines) {
  const start = lines.findIndex((line) => /investment\s+details\s*-\s*scheme\s+wise\s+summary/i.test(line));
  if (start === -1) {
    return lines;
  }

  const relativeEnd = lines.slice(start + 1).findIndex((line) =>
    /\b(?:in\s+case\s+of\s+debit|changes\s+made|contribution\/redemption|transaction\s+details|notes)\b/i.test(line));

  return relativeEnd === -1
    ? lines.slice(start + 1)
    : lines.slice(start + 1, start + 1 + relativeEnd);
}

function parseHoldingLine(line) {
  if (/^\s*(?:tier\s+\w+\s+)?(?:scheme|pfm|pension\s+fund).*\bunits?\b.*\bnav\b/i.test(line)) {
    return null;
  }

  const hasSchemeSignal = /\b(?:scheme|asset\s+class|equity|corporate|bond|government|securities|alternate|pension\s+fund|pfm|sbi|uti|lic|hdfc|icici|kotak|axis|tata|aditya|max|e\s*[-–]?\s*tier|c\s*[-–]?\s*tier|g\s*[-–]?\s*tier|a\s*[-–]?\s*tier)\b/i.test(line);
  const hasUnitsOrNav = /\b(?:units?|nav|value|amount|corpus)\b/i.test(line);
  const amounts = extractAmounts(line);

  if (HOLDING_HEADER_PATTERN.test(line) && amounts.length < 2) {
    return null;
  }

  if (!hasSchemeSignal || (amounts.length < 3 && !hasUnitsOrNav) || isTotalLine(line)) {
    return null;
  }

  if (amounts.length < 2) {
    return null;
  }

  const scheme = sanitizeSchemeName(line);
  const tier = line.match(TIER_PATTERN)?.[0]?.replace(/\s+/g, " ") || null;
  const statementSchemeSummary = /pension\s+fund\s+scheme/i.test(line)
    && /\bpop\b/i.test(line)
    && amounts.length >= 3
    && !/\b(?:contribution|closing\s+balance|opening\s+balance|billing)\b/i.test(line);
  const value = statementSchemeSummary ? amounts[0] : amounts.at(-1);
  const units = statementSchemeSummary ? amounts[1] : amounts.length >= 3 ? amounts.at(-3) : amounts[0];
  const nav = statementSchemeSummary ? amounts[2] : amounts.length >= 3 ? amounts.at(-2) : null;

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
    .replace(/\b(?:units?|nav|value|amount|corpus|current|balance|total|valuation)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!scheme) {
    return "NPS holding";
  }

  const pensionFundMatch = /\b(?:SBI|HDFC|ICICI|KOTAK|AXIS|UTI|LIC|TATA|ADITYA|MAX)[A-Z\s]+PENSION\s+FUND\s+SCHEME\b/i.exec(scheme);
  return pensionFundMatch ? scheme.slice(pensionFundMatch.index).trim() : scheme;
}

function isHoldingNoiseLine(line) {
  return /\b(?:investment\s+details|scheme\s+wise\s+value|holdings\(investments\)|particulars\s+total\s+units)\b/i.test(line)
    || /^\s*\(?[A-E]\)?(?:\s+\(?[A-E]\)?|\s+[-=+*/()A-E])+/i.test(line)
    || /^₹\)?/i.test(line);
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
    .filter((match) => !isDatePart(value, match))
    .map((match) => Number.parseFloat(match[0].replace(/(?:rs\.?|inr|₹)/gi, "").replace(/,/g, "").trim()))
    .filter((amount) => Number.isFinite(amount));
}

function isTotalLine(line) {
  return TOTAL_LABELS.some((pattern) => pattern.test(line))
    || CONTRIBUTION_LABELS.some((pattern) => pattern.test(line))
    || /\b(?:subtotal|sub-total)\b/i.test(line);
}

function isDatePart(value, match) {
  const token = match[0].trim();
  const hasCurrencyPrefix = /^(?:rs\.?|inr|₹)/i.test(token);
  if (hasCurrencyPrefix) {
    return false;
  }

  const start = match.index || 0;
  const end = start + match[0].length;
  const previousCharacter = value[start - 1] || "";
  const nextCharacter = value[end] || "";
  const digits = token.replace(/[^\d]/g, "");
  const numericValue = Number.parseInt(digits, 10);

  if ((previousCharacter === "/" || previousCharacter === "-" || previousCharacter === ".") && numericValue >= 1900 && numericValue <= 2099) {
    return true;
  }

  if (nextCharacter === "/" || nextCharacter === "-" || nextCharacter === ".") {
    return true;
  }

  if (digits.length === 8) {
    const day = Number.parseInt(digits.slice(0, 2), 10);
    const month = Number.parseInt(digits.slice(2, 4), 10);
    const year = Number.parseInt(digits.slice(4), 10);

    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= 2099) {
      return true;
    }
  }

  return false;
}

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
