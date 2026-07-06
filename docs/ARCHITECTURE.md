# Architecture: Personal Financial Management Platform

## 1. Purpose

This document defines the technical architecture for the personal financial management and wealth intelligence platform described in `docs/BRD.md`.

The architecture must support the current prototype, which parses NPS Tier 1 statements, while leaving a clear path toward a secure multi-user product with document intelligence, structured wealth modeling, recommendations, family/legacy features, web and mobile clients, and optional commercial deployment.

## 2. Architecture Goals

1. Ingest financial data from many sources: Gmail, manual upload, APIs, mobile scan, and manual entry.
2. Parse many document formats without coupling the dashboard to any single statement layout.
3. Use deterministic parsers where possible and LLM extraction where needed.
4. Store financial facts in validated structured data with source traceability.
5. Compute net worth, goals, risk, liquidity, alerts, and recommendations from normalized data.
6. Keep sensitive data secure and user-controlled.
7. Support local-first development now and cloud/mobile product expansion later.
8. Allow new providers, document types, asset classes, and recommendation types to be added as plugins.

## 3. Design Principles

### 3.1 Structured truth

The database is the source of truth for financial records. LLMs classify, extract, explain, and recommend, but their output must be validated before it changes confirmed financial data.

### 3.2 Source-backed values

Every important value should trace back to at least one source:

- Original document.
- Document page or text span.
- Email metadata.
- API response.
- Manual user entry.
- User correction.

### 3.3 Human review for uncertain data

Extraction confidence determines whether a value is auto-accepted, marked for review, or rejected.

### 3.4 Separation of concerns

The platform is split into:

- Ingestion.
- Document processing.
- Extraction.
- Normalization.
- Wealth calculations.
- Recommendations.
- Presentation.

Each layer should have stable interfaces.

### 3.5 Local-first to cloud-ready

The early prototype can run locally with Streamlit and files. The architecture should still align with a future service-based backend, persistent database, secure object storage, and mobile clients.

## 4. High-Level System View

```text
Data Sources
  - Gmail
  - Manual Upload
  - Manual Entry
  - Future APIs
  - Future Mobile Scan
        |
        v
Ingestion Layer
        |
        v
Document Store + Raw Metadata
        |
        v
Document Intelligence Pipeline
  - Decryption
  - Text/table extraction
  - Classification
  - Parser selection
  - Deterministic extraction
  - LLM extraction fallback
  - Validation
  - Review workflow
        |
        v
Canonical Financial Data Model
        |
        v
Wealth Engine + Recommendation Engine
        |
        v
User Experiences
  - Dashboard
  - Action Center
  - Assistant
  - Family Vault
  - Future Mobile App
```

## 5. Current Prototype Architecture

The current codebase is a local prototype:

```text
app.py
  Streamlit UI

src/wealth_dashboard/gmail_client.py
  Gmail OAuth and PDF attachment download

src/wealth_dashboard/pdf_reader.py
  Password-protected PDF text extraction

src/wealth_dashboard/nps_parser.py
  NPS Tier 1 statement parsing

src/wealth_dashboard/models.py
  Initial NPS statement and holding models
```

Current limitations:

- No persistent structured database.
- No multi-document history.
- No generalized parser interface.
- No LLM extraction layer.
- No review workflow.
- No multi-user or family permission model.
- Dashboard is directly tied to parsed NPS output.

The next implementation steps should refactor this prototype into the layered architecture described below.

## 6. Target Logical Components

### 6.1 Client Applications

Supported clients over time:

- Streamlit prototype.
- Web application.
- Mobile application.
- Conversational assistant.
- Admin/review interface.

The clients should call backend APIs instead of directly reading documents or running parsers once the product moves beyond prototype stage.

### 6.2 API Backend

Recommended future backend:

- Python FastAPI.
- REST APIs initially.
- WebSocket or server-sent events for long-running processing status later.

Responsibilities:

