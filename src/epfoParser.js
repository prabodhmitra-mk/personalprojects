const RUPEE_FORMATTER = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2
});

const MONTH_PATTERN =
  /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*[-\s']*\d{2,4}\b|\b\d{1,2}[-/]\d{4}\b/i;

const DEFAULT_COMPANY_NAME = "Unknown company";

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

const COMPANY_LABELS = [
  /(?:establishment|employer|company)(?:\s+(?:id\s*&\s*name|name|details))?\s*[:\-]\s*(.+)$/i,
  /(?:establishment|employer|company)\s*[:\-]\s*(.+)$/i
];

const MEMBER_ID_PATTERN = /\b[A-Z]{2}[A-Z0-9]{3}\d{17}\b/i;

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
  const records = findContributionRecords(lines);
  const companySummaries = summarizeByCompany(records);
  const companyBalance = findCompanyBalanceTotal(companySummaries);
  const componentTotal = sumAvailableComponents(components);

  const selected = labelledBalance
    || companyBalance
    || (componentTotal ? { value: componentTotal, source: "component-sum", confidence: 0.75 } : null)
    || tableBalance;

  const totals = buildTotals(components, records);
  const warnings = [];

  if (!selected) {
    warnings.push("No total balance could be detected. Try copying the full passbook page or importing an HTML/text export.");
  }

  if (!labelledBalance && tableBalance) {
    warnings.push("Balance was inferred from the last passbook row. Please verify it against the EPFO page.");
  }

  if (!labelledBalance && companyBalance) {
    warnings.push("Balance was calculated by summing the latest detected company/member balances. Please verify it against EPFO.");
  }

  if (records.length > 0 && companySummaries.some((summary) => summary.company === DEFAULT_COMPANY_NAME)) {
    warnings.push("Some rows did not include a detectable employer/company name, so they were grouped as Unknown company.");
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
    totals,
    companySummaries,
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

function findCompanyBalanceTotal(companySummaries) {
  const summariesWithBalance = companySummaries.filter((summary) => summary.latestBalance !== null);
  const hasNamedCompany = summariesWithBalance.some((summary) => summary.company !== DEFAULT_COMPANY_NAME);

  if (summariesWithBalance.length === 0 || (!hasNamedCompany && summariesWithBalance.length === 1)) {
    return null;
  }

  return {
    value: summariesWithBalance.reduce((total, summary) => total + summary.latestBalance, 0),
    source: "company-balance-sum",
    confidence: 0.68
  };
}

function sumAvailableComponents(components) {
  const values = Object.values(components).filter((value) => value !== null);
  if (values.length < 2) {
    return null;
  }

  return values.reduce((total, value) => total + value, 0);
}

function findContributionRecords(lines) {
  const records = [];
  let currentCompany = DEFAULT_COMPANY_NAME;
  let currentMemberId = null;

  for (const line of lines) {
    const companyName = extractCompanyName(line);
    if (companyName) {
      currentCompany = companyName;
    }

    const memberId = extractMemberId(line);
    if (memberId) {
      currentMemberId = memberId;
    }

    if (!MONTH_PATTERN.test(line)) {
      continue;
    }

    const amounts = extractAmounts(line);
    if (amounts.length < 3) {
      continue;
    }

    const shares = mapContributionAmounts(amounts);
    records.push({
      company: currentCompany,
      memberId: currentMemberId,
      period: line.match(MONTH_PATTERN)?.[0] || "Unknown",
      employeeShare: shares.employeeShare,
      employerShare: shares.employerShare,
      pensionShare: shares.pensionShare,
      rowBalance: shares.rowBalance,
      raw: line
    });
  }

  return records;
}

function summarizeByCompany(records) {
  const summaries = new Map();

  for (const record of records) {
    const company = record.company || DEFAULT_COMPANY_NAME;
    const summary = summaries.get(company) || {
      company,
      memberIds: new Set(),
      employeeTotal: 0,
      employerTotal: 0,
      pensionTotal: 0,
      latestBalancesByMember: new Map(),
      recordCount: 0
    };

    const memberKey = record.memberId || company;

    if (record.memberId) {
      summary.memberIds.add(record.memberId);
    }

    summary.employeeTotal += record.employeeShare || 0;
    summary.employerTotal += record.employerShare || 0;
    summary.pensionTotal += record.pensionShare || 0;
    summary.recordCount += 1;

    if (record.rowBalance !== null) {
      summary.latestBalancesByMember.set(memberKey, record.rowBalance);
    }

    summaries.set(company, summary);
  }

  return [...summaries.values()].map((summary) => {
    const balances = [...summary.latestBalancesByMember.values()];

    return {
      company: summary.company,
      memberIds: [...summary.memberIds],
      employeeTotal: roundMoney(summary.employeeTotal),
      employerTotal: roundMoney(summary.employerTotal),
      pensionTotal: roundMoney(summary.pensionTotal),
      contributionTotal: roundMoney(summary.employeeTotal + summary.employerTotal + summary.pensionTotal),
      latestBalance: balances.length > 0 ? roundMoney(balances.reduce((total, value) => total + value, 0)) : null,
      recordCount: summary.recordCount
    };
  });
}

function buildTotals(components, records) {
  const recordTotals = records.reduce(
    (totals, record) => ({
      employee: totals.employee + (record.employeeShare || 0),
      employer: totals.employer + (record.employerShare || 0),
      pension: totals.pension + (record.pensionShare || 0)
    }),
    { employee: 0, employer: 0, pension: 0 }
  );

  const hasRecordTotals = records.length > 0;
  const employee = hasRecordTotals ? recordTotals.employee : components.employee;
  const employer = hasRecordTotals ? recordTotals.employer : components.employer;
  const pension = hasRecordTotals ? recordTotals.pension : components.pension;

  return {
    employee: employee === null ? null : roundMoney(employee),
    employer: employer === null ? null : roundMoney(employer),
    pension: pension === null ? null : roundMoney(pension),
    contributionTotal: [employee, employer, pension].some((value) => value !== null)
      ? roundMoney([employee, employer, pension].reduce((total, value) => total + (value || 0), 0))
      : null
  };
}

function extractCompanyName(line) {
  if (MONTH_PATTERN.test(line) || countComponentLabels(line) > 1) {
    return null;
  }

  for (const label of COMPANY_LABELS) {
    const match = label.exec(line);
    if (!match?.[1]) {
      continue;
    }

    const companyName = sanitizeCompanyName(match[1]);
    if (companyName) {
      return companyName;
    }
  }

  return null;
}

function sanitizeCompanyName(value) {
  const companyName = value
    .replace(MEMBER_ID_PATTERN, "")
    .replace(/^[A-Z0-9]{5,}\s*[-:]?\s*/i, "")
    .replace(/\bmember\s+id\b.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!companyName || /\b(?:wage\s+month|employee\s+share|employer\s+share|balance)\b/i.test(companyName)) {
    return null;
  }

  return companyName;
}

function extractMemberId(line) {
  const labelledMemberId = /member\s+id\s*[:\-]\s*([A-Z0-9]+)/i.exec(line);
  if (labelledMemberId?.[1]) {
    return labelledMemberId[1].toUpperCase();
  }

  const memberId = MEMBER_ID_PATTERN.exec(line);
  return memberId?.[0]?.toUpperCase() || null;
}

function mapContributionAmounts(amounts) {
  if (amounts.length >= 6) {
    return {
      employeeShare: amounts.at(-4) ?? null,
      employerShare: amounts.at(-3) ?? null,
      pensionShare: amounts.at(-2) ?? null,
      rowBalance: amounts.at(-1) ?? null
    };
  }

  return {
    employeeShare: amounts[0] ?? null,
    employerShare: amounts[1] ?? null,
    pensionShare: amounts[2] ?? null,
    rowBalance: amounts.at(-1) ?? null
  };
}

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
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
