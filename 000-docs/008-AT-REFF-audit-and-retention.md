# Audit and Retention Reference — X Bug Triage Plugin

## Audit Event Types (12)

| Event Type | When Logged | Key Details |
|------------|------------|-------------|
| ingest_run_started | Run begins | run_id, accounts, window |
| ingest_run_completed | Run ends | run_id, status, summary |
| source_fetched | API response received | endpoint, filters, count, rate_limit |
| candidate_classified | Post classified | classification, confidence, rationale |
| pii_redaction | PII detected | type detected, field redacted (NEVER raw PII) |
| cluster_created | New cluster formed | cluster_id, signature, family |
| cluster_updated | Cluster modified | cluster_id, change type, before/after |
| cluster_state_changed | State transition | cluster_id, from_state, to_state, reason |
| routing_recommendation | Owner suggested | cluster_id, inputs used, ranked results |
| escalation_triggered | Escalation fired | trigger type, evidence, threshold |
| human_action | Human command | action type (file, dismiss, merge, etc.), details |
| override_created | Override stored | override_type, target, parameters, reason |

## Audit Rules

- Every audit entry includes: event_id (UUID), event_type, timestamp (ISO 8601), run_id, optional cluster_id/post_id, details (JSON)
- PII redaction events NEVER contain the raw PII — only the type and field
- Audit entries are append-only; never modified or deleted before retention expiry
- All 12 event types must be exercised in end-to-end testing

## Retention Policy

| Data Type | Retention |
|-----------|-----------|
| Candidates (redacted text) | 90 days |
| Candidates (hash-only) | 365 days |
| Clusters (while open/filed/monitoring) | Indefinite |
| Clusters (after closed) | 365 days |
| Overrides | Indefinite |
| Suppression rules | Indefinite |
| Issue links | Indefinite |
| Audit logs | 365 days minimum |
| Raw unredacted text | **Never stored** |

## Storage Policies

| Policy | Behavior |
|--------|----------|
| store_redacted | Store text with PII replaced by `[REDACTED:type]` |
| store_hash_only | Store only a hash of the text, discard content |
| do_not_store | Do not persist any form of the text |

## Backup

`scripts/backup.sh` creates a timestamped SQLite backup with SHA-256 checksum verification.

## Cleanup

`scripts/cleanup.sh` runs retention-based purging:
1. Delete candidates older than retention period
2. Delete closed clusters older than retention period
3. Delete audit logs older than retention period
4. Vacuum database after cleanup
