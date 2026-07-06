# Business Requirements Document: Personal Financial Management Platform

## 1. Executive Summary

This product is a personal financial management and wealth intelligence platform. It should help an individual or household understand everything they own, owe, pay for, are protected by, can claim, or can optimize. The platform will ingest financial documents and data from multiple sources, normalize that information into a structured wealth model, and provide dashboards, insights, goals, recommendations, reminders, and long-term family wealth visibility.

The first implementation begins with parsing NPS Tier 1 statements, but the product direction is broader: mutual funds, PF/EPF, bank accounts, fixed deposits, insurance policies, credit cards, reward points, loans, tax documents, property, gold, other manual assets, and eventually connected applications or APIs.

The long-term product should act as a private financial operating system for a household, with AI-assisted document understanding and recommendations layered on top of reliable structured financial data.

## 2. Product Vision

Create a secure, extensible, AI-assisted platform that gives users a complete view of their financial life and helps them make better decisions every day.

The product should answer questions such as:

- What is my total net worth today?
- What assets do I own, and where are they held?
- What liabilities do I have?
- How is my wealth allocated across liquid and illiquid assets?
- What changed since last month or last year?
- Am I adequately insured?
- Are any bills, premiums, offers, policies, rewards, or documents expiring soon?
- What should I do today to protect or increase wealth?
- What financial knowledge should my family or children understand about our wealth?
- What documents and accounts would my family need if something happened to me?

## 3. Business Objectives

1. Build a trusted personal wealth dashboard that consolidates scattered financial information.
2. Reduce manual effort by extracting data from PDFs, emails, statements, and future APIs.
3. Support Indian financial products and documents as a first-class use case.
4. Provide actionable insights, not just static reporting.
5. Create a foundation that can later become a commercial product for other users.
6. Preserve financial knowledge for family members and future generations.
7. Keep user trust, privacy, and explainability at the center of the product.

## 4. Target Users

### 4.1 Primary User

An individual who manages personal or household finances across many institutions and wants a reliable view of net worth, obligations, goals, and opportunities.

### 4.2 Household / Family User

A family member who needs access to selected financial information, such as assets, policies, documents, nominees, obligations, and emergency instructions.

### 4.3 Future Commercial User

External users who want a private financial dashboard and AI wealth assistant for their own household.

### 4.4 Future Advisor / Professional View

Optional future mode for a financial planner, tax consultant, or trusted advisor to review user-approved data.

## 5. Core User Problems

1. Financial information is spread across emails, PDFs, apps, portals, statements, and physical documents.
2. Each provider uses different statement formats.
3. Important details such as nominees, policy benefits, renewal dates, premiums, rewards, and obligations are easy to forget.
4. Most dashboards show investments only, not full household wealth.
5. Users do not always know what action to take today.
6. Family members may not understand the structure of wealth or know where to find critical information.
7. Existing tools may not handle Indian financial documents well.
8. Manual tracking in spreadsheets becomes stale and unreliable.

## 6. Scope

### 6.1 In Scope

- Manual upload of financial documents.
- Gmail-based ingestion of attachments from selected senders.
- Password-protected PDF processing.
- Parsing of NPS, mutual fund, PF/EPF, bank, insurance, credit card, loan, and other financial reports over time.
- LLM-assisted classification and extraction for variable document formats.
- Structured financial data model for assets, liabilities, accounts, holdings, policies, offers, rewards, goals, and documents.
- Net worth dashboard.
- Asset allocation and liquidity views.
- Insurance coverage tracking.
- Credit card, reward point, and offer tracking.
- Property and immovable asset tracking.
- Goal planning and progress tracking.
- Recommendations, reminders, and alerts.
- Family wealth vault and legacy planning features.
- User review workflow for low-confidence extracted data.
- Traceability from each extracted value back to source document or data source.

### 6.2 Out of Scope for Early Versions