- Authentication and authorization.
- User and household management.
- Document upload and metadata APIs.
- Manual entry APIs.
- Dashboard query APIs.
- Recommendation APIs.
- Review workflow APIs.
- Assistant APIs.

### 6.3 Ingestion Service

Responsibilities:

- Fetch documents from Gmail.
- Accept manual uploads.
- Accept manual entries.
- Receive future API payloads.
- Deduplicate source items.
- Store raw files and source metadata.
- Create processing jobs.

Ingestion adapters:

```text
ingestion/
  gmail/
  upload/
  manual_entry/
  account_aggregator/
  provider_api/
  mobile_scan/
```

Each adapter should emit a common `IngestedItem`.

### 6.4 Document Store

The document store keeps original files and extracted artifacts.

Prototype:

- Local filesystem under ignored `data/`.

Product-ready:

- Object storage such as S3-compatible storage.
- Encryption at rest.
- Object-level metadata.
- Access scoped by user/household.

Stored artifacts:

- Original PDF or file.
- Decrypted transient copy only if explicitly allowed.
- Extracted text.
- Extracted tables.
- Page images when OCR is needed.
- Parser/LLM output JSON.
- Validation reports.

### 6.5 Processing Queue and Workers

Document processing can be slow, so it should run asynchronously.

Prototype:

- Synchronous Streamlit processing.

Product-ready:

- Redis Queue, Celery, Dramatiq, or equivalent.
- Worker processes for extraction and enrichment.
- Job status tracking.

Processing job states:

- Queued.
- Running.
- Waiting for password.
- Waiting for review.
- Completed.
- Failed.
- Superseded.

### 6.6 Document Intelligence Service

This is the core document pipeline.

Responsibilities:

1. Open and decrypt the file if needed.
2. Extract text and tables.
3. Classify document type.
4. Identify institution/provider.
5. Select parser or extraction strategy.
6. Run deterministic parser if available.
7. Run LLM extraction if needed.
8. Validate and normalize extracted data.
9. Store source references and confidence.
10. Create review tasks for uncertain values.

Suggested package structure:

```text
src/wealth_platform/
  ingestion/
  documents/
    extractors/
    classifiers/
    parsers/
    llm/
    validators/
  financial_model/
  wealth_engine/
  recommendations/
  api/
  ui/
```

### 6.7 Parser Registry

Parsers should be plugins selected by document metadata.

Parser interface:

```text
ParserInput
  - document_id
  - document_type
  - provider
  - text
  - tables
  - metadata

ParserOutput
  - extracted_records
  - confidence
  - source_references
  - warnings
  - review_items
```

Parser registry examples:

```text
parsers/
  nps/
    protean_statement.py
    cra_statement.py
  mutual_funds/
    cams_cas.py
    kfintech_cas.py
  epf/
    passbook.py
  banks/
    hdfc_statement.py
    icici_statement.py
    sbi_statement.py
  credit_cards/
  insurance/
  property/
```

Selection strategy:

1. Document type.
2. Provider/institution.
3. Statement version or detected layout.
4. Confidence score from classifier.
5. LLM fallback if no deterministic parser is reliable.

### 6.8 LLM Extraction Service

The LLM service handles variable documents and explanations.

Responsibilities:

- Classify unknown documents.
- Extract structured records into predefined schemas.
- Explain insights in plain language.
- Generate recommendation narratives.
- Support conversational queries over user-approved data.

Hard boundaries:

- LLM output must be schema validated.
- LLM output should not directly update confirmed records.
- LLM must preserve source references where possible.
- Low-confidence values require review.
- Prompts must avoid sending unnecessary sensitive data.
- The system must record model, prompt version, schema version, and extraction run metadata.

LLM extraction flow:

```text
Document text/tables
      |
      v
Document classifier
      |
      v
Schema selection
      |
      v
LLM structured extraction
      |
      v
Schema validation
      |
      v
Business validation
      |
      v
Review or canonical record creation
```

