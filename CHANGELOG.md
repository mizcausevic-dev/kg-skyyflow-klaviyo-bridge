# Changelog

All notable changes to this project are documented here.

## [0.1.0] - 2026-05-28

### Shipped
- Initial public release of **kg-skyyflow-klaviyo-bridge**.
- TypeScript library + CLI that reads an AI Procurement Decision Card v0.2 and a Klaviyo profile export.
- `audit()` cross-references profile fields with `data_vault_targets[].fields_authorized`, surfaces unauthorized PII still riding on profiles, missing reveal roles, and missing audit URIs.
- `tokenize()` emits a vaulted profile export whose authorized fields are replaced by Skyyflow opaque tokens (`skyy_<hex16>`); downstream growth-ops surfaces never see raw PII.
- `detokenize()` gates reveal by `(callerRoles ∩ revealRoles)` and produces a reveal-audit event stream per the Decision Card contract.
- `MockSkyyflowVault` browser-equivalent (`node:crypto` here, `crypto.subtle` in [deal-desk-workspace](https://github.com/mizcausevic-dev/deal-desk-workspace)).
- Coverage threshold: 80% across statements, branches, functions, lines.

### Why this mattered
- Lifecycle marketing pipelines routinely ingest raw PII into vendor systems that operators have limited visibility into.
- The AI Procurement Decision Card v0.2 already declares which fields are authorized for vaulting; this library lets a growth-ops team enforce the same contract at the Klaviyo ingestion seam.
- Same vault contract powers [rag-sentinel](https://github.com/mizcausevic-dev/rag-sentinel) (tokenize-before-index for RAG) and [deal-desk-workspace](https://github.com/mizcausevic-dev/deal-desk-workspace) (RBAC-aware reveal for deal desk); one buyer authorization, three enforcement points.