- Direct execution of investments, trades, payments, or transfers.
- Automated financial decisions without user approval.
- Regulated financial advice presented as guaranteed advice.
- Full tax filing.
- Direct integration with every financial institution.
- Multi-user commercial SaaS infrastructure in the first prototype.

## 7. Product Principles

1. **Structured truth over chatbot memory**: Financial facts must live in validated structured data, not only in LLM context.
2. **Source-backed numbers**: Every important value should be traceable to a document, account, API response, or manual entry.
3. **Human review for uncertainty**: Low-confidence extraction should ask the user to confirm or correct values.
4. **Privacy by design**: Sensitive documents, passwords, tokens, and financial data require strong protection.
5. **Extensible by source and product type**: Adding a new bank, report, or asset type should not require redesigning the whole system.
6. **Action-oriented insights**: The system should highlight what matters and what action is useful now.
7. **Family continuity**: The platform should help preserve financial knowledge for trusted family members.
8. **Explainable recommendations**: The user should understand why a recommendation was made.

## 8. Major Functional Requirements

### 8.1 Data Ingestion

The system shall support multiple ingestion channels:

- Manual PDF upload.
- Gmail attachment fetch from specific senders.
- Password-protected document handling.
- Manual asset and liability entry.
- Future API integrations with banks, investment platforms, insurers, credit cards, reward providers, and account aggregators.
- Future mobile document scan/upload.

The system shall store metadata about each ingested item:

- Source type.
- Provider or institution.
- Received date.
- Statement period or valuation date.
- Document type.
- Owner or account holder.
- Processing status.
- Extraction confidence.
- User review status.

### 8.2 Document Classification

The system shall classify documents into categories such as:

- NPS statement.
- Mutual fund statement.
- PF/EPF statement.
- Bank statement.
- Credit card statement.
- Insurance policy.
- Loan statement.
- Tax document.
- Property document.
- Reward or offer document.
- Unknown / needs review.

Classification may use rules, provider-specific patterns, or LLM-based classification.

### 8.3 Document Extraction

The system shall extract structured values from supported documents.

Required capabilities:

- Extract text from PDFs.
- Decrypt password-protected PDFs when user provides password.
- Extract table-like financial rows where possible.
- Use deterministic parsers for known formats.
- Use LLM-assisted extraction for unknown or variable formats.
- Validate extracted data against schemas.
- Store confidence and source references.
- Allow user correction.

### 8.4 Financial Data Normalization

The system shall normalize extracted data into canonical entities:

- Institution.
- Account.
- Asset.
- Liability.
- Holding.
- Transaction.
- Valuation.
- Insurance policy.
- Premium schedule.
- Credit card.
- Reward program.
- Offer.
- Goal.
- Property.
- Document.
- Alert.
- Recommendation.

### 8.5 Net Worth Dashboard

The system shall show:

- Total assets.
- Total liabilities.
- Net worth.
- Net worth trend over time.
- Asset allocation.
- Liquid vs illiquid wealth.
- Investment vs insurance vs property vs cash split.
- Last updated date by source.
- Data completeness and stale-data warnings.

### 8.6 Investment Tracking

The system shall support:

- NPS holdings.
- Mutual fund holdings.
- EPF/PF balances.
- Fixed deposits.
- Stocks or ETFs in future.
- Gold and other investments.
- Current value.
- Cost or contribution where available.
- Allocation by asset class.
- Provider and account-level breakdown.

### 8.7 Insurance Tracking

The system shall support:

- Life insurance.
- Health insurance.
- Term plans.
- ULIPs or savings policies.
- Vehicle and property insurance in future.
- Policy number.
- Insurer.
- Sum assured.
- Premium amount.
- Premium due date.
- Maturity date.
- Nominee.
- Coverage gaps.
- Renewal reminders.

### 8.8 Liability Tracking

The system shall support:

- Home loans.
- Vehicle loans.
- Personal loans.
- Credit card outstanding.
- Other debts.
- Outstanding principal.
- EMI.
- Interest rate.
- Tenure.
- Next due date.
- Prepayment opportunities.