### 6.9 Canonical Financial Model

All extracted data should map to canonical financial entities.

Core entities:

```text
User
Household
HouseholdMember
Institution
Account
Document
SourceReference
ExtractionRun
FinancialRecord
Asset
Liability
Holding
Transaction
Valuation
InsurancePolicy
PremiumSchedule
CreditCard
RewardProgram
Offer
Property
Goal
Alert
Recommendation
ReviewTask
```

Important model concepts:

- `Document` is the raw source.
- `ExtractionRun` records how data was extracted.
- `SourceReference` links values to document pages, text spans, or API fields.
- `FinancialRecord` is a base concept for extracted facts.
- Domain objects such as `Asset`, `Holding`, and `InsurancePolicy` represent normalized truth.
- `ReviewTask` handles uncertain or conflicting values.

### 6.10 Wealth Engine

The wealth engine calculates derived financial views.

Responsibilities:

- Total assets.
- Total liabilities.
- Net worth.
- Asset allocation.
- Liquid vs illiquid split.
- Insurance adequacy indicators.
- Debt burden.
- Goal progress.
- Net worth history.
- Data freshness and completeness.

The wealth engine should consume canonical records only, not raw parser outputs.

### 6.11 Recommendation Engine

The recommendation engine produces prioritized actions.

Recommended design:

- Rule-based engine first.
- LLM-generated explanation layer second.
- ML/personalization later if useful.

Recommendation inputs:

- Canonical records.
- Goals.
- User preferences.
- Dates and due dates.
- Offer expiry.
- Data freshness.
- Portfolio allocation.
- Insurance coverage.
- Liabilities.

Recommendation output:

```text
Recommendation
  - title
  - category
  - priority
  - reason
  - supporting_data
  - source_references
  - confidence
  - suggested_action
  - due_date
  - status
```

Example categories:

- Pay now.
- Review now.
- Expiring soon.
- Save money.
- Reduce risk.
- Improve returns.
- Complete missing data.
- Family readiness.

### 6.12 Review Workflow

Review is required when:

- Parser confidence is low.
- LLM confidence is low.
- Data conflicts with an existing confirmed record.
- A value is unusually large or small.
- Required fields are missing.
- The document type is unknown.

Review states:

- Needs review.
- Confirmed.
- Corrected.
- Rejected.
- Ignored.

The user should see:

- Extracted value.
- Source document.
- Page/text reference when available.
- Confidence.
- Reason for review.
- Suggested correction field.

## 7. Data Flow Details

### 7.1 Gmail PDF Flow

```text
User configures Gmail sender
      |
      v
Gmail ingestion adapter searches messages
      |
      v
PDF attachments downloaded
      |
      v
Document records created
      |
      v
Processing jobs queued
      |
      v
Password requested if needed
      |
      v
Text/table extraction
      |
      v
Classification and parser selection
      |
      v
Records extracted and validated
      |
      v
Dashboard and recommendations update
```

### 7.2 Manual Upload Flow

```text
User uploads document
      |
      v
Document stored
      |
      v
Metadata captured
      |
      v
Processing job queued
      |
      v
Extraction and validation
      |
      v
Review if needed
      |
      v
Canonical financial records created
```

### 7.3 Manual Asset Entry Flow

```text
User enters asset/liability/policy
      |
      v
Input validated
      |
      v
Manual source reference created
      |
      v
Canonical record created
      |
      v
Dashboard recalculated
```

## 8. Storage Architecture

### 8.1 Prototype Storage

Initial local storage can use:

- Local files for PDFs.
- SQLite for structured records.
- Local `.env` for configuration.
- Local token files for OAuth.

This is acceptable for single-user development.

### 8.2 Product Storage

Product-ready storage should use:

- PostgreSQL for structured data.
- Object storage for documents.
- Redis or equivalent for queues and cache.
- Optional vector store for document search and assistant context.
- Secrets manager for credentials and encryption keys.

### 8.3 Database Boundaries

