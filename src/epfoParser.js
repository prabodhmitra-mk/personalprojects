const RUPEE_FORMATTER = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2
});

const MONTH_PATTERN =
  /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*[-\s']*\d{2,4}\b|\b\d{1,2}[-/]\d{4}\b/i;

const TOTAL_LABELS = [
  /total\s+(?:epf\s+)?balance/i,
  /closing\s+balance/i,
  /current\s+balance/i,
  /grand\s+total/i,
  /balance\s+as\s+(?:on|of)/i
];

const COMPONENT_LABELS = {
  employee: [
    /employee\s+(?:share|balance|contribution)/i,
    /\bee\s+(?:share|balance|contribution)\b/i,
    /\bmember\s+(?:share|balance|contribution)\b/i
  ],
  employer: [
    /employer\s+(?:share|balance|contribution)/i,
    /\ber\s+(?:share|balance|contribution)\b/i
  ],
  pension: [
    /pension\s+(?:share|balance|contribution)/i,
    /\beps\s+(?:share|balance|contribution)\b/i
  ]
};

const HTML_ENTITY_MAP = {
  amp: "&",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: "\"",
  apos: "'"
};

export function parsePassbookInput(rawInput) {
  const text = normalizeInput(rawInput);
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const labelledBalance = findLabelledBalance(lines);
  const components = findComponents(text, lines);
  const tableBalance = findLastTableBalance(lines);
  const componentTotal = sumAvailableComponents(components);

  const selected = labelledBalance
    || (componentTotal ? { value: componentTotal, source: "component-sum", confidence: 0.75 } : null)
    || tableBalance;

  const records = findContributionRecords(lines);
  const warnings = [];

  if (!selected) {
    warnings.push("No total balance could be detected. Try copying the full passbook page or importing an HTML/text export.");
  }

  if (!labelledBalance && tableBalance) {
    warnings.push("Balance was inferred from the last passbook row. Please verify it against the EPFO page.");
  }

  if (selected && selected.confidence < 0.8) {
    warnings.push("The detected balance has medium confidence because the passbook format did not expose a clear total label.");
  }

  return {
    totalBalance: selected?.value ?? null,
    formattedTotalBalance: selected ? formatCurrency(selected.value) : null,
    balanceSource: selected?.source ?? "not-found",
    confidence: selected?.confidence ?? 0,
    components,
    records,
    warnings,
    lineCount: lines.length
  };
}

export function normalizeInput(rawInput) {
  return stripHtml(String(rawInput || ""))
    .replace(/\u00a0/g, " ")
    .replace(/[|]+/g, "\n")
    .replace(/\t+/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function formatCurrency(value) {
  return RUPEE_FORMATTER.format(value);
}

function stripHtml(value) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(?:tr|p|div|li|h[1-6]|table)>/gi, "\n")
    .replace(/<\/(?:td|th)>/gi, " | ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#\d+|#x[a-f0-9]+|[a-z]+);/gi, (_, entity) => decodeEntity(entity));
}

function decodeEntity(entity) {
  if (entity.startsWith("#x")) {
    return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
  }

  if (entity.startsWith("#")) {
    return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
  }

  return HTML_ENTITY_MAP[entity.toLowerCase()] || " ";
}

function findLabelledBalance(lines) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!TOTAL_LABELS.some((pattern) => pattern.test(line))) {
      continue;
    }

    const amounts = extractAmounts(`${line} ${lines[index + 1] || ""}`);
    if (amounts.length > 0) {
      return {
        value: amounts.at(-1),
        source: "labelled-total",
        confidence: 0.92
      };
    }
  }

  return null;
}

function findComponents(text, lines) {
  return Object.fromEntries(
    Object.entries(COMPONENT_LABELS).map(([key, labels]) => [
      key,
      findComponentAmount(key, labels, text, lines)
    ])
  );
}