### 8.9 Credit Card, Rewards, and Offers

The system shall support:

- Credit card details.
- Billing cycle and due date.
- Outstanding amount.
- Reward points.
- Point expiry.
- Card benefits.
- Merchant offers.
- Offers about to expire.
- Recommendations on which card or offer to use for a planned purchase.

### 8.10 Property and Immovable Assets

The system shall support:

- Residential property.
- Commercial property.
- Land.
- Estimated current value.
- Purchase price.
- Ownership share.
- Loan linkage.
- Rental income.
- Documents.
- Nominee or inheritance notes.
- Manual valuation updates.

### 8.11 Goals and Planning

The system shall support:

- Emergency fund goal.
- Retirement goal.
- Education goal.
- Home purchase goal.
- Debt reduction goal.
- Insurance adequacy goal.
- Custom goals.

For each goal, the system should track:

- Target amount.
- Target date or horizon.
- Current progress.
- Linked assets.
- Gap analysis.
- Suggested actions.

### 8.12 Recommendations and Insights

The system shall generate recommendations such as:

- Premium due soon.
- Credit card bill due soon.
- Reward points expiring soon.
- Merchant offer expiring soon.
- Portfolio concentration risk.
- Asset allocation drift.
- Stale account data.
- Underinsured risk.
- Excess idle cash.
- High-interest debt review.
- Tax-saving opportunity.
- Goal funding gap.
- Missing nominee information.
- Missing emergency document.

Recommendations should include:

- Reason.
- Expected benefit or risk avoided.
- Source data used.
- Confidence.
- Action status.
- User feedback.

### 8.13 Family Wealth Vault

The system shall support future family and legacy functionality:

- Secure document vault.
- Important account inventory.
- Nominee and beneficiary tracking.
- Emergency access plan.
- Family member roles.
- Read-only family view.
- Child-friendly financial education summaries.
- Wealth timeline and decision history.
- "If something happens to me" summary.

### 8.14 Conversational Assistant

The system shall support a future assistant that can answer:

- "What is my net worth?"
- "What changed this month?"
- "Which policies are due?"
- "How much is liquid?"
- "What offers are expiring?"
- "Am I underinsured?"
- "What should I do today?"
- "Which assets should my family know about?"

The assistant should only answer using permissioned user data and should cite sources or calculations where relevant.

## 9. Non-Functional Requirements

### 9.1 Security

- Encrypt sensitive data at rest.
- Never commit credentials, tokens, passwords, or financial documents.
- Store document passwords securely if persistent storage is ever enabled.
- Support user-controlled deletion.
- Support audit logs for access and processing.
- Use least-privilege scopes for external integrations.

### 9.2 Privacy

- User financial data must not be used for model training without explicit consent.
- User should understand what data is stored and where.
- Export and delete options should exist before commercial launch.
- Family sharing must be explicit and role-based.

### 9.3 Reliability

- The system must not silently accept uncertain extraction as final truth.
- Data conflicts should be surfaced for review.
- Duplicate documents should be detected.
- Stale values should be marked clearly.

### 9.4 Explainability

- Dashboards should show source and last updated date.
- Recommendations should explain why they were generated.
- LLM-extracted values should include confidence and source text references.

### 9.5 Extensibility

- New document types should be added through parser or extractor plugins.
- New asset classes should map into the canonical model.
- New recommendation types should be added without changing ingestion.
- Web and mobile clients should be able to use the same backend model later.

## 10. LLM Requirements

The LLM layer should help with:

- Document classification.
- Extraction from unknown or variable PDFs.
- Mapping messy text to structured schemas.
- Summarizing changes.
- Generating plain-language explanations.
- Producing recommendations.
- Powering natural-language questions.

The LLM layer must:

- Return schema-validated output.
- Include confidence scores.
- Preserve source references.
- Avoid making unsupported assumptions.
- Ask for review when confidence is low.
- Not overwrite confirmed user data without approval.
- Clearly distinguish facts, calculations, and suggestions.

## 11. Data Quality and Review Workflow

Each extracted financial record should have a status:

- Imported.
- Parsed.
- Needs review.
- Confirmed.
- Corrected.
- Rejected.

The user should be able to:

- See what was extracted.
- Compare against source document snippets.
- Correct values.
- Mark records as confirmed.
- Re-run extraction after parser improvements.

## 12. MVP Definition

The first meaningful MVP should include:

1. Manual PDF upload.
2. Gmail attachment fetch.
3. Password-protected PDF parsing.
4. NPS statement parsing.
5. Mutual fund statement parsing.
6. PF/EPF balance parsing or manual entry.
7. Manual asset entry for property, gold, cash, and fixed deposits.
8. Manual liability entry.
9. Basic insurance policy entry.
10. Net worth dashboard.
11. Source and last-updated tracking.
12. Basic action list:
    - Stale data.
    - Upcoming due dates.
    - Missing insurance details.
    - Missing nominee details.

The current codebase has started item 1 through item 4 for NPS.

## 13. Future Product Roadmap Themes

### 13.1 Wealth Intelligence

- Net worth history.
- Allocation drift.
- Risk concentration.
- Goal readiness.
- Liquidity analysis.

### 13.2 Daily Action Center

- What to pay.
- What to review.
- What offer to use.
- What is expiring.
- What data is stale.

### 13.3 Family and Legacy

- Family wealth map.
- Emergency document vault.
- Nominee tracking.
- Child-friendly education mode.
- Wealth transfer readiness.

### 13.4 Commercial Product Readiness

- Multi-user accounts.
- Subscription plans.
- Consent and compliance flows.
- Secure cloud storage.
- Mobile app.
- Advisor sharing.
- Data export and deletion.

## 14. Success Metrics

### User Value Metrics

- Percentage of user wealth represented in dashboard.
- Number of financial accounts or assets connected/tracked.
- Number of actionable insights generated.
- Number of stale or missing records resolved.
- Reduction in missed due dates or expiries.
- User confidence in net worth accuracy.

### Product Quality Metrics

- Parser accuracy by document type.
- LLM extraction confidence and correction rate.
- Duplicate document detection rate.
- Time from document upload to dashboard update.
- Percentage of extracted values with source references.

### Commercial Readiness Metrics

- User retention.
- Repeat dashboard usage.
- Recommendation engagement.
- Conversion from manual tracking to automated ingestion.
- Trust and privacy satisfaction.

## 15. Key Risks

1. Financial documents have highly variable formats.
2. LLM extraction can be inaccurate without validation.
3. Users may not trust recommendations unless they are explainable.
4. Handling sensitive financial data requires strong security discipline.
5. Commercializing the product may introduce regulatory and compliance requirements.
6. API access for financial institutions may be limited or unreliable.
7. Family sharing requires careful access control and consent design.

## 16. Open Questions

1. Should the first complete MVP focus only on Indian financial products?
2. Should data stay local-first initially, or move toward cloud sync sooner?
3. Should the platform support multiple family members from the beginning?
4. What is the preferred LLM provider and data privacy model?
5. Should document storage be mandatory, optional, or user-controlled per document?
6. Which three document types after NPS should be prioritized: mutual funds, EPF/PF, insurance, bank statements, or credit cards?
7. Should recommendations be rule-based first, LLM-generated first, or hybrid from the start?

## 17. Immediate Next Steps

1. Create a technical architecture document.
2. Define the canonical financial data model.
3. Define document taxonomy and parser plugin interface.
4. Define LLM extraction schema and validation workflow.
5. Refactor the current NPS prototype to match the future architecture.
6. Add the next parser: likely mutual fund CAS or EPF/PF.
7. Add manual asset and liability entry to support basic net worth before every integration exists.