Suggested schemas:

```text
identity
  users
  households
  memberships

sources
  connections
  documents
  source_references
  extraction_runs
  review_tasks

finance
  institutions
  accounts
  assets
  liabilities
  holdings
  transactions
  valuations
  insurance_policies
  premium_schedules
  credit_cards
  reward_programs
  offers
  properties
  goals

insights
  alerts
  recommendations
  recommendation_feedback

audit
  access_logs
  processing_logs
```

## 9. Security Architecture

### 9.1 Sensitive Data

Sensitive data includes:

- Financial documents.
- OAuth tokens.
- Document passwords.
- Account identifiers.
- Policy numbers.
- PRAN, PAN, bank account numbers, and similar identifiers.
- Family and nominee information.

### 9.2 Security Requirements

- Encrypt documents and sensitive database fields at rest.
- Use HTTPS for all network traffic.
- Store OAuth tokens in a secrets store or encrypted database fields.
- Never log document passwords or raw secrets.
- Avoid storing PDF passwords unless the user explicitly opts in.
- Support user data export and deletion.
- Maintain audit logs for document access and sharing.
- Apply least-privilege scopes for integrations.

### 9.3 Family Sharing Security

Family features require explicit permissions:

- Owner.
- Co-owner.
- Read-only member.
- Emergency access member.
- Child education view.
- Advisor view.

Each role should have scoped access by record type and document sensitivity.

## 10. Privacy and LLM Data Handling

LLM usage must be privacy-aware.

Rules:

- Send the minimum required context.
- Prefer structured snippets over full documents.
- Redact unnecessary identifiers where possible.
- Store prompt and model metadata for auditability.
- Do not use user data for model training unless explicitly opted in.
- Allow users to disable cloud LLM processing where possible.
- Consider local or private model deployment for sensitive commercial versions.

LLM responses should be treated as proposed extraction or explanation, not final truth.

## 11. API Surface

Initial future API groups:

```text
/auth
/households
/documents
/ingestion
/extraction-runs
/review-tasks
/accounts
/assets
/liabilities
/holdings
/insurance
/credit-cards
/offers
/properties
/goals
/dashboard
/recommendations
/assistant
```

Example responsibilities:

- `POST /documents`: upload document.
- `POST /ingestion/gmail/fetch`: fetch Gmail attachments.
- `GET /extraction-runs/{id}`: check processing status.
- `POST /review-tasks/{id}/confirm`: confirm extracted value.
- `GET /dashboard/net-worth`: fetch net worth summary.
- `GET /recommendations/today`: fetch today's action list.

## 12. Frontend Architecture

### 12.1 Prototype UI

Streamlit remains useful for:

- Fast parser validation.
- Internal dashboard iteration.
- Manual upload testing.
- Early feedback.

### 12.2 Product Web UI

A future web frontend should separate pages by mental model:

- Home / Today.
- Net Worth.
- Investments.
- Insurance.
- Loans.
- Credit Cards and Offers.
- Property.
- Goals.
- Documents.
- Family Vault.
- Review Center.
- Assistant.

### 12.3 Mobile App

Mobile should focus on:

- Daily action center.
- Notifications.
- Document scan/upload.
- Offer expiry alerts.
- Premium and bill reminders.
- Quick net worth view.
- Family/emergency access.

Mobile clients should use the same backend APIs as the web app.

## 13. Observability and Auditability

The system should track:

- Ingestion attempts.
- Processing job duration.
- Parser selected.
- Extraction confidence.
- Validation errors.
- Review outcomes.
- Recommendation generation.
- User feedback on recommendations.
- Document access.

Commercial versions should include admin-safe metrics without exposing sensitive user financial data.

## 14. Testing Strategy

### 14.1 Parser Tests

Each parser should have:

- Representative redacted text fixtures.
- Positive extraction tests.
- Negative tests for non-matching documents.
- Edge cases for missing fields and layout changes.
- Reconciliation tests where values can be cross-checked.

