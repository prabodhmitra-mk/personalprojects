import assert from "node:assert/strict";
import test from "node:test";

import { buildEpfExtractionPrompt, parseLlmExtraction } from "../src/llmExtractor.js";

test("builds a local LLM prompt with EPFO extraction schema", () => {
  const prompt = buildEpfExtractionPrompt("Current Balance Rs 13,17,956");

  assert.match(prompt, /Return ONLY valid JSON/);
  assert.match(prompt, /totalBalance/);
  assert.match(prompt, /Current Balance Rs 13,17,956/);
});

test("parses fenced local LLM JSON and normalizes money strings", () => {
  const extraction = parseLlmExtraction(`
    Here is the JSON:
    \`\`\`json
    {
      "totalBalance": "Rs 13,17,956",
      "employeeContributionTotal": "3,05,452",
      "employerContributionTotal": "2,86,702",
      "pensionContributionTotal": "41,250",
      "companies": [
        {
          "company": "ABC TECHNOLOGIES",
          "memberId": "BGBNG18662230000010514",
          "employeeTotal": "68,459",
          "employerTotal": "64,709",
          "pensionTotal": "3,750",
          "latestBalance": "13,17,956"
        }
      ],
      "confidence": 1.2,
      "evidence": ["Current Balance row"]
    }
    \`\`\`
  `);

  assert.equal(extraction.totalBalance, 1317956);
  assert.equal(extraction.employeeContributionTotal, 305452);
  assert.equal(extraction.employerContributionTotal, 286702);
  assert.equal(extraction.pensionContributionTotal, 41250);
  assert.equal(extraction.companies[0].latestBalance, 1317956);
  assert.equal(extraction.confidence, 1);
  assert.deepEqual(extraction.evidence, ["Current Balance row"]);
});
