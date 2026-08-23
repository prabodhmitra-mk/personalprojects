# Profile Update Draft - Aug 23, 2026

Source reviewed: uploaded LinkedIn/profile PDF for Prabodh Mitra.

Use this file as the editable source for profile updates. The current draft emphasizes your latest work in AI search, recommendation systems, data platforms, and cloud-native architecture, while leaving a section to add profile-ready bullets from today's work.

## Contact

- Email: prabodh.mitra@gmail.com
- LinkedIn: www.linkedin.com/in/prabodh-mitra
- Location: Bengaluru, Karnataka, India

## Recommended headline

Architect | Data Engineering Lead | AI Search and Recommendations | Big Data | Cloud-Native Platforms | Telco

Alternative shorter version:

Architect | Integration, Big Data, AI Search and Cloud Platforms

## Recommended top skills

1. AI Search and Recommendation Systems
2. Personalization Platform Architecture
3. Big Data Architecture
4. Enterprise Integration and API Architecture
5. Custom Recommendation Engine Architecture
6. Vector Search
7. Delta Lake
8. Kubernetes
9. PostgreSQL and pgvector
10. Redis
11. Kafka
12. Elasticsearch
13. OpenObserve and Observability Platforms
14. MLOps
15. Cloud Data Platforms

## Updated summary

Results-driven technology leader and architect with extensive experience across enterprise integration, data architecture, AI/ML, and cloud-native platforms. I specialize in designing scalable, high-performance systems that support digital transformation, operational efficiency, and measurable business outcomes across telecom, finance, media, aviation, and retail domains.

My recent work focuses on AI-powered data, search, and personalization platforms, including custom recommendation-engine architecture, LLM-assisted content enrichment, external embedding model integration, Delta Lake knowledge bases, cost-efficient analytics pipelines, and open-source observability modernization. After an initial Vespa.ai POC, I shifted focus to building an in-house recommendation engine that can be customized more easily for product and business needs. I have led initiatives covering real-time recommendations such as "More Like This", "You May Like", "Because You Watched", Taste Cluster, trending content, and Shorts recommendations, while also evaluating lower-cost, extensible platforms such as OpenObserve for long-term telemetry retention and trend analysis.

I have also architected an end-to-end personalization platform for a streaming video product, translating viewer watch behavior into personalized content rails served through production APIs. The platform combines Delta Lake data sync, PostgreSQL/pgvector serving, Kubernetes deployment, engagement-aware ML modeling, cache-first recommendation serving, and parental-control-aware governance.

I bring deep expertise in enterprise integration and API architecture, including microservices, event-driven patterns, ESB/SOA, OSB, API gateways, B2B platforms, and secure reusable APIs. I have also led MLOps pipelines, anomaly detection models, predictive analytics, AIOps monitoring, and large-scale observability solutions using platforms such as BigQuery, Vertex AI, Azure Data Explorer, Delta Lake, Kafka, Elasticsearch, OpenObserve, PostgreSQL/pgvector, Spark, and cloud-native storage.

As a technical leader, I partner with business, product, and engineering teams to shape architecture strategy, evaluate platforms, deliver PoCs, optimize infrastructure costs, modernize codebases, and mentor teams. I am especially interested in data-driven products, AI in enterprise systems, scalable cloud architectures, and practical automation that improves reliability and user experience.

## Current role update - MediaKind

### Data Engineering Lead

September 2023 - Present | Bengaluru, Karnataka, India

Lead the design and optimization of scalable data platforms, AI-driven search, recommendation systems, personalization APIs, observability modernization, and cost-efficient analytics strategies for media and subscriber data products. Current focus areas include custom recommendation-engine design after an initial Vespa.ai POC, LLM-assisted ingestion, external embedding models, content enrichment, OpenObserve migration, PostgreSQL/pgvector serving, and personalization features such as "More Like This", "You May Like", "Because You Watched", Taste Cluster, trending content, and Shorts recommendations.

Profile-ready contribution bullets:

- Led implementation of a Delta Lake-based enterprise data platform, centralizing client data, logs, subscriber insights, and operational datasets for efficient storage, processing, and downstream analytics.
- Built AI-powered conversational data solutions using open-source LLMs, Ollama, Duckling, and Delta Lake as a knowledge base to improve access to operational and business insights.
- Designed and evolved search and recommendation capabilities, including an initial Vespa.ai POC followed by a customizable in-house recommendation engine for "You May Like", "More Like This", "Because You Watched", trending content, embeddings, and LLM-driven enrichment.
- Led design and delivery of an end-to-end personalization platform for streaming subscribers, turning watch behavior into production content rails through batch intelligence, PostgreSQL/pgvector serving, cache-first APIs, and Kubernetes-based operations.
- Integrated external embedding models and LLM enrichment into ingestion flows to improve content understanding, metadata quality, similarity matching, and personalization.
- Architected analytics cost optimization strategies using lifecycle policies, tiered storage, cloud transaction efficiency, and dynamic resource allocation.
- Driving migration from Elasticsearch to OpenObserve to reduce observability platform cost, adopt an open-source Rust-based stack, enable easier AI-assisted feature customization, and retain telemetry data for longer-term trend analysis without requiring enterprise licensing.
- Built real-time monitoring and alerting integrations through Teams channels and Zabbix to improve platform stability, visibility, and incident response.
- Led data pipeline and search platform evaluations, including cost-benefit analysis, infrastructure optimization, and technical governance.
- Directed codebase modernization efforts to remove unused and outdated code, reduce technical debt, and improve maintainability and performance.
- Partnered with product, business, and engineering stakeholders to align data strategy with company goals and contribute to RFP responses.

## Featured project - Recommendation Engine | MediaFirst Streaming Platform

Role: Technical Lead / Architect

Executive positioning:

Led design and delivery of an end-to-end personalization platform for a streaming video product, turning viewer watch behavior into personalized content rails such as "Because You Watched", Taste Cluster, and "You May Like". After an initial Vespa.ai POC, helped shape the move toward an in-house recommendation engine that could be customized more easily. Architected a scalable batch-plus-serving model using Delta Lake, PostgreSQL/pgvector, Kubernetes, and cache-first APIs to balance recommendation freshness, parental controls, cost efficiency, and operational resilience.

Resume-ready bullets:

- Owned the personalization platform from data ingestion through ML inference to client-facing APIs, enabling personalized hubs and feed rails for streaming subscribers.
- Defined a cache-first serving architecture with fresh, stale, and on-demand fallback paths, ensuring high availability without blocking batch processing on cache failures.
- Delivered a multi-stage ML pipeline covering Delta Lake watch-history sync, user taste clustering, recommendation generation with diversity, and cold-start popularity fallback.
- Introduced engagement-aware personalization through adaptive history windows for high, medium, and at-risk viewers, reducing unnecessary compute while improving relevance for sparse users.
- Productized taste clustering as a pluggable algorithm framework supporting K-Means, HDBSCAN, graph-based methods, versioned policies, and A/B-ready experimentation modes.
- Embedded compliance and trust controls through configurable parental rating filters and entitlement-aware content caps aligned with catalog maturity codes.
- Operationalized the platform on Azure and Kubernetes using Helm, scheduled CronJobs, a single containerized Python stack, idempotent schema bootstrap, structured logging, and spot-node batch execution for cost efficiency.
- Established clear configuration ownership across product, data science, and DevOps for database policies, Helm tuning, API serving knobs, and future admin API expansion.

Leadership-oriented bullets:

- Translated "personalized home screen" product goals into a durable three-layer architecture: batch intelligence, SQL/vector serving layer, and low-latency API.
- Chose cache-first serving over real-time inference to meet latency and cost targets while preserving on-demand fallback for cache misses and catalog changes.
- Built maturity-rating governance into the recommendation path so personalization could ship without compromising parental controls or catalog policy.
- Designed watermark-based incremental processing and best-effort cache warming so partial failures did not block the core clustering pipeline.
- Partnered with catalog, analytics, and client teams on shared Postgres serving schemas, hub/feed metadata contracts, and Helm-based deployment.

Headline option:

Architected and delivered an ML-powered personalization platform for a streaming TV product, serving personalized content rails at scale via Kubernetes and PostgreSQL vector search.

Skills and keywords:

Personalization, Recommendation Systems, ML Platform Architecture, Vector Search, pgvector, Batch Serving, Cache-First APIs, FastAPI, PostgreSQL, Delta Lake, Kubernetes, Helm, Azure, Content Compliance, Parental Controls, Streaming Media, MLOps, Technical Leadership.

Impact placeholders to fill later:

- Served X personalized feed requests per day with Y ms p95 latency.
- Processed N subscriber profiles per 15-minute batch window.
- Increased rail engagement or click-through by Z%.
- Reduced batch compute cost by X% through incremental clustering and spot-node execution.

## Today's work capture

Add notes here as you complete work today. After each entry, convert it into one of the profile-ready formats below.