### 14.2 LLM Extraction Tests

LLM extraction should be tested with:

- Schema validation.
- Golden examples.
- Confidence threshold behavior.
- Redaction behavior.
- Regression tests around prompt/schema versions.

### 14.3 Business Logic Tests

Wealth and recommendation engines should have:

- Net worth calculation tests.
- Asset allocation tests.
- Goal gap tests.
- Due-date and expiry tests.
- Duplicate and stale-data tests.

### 14.4 Security Tests

Security testing should cover:

- Secret redaction in logs.
- Unauthorized document access.
- Household role permissions.
- Data deletion behavior.
- OAuth scope validation.

## 15. Evolution Plan

### 15.1 Step 1: Stabilize Local Prototype

- Keep Streamlit app.
- Add SQLite persistence.
- Add document and extraction run records.
- Generalize NPS parser behind a parser interface.
- Add review status for parsed values.

### 15.2 Step 2: Expand Financial Coverage

- Add mutual fund CAS parser.
- Add EPF/PF parser or manual entry.
- Add manual asset/liability forms.
- Add insurance policy manual entry.
- Build first true net worth dashboard.

### 15.3 Step 3: Add LLM Document Intelligence

- Add document classifier.
- Add structured extraction schemas.
- Add LLM extraction fallback.
- Add review workflow for low-confidence output.
- Store extraction provenance.

### 15.4 Step 4: Backend Separation

- Introduce FastAPI backend.
- Move ingestion and parsing out of Streamlit.
- Add background workers.
- Add PostgreSQL.
- Add object storage.

### 15.5 Step 5: Product and Family Features

- Add user and household accounts.
- Add role-based sharing.
- Add family vault.
- Add recommendation engine.
- Add daily action center.

### 15.6 Step 6: Mobile and Commercial Readiness

- Add mobile app.
- Add notifications.
- Add secure cloud deployment.
- Add subscription/account management if commercialized.
- Add compliance, export, deletion, and consent flows.

## 16. Recommended Near-Term Refactor

The next code change should separate the prototype into architecture-aligned modules:

```text
src/wealth_dashboard/
  ingestion/
    gmail.py
    upload.py
  documents/
    pdf_reader.py
    classifier.py
    registry.py
  parsers/
    base.py
    nps.py
  financial_model/
    models.py
  wealth_engine/
    net_worth.py
  ui/
    streamlit_app.py
```

Near-term priorities:

1. Introduce a parser interface and parser registry.
2. Move NPS models into a broader financial model.
3. Add SQLite persistence for documents, extraction runs, and holdings.
4. Add manual asset/liability entry.
5. Add a true net worth calculation across parsed and manual records.
6. Add document review status.

## 17. Key Architecture Decisions

### 17.1 Deterministic parsers plus LLM fallback

Use deterministic parsers for known documents because they are cheaper, faster, more testable, and more predictable. Use LLMs for unknown layouts, classification, extraction fallback, summarization, and natural-language explanation.

### 17.2 Canonical model before dashboard

Dashboards should read from the canonical financial model, not from parser-specific outputs. This avoids rebuilding the dashboard for every new document type.

### 17.3 Local-first prototype, cloud-ready model

The project can remain easy to run locally while using model and service boundaries that later map to a backend, workers, and mobile apps.

### 17.4 Review workflow is a core feature

Review is not an edge case. Financial data accuracy and user trust depend on showing uncertain values clearly and letting users correct them.

## 18. Open Technical Questions

1. Should local-first storage use SQLite plus local files before PostgreSQL?
2. Which LLM provider should be used first, and what privacy settings are required?
3. Should OCR be included early for scanned insurance/property documents?
4. Should family/household modeling be included in the first database schema even if UI comes later?
5. Should mobile be React Native or Flutter?
6. Should account aggregator integration be prioritized over individual provider integrations?
7. How should document passwords be handled: never stored, session-only, or encrypted opt-in storage?

