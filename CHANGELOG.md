# Changelog

All notable changes to this project are documented here.

## [0.2.0] - 2026-05-28

### Added
- **Per-field protection levels** (`none` | `masked` | `tokenized`). `none` passes the raw value through with type coercion; `masked` applies a field-shape-aware mask (email, phone, generic); `tokenized` goes through the Skyyflow vault as in v0.1.
- **Raw → Klaviyo field mapping** via a new `BridgeConfig` document (`fields[].rawField` → `fields[].klaviyoField` with per-field `protection` and optional `dataType`). Bridge config is implementation detail; the Decision Card still gates which fields may be vaulted.
- **`transform()` pipeline** — takes a raw webhook payload, bridge config, Decision Card, and vault; emits a Klaviyo-ready payload plus a complete `SyncLog` with per-field outcomes (`passed-through`, `masked`, `tokenized`, `unauthorized-tokenization`, `field-missing-on-payload`, `field-inactive`).
- **Masking strategies** for email, phone, and generic strings (`maskEmail`, `maskPhone`, `maskGeneric`, `maskField`).
- **CLI `transform` subcommand** — `kg-skyyflow-klaviyo transform <payload.json> --bridge-config <cfg.json> --decision-card <card.json> --event-name <name>`.
- **Webhook payload templates fixture** (`order_placed`, `checkout_started`, `new_subscriber`) and a `demo:transform` npm script that runs all three through the pipeline.
- **Bridge config fixture** demonstrating the mixed protection-level pattern.

### Changed
- `data_vault_targets[].fields_authorized` in the sample Decision Card now also lists `phone` (raw webhook field name) to keep the demo end-to-end with the bridge config.

### Why this mattered
- Lifecycle marketing pipelines need three protection strategies in practice — not every PII field needs full vault tokenization; some only need a display-safe mask, some pass through entirely. v0.1 only supported `tokenized`.
- The Decision Card already declared field authorization; v0.2 lets the operator declare per-field strategy without spec-level changes.
- The new `SyncLog` model is rich enough to drive an operator console (see related: companion visual surface in flight).

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