| Date | Work completed | Technologies used | Business or technical impact | Profile-ready bullet |
| --- | --- | --- | --- | --- |
| 2026-08-23 | Working on migration from Elasticsearch to OpenObserve for observability and analytics data. | Elasticsearch, OpenObserve, Rust-based observability stack, open-source platform evaluation | Lowers platform cost, avoids enterprise license dependency for longer retention, enables easier AI-assisted feature changes, and keeps more historical data available for trend analysis. | Driving migration from Elasticsearch to OpenObserve to reduce observability cost, extend telemetry retention, support long-term trend analysis, and adopt an open-source Rust-based platform that can be customized more easily with AI-assisted development. |
| 2026-08-23 | Added senior-leadership summary for MediaFirst recommendation engine and personalization platform. | Delta Lake, PostgreSQL, pgvector, Kubernetes, Helm, FastAPI, ML clustering, cache-first APIs | Frames personalization as a platform capability that converts watch behavior into production content rails while balancing freshness, compliance, latency, and operating cost. | Led design and delivery of an end-to-end personalization platform for a streaming product, turning viewer watch behavior into production content rails through batch intelligence, vector serving, cache-first APIs, and Kubernetes operations. |
| 2026-08-23 | Repositioned Vespa.ai as an initial POC and clarified the move to an in-house recommendation engine. | Vespa.ai POC, custom recommendation engine, personalization architecture | Aligns the profile with management's direction to build a customizable recommendation platform instead of relying on an external recommendation product. | Evaluated Vespa.ai through an initial POC and helped shape the pivot toward a customizable in-house recommendation engine aligned with product-specific personalization needs. |

### Prompts to capture today's work

Answer these as work happens:

1. What did you build, design, debug, evaluate, or improve today?
2. Which technologies, platforms, or architecture patterns were involved?
3. Was the work related to AI search, recommendations, LLMs, embeddings, data pipelines, cloud cost, monitoring, modernization, integration, or leadership?
4. What changed because of the work: cost, latency, relevance, quality, reliability, maintainability, automation, team productivity, or business decision-making?
5. Can the result be quantified with scale, volume, performance, cost, reliability, or delivery impact?

### Bullet formats for today's work

Use these formats to turn daily work into profile updates:

- Designed and implemented [system/capability] using [technology] to improve [business or technical outcome].
- Optimized [pipeline/platform/component] by [approach], reducing [cost/latency/manual effort/technical debt] and improving [result].
- Evaluated [technology/platform/architecture] for [use case], producing [decision/recommendation/PoC] to guide [team/product/business outcome].
- Integrated [model/tool/platform] into [workflow] to enhance [search relevance/recommendations/metadata quality/analytics/monitoring].
- Led cross-functional alignment across [teams/stakeholders] to deliver [initiative] and support [business goal].

## Experience sections to keep current

### HARMAN Connected Services

Senior Architect - Product Development | November 2018 - November 2023

Positioning: Technical Architect for data, AI, big data, and cloud-native platforms. Preserve the existing project highlights around DDO, B2BCMP, Eagle Eye, MediaFirst Pipe Team, and DMAT, with emphasis on MLOps, anomaly detection, microservices, CDC, secure API architecture, Spark, Kafka, ELK, Hortonworks, HBase, Hive, and Elasticsearch.

### Torry Harris Business Solutions

Technologist / Associate Technologist / Technical Lead | April 2015 - November 2018

Positioning: Integration architect for enterprise API platforms and digital transformation. Preserve highlights around SBI Card SPInE, Airtel Butterfly, Airtel Service Factory, API governance, WhatsApp/UIDAI/Alexa integrations, DevOps automation, eTOM, and TM Forum SID.

### Earlier roles

- Oracle - Principal Consultant
- Wipro Technologies - Technical Leader
- Dell - Sr. EA Analyst
- Wipro Technologies - Sr. Project Engineer

Positioning: Enterprise integration, SOA, OSB, telecom OSS/BSS, Oracle middleware, Java, WebLogic, and high-availability architecture.

## Certifications

- Machine Learning
- Vector Databases: An Introduction with Chroma DB
- Fundamentals of MCP
- DS C18 PGC

## Awards

- Feather in my cap
- Star of Service Factory
- Leading By Example
- Certificate of spot excellence
- Circle of Excellence - DTS Smart Infrastructure

## Education

- International Institute of Information Technology Bangalore - Post Graduate Certificate, Foundations of Data Science, 2020
- Delhi College of Engineering - Bachelor of Engineering, Electrical, 2001-2005
- Lovely Public School, 1988-2000

