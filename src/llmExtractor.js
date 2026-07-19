export const DEFAULT_OLLAMA_MODEL = "llama3.2:1b";
export const DEFAULT_OLLAMA_URL = "http://127.0.0.1:11434";

const MAX_PROMPT_CHARS = 30000;

export function buildEpfExtractionPrompt(pageText) {
  const trimmedText = String(pageText || "").slice(0, MAX_PROMPT_CHARS);

  return `You are extracting EPFO passbook data from text copied from the official EPFO passbook page.

Return ONLY valid JSON. Do not include markdown, comments, or explanations.

Extract these fields:
{
  "totalBalance": number | null,
  "employeeContributionTotal": number | null,
  "employerContributionTotal": number | null,
  "pensionContributionTotal": number | null,
  "companies": [
    {
      "company": string | null,
      "memberId": string | null,
      "employeeTotal": number | null,
      "employerTotal": number | null,
      "pensionTotal": number | null,
      "latestBalance": number | null
    }
  ],
  "confidence": number,
  "evidence": string[]
}

Rules:
- Use numbers only, without currency symbols or commas.
- For "Current Balance", use the value directly under/after the Current Balance column.
- Do not invent missing values. Use null when unclear.
- Confidence must be between 0 and 1.
- Evidence should cite the labels/lines that support the extracted balance.

EPFO page text:
${trimmedText}`;
}

export async function extractWithOllama({
  pageText,
  model = DEFAULT_OLLAMA_MODEL,
  ollamaUrl = process.env.OLLAMA_URL || DEFAULT_OLLAMA_URL,
  timeoutMs = 90000
}) {
  const safeUrl = normalizeLocalOllamaUrl(ollamaUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${safeUrl}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        prompt: buildEpfExtractionPrompt(pageText),
        stream: false,
        format: "json",
        options: {
          temperature: 0
        }
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Ollama returned ${response.status}: ${message || response.statusText}`);
    }

    const payload = await response.json();
    const extraction = parseLlmExtraction(payload.response || "");

    return {
      provider: "ollama",
      model,
      extraction
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function parseLlmExtraction(responseText) {
  const jsonText = extractJsonObject(responseText);
  const parsed = JSON.parse(jsonText);
  return normalizeLlmExtraction(parsed);
}

export function normalizeLlmExtraction(parsed) {
  const companies = Array.isArray(parsed.companies) ? parsed.companies : [];

  return {
    totalBalance: parseNullableMoney(parsed.totalBalance),
    employeeContributionTotal: parseNullableMoney(parsed.employeeContributionTotal),
    employerContributionTotal: parseNullableMoney(parsed.employerContributionTotal),
    pensionContributionTotal: parseNullableMoney(parsed.pensionContributionTotal),
    companies: companies.map((company) => ({
      company: normalizeText(company.company),
      memberId: normalizeText(company.memberId),
      employeeTotal: parseNullableMoney(company.employeeTotal),
      employerTotal: parseNullableMoney(company.employerTotal),
      pensionTotal: parseNullableMoney(company.pensionTotal),
      latestBalance: parseNullableMoney(company.latestBalance)
    })),
    confidence: clampConfidence(parsed.confidence),
    evidence: Array.isArray(parsed.evidence)
      ? parsed.evidence.map((item) => String(item)).filter(Boolean).slice(0, 8)
      : []
  };
}

export function extractJsonObject(responseText) {
  const text = String(responseText || "").trim();
  const fencedMatch = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const candidate = fencedMatch?.[1]?.trim() || text;
  const firstBrace = candidate.indexOf("{");
  const lastBrace = candidate.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("Local LLM did not return a JSON object.");
  }

  return candidate.slice(firstBrace, lastBrace + 1);
}

function normalizeLocalOllamaUrl(value) {
  const url = new URL(value || DEFAULT_OLLAMA_URL);
  const isLocalHost = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);

  if (!isLocalHost || !["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only local Ollama URLs are allowed.");
  }

  return `${url.protocol}//${url.host}`;
}

function parseNullableMoney(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? roundMoney(value) : null;
  }

  const amount = Number.parseFloat(String(value).replace(/(?:rs\.?|inr|₹)/gi, "").replace(/,/g, "").trim());
  return Number.isFinite(amount) ? roundMoney(amount) : null;
}

function normalizeText(value) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function clampConfidence(value) {
  const confidence = Number(value);
  if (!Number.isFinite(confidence)) {
    return 0;
  }

  return Math.max(0, Math.min(1, confidence));
}

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