function findComponentAmount(key, labels, text, lines) {
  const inline = findAmountNearLabel(text, labels);
  if (inline !== null) {
    return inline;
  }

  for (let index = 0; index < lines.length; index += 1) {
    if (!labels.some((pattern) => pattern.test(lines[index]))) {
      continue;
    }

    const currentLineAmounts = extractAmounts(lines[index]);
    if (currentLineAmounts.length > 0) {
      return currentLineAmounts.at(-1);
    }

    if (countComponentLabels(lines[index]) > 1) {
      continue;
    }

    const nextLineAmounts = extractAmounts(lines[index + 1] || "");
    if (nextLineAmounts.length > 0) {
      return nextLineAmounts[0];
    }
  }

  return null;
}

function countComponentLabels(line) {
  return Object.values(COMPONENT_LABELS).filter((labels) => labels.some((pattern) => pattern.test(line))).length;
}

function findAmountNearLabel(text, labels) {
  for (const label of labels) {
    const match = label.exec(text);
    if (!match) {
      continue;
    }

    const afterLabel = text.slice(match.index + match[0].length, match.index + match[0].length + 80);
    const amountMatches = getAmountMatches(afterLabel);
    if (amountMatches.length === 0) {
      continue;
    }

    const firstOtherComponentLabel = findFirstComponentLabelIndex(afterLabel);
    if (firstOtherComponentLabel !== -1 && firstOtherComponentLabel < amountMatches[0].index) {
      continue;
    }

    return parseAmount(amountMatches[0][0]);
  }

  return null;
}

function findFirstComponentLabelIndex(value) {
  return Object.values(COMPONENT_LABELS)
    .flat()
    .map((pattern) => {
      const match = pattern.exec(value);
      return match?.index ?? -1;
    })
    .filter((index) => index >= 0)
    .sort((left, right) => left - right)[0] ?? -1;
}

function findLastTableBalance(lines) {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    if (!MONTH_PATTERN.test(line)) {
      continue;
    }

    const amounts = extractAmounts(line);
    if (amounts.length >= 3) {
      return {
        value: amounts.at(-1),
        source: "last-row-balance",
        confidence: 0.62
      };
    }
  }

  return null;
}

function sumAvailableComponents(components) {
  const values = Object.values(components).filter((value) => value !== null);
  if (values.length < 2) {
    return null;
  }

  return values.reduce((total, value) => total + value, 0);
}

function findContributionRecords(lines) {
  return lines
    .filter((line) => MONTH_PATTERN.test(line))
    .map((line) => {
      const amounts = extractAmounts(line);
      return {
        period: line.match(MONTH_PATTERN)?.[0] || "Unknown",
        employeeShare: amounts[0] ?? null,
        employerShare: amounts[1] ?? null,
        pensionShare: amounts[2] ?? null,
        rowBalance: amounts.at(-1) ?? null,
        raw: line
      };
    })
    .filter((record) => record.rowBalance !== null)
    .slice(-12);
}

function extractAmounts(value) {
  return getAmountMatches(value)
    .map((match) => parseAmount(match[0]))
    .filter((amount) => Number.isFinite(amount));
}

function getAmountMatches(value) {
  const amountPattern = /(?<![A-Za-z0-9])(?:rs\.?|inr|₹)?\s*[-+]?\d[\d,]*(?:\.\d{1,2})?/gi;
  return [...value.matchAll(amountPattern)].filter((match) => !isDatePart(value, match));
}

function parseAmount(value) {
  return Number.parseFloat(value.replace(/(?:rs\.?|inr|₹)/gi, "").replace(/,/g, "").trim());
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
  const numericValue = Number.parseInt(token.replace(/[^\d]/g, ""), 10);

  if ((previousCharacter === "-" || previousCharacter === "/") && numericValue >= 1900 && numericValue <= 2099) {
    return true;
  }

  if (nextCharacter === "/" || nextCharacter === "-") {
    return true;
  }

  return false;
}
