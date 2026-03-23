# Data Model Reference — X Bug Triage Plugin

## Tables

### candidates (33 fields)

Primary table for normalized bug candidates parsed from X posts.

| Field | Type | Description |
|-------|------|-------------|
| post_id | TEXT PK | X post ID |
| author_handle | TEXT NOT NULL | @username |
| author_id | TEXT NOT NULL | X user ID |
| timestamp | TEXT NOT NULL | ISO 8601 post time |
| source_type | TEXT NOT NULL | reply, mention, quote_post, search_hit, stream_hit |
| product_surface | TEXT | Detected product surface |
| feature_area | TEXT | Detected feature area |
| symptoms | TEXT | JSON array of symptom descriptions |
| error_strings | TEXT | JSON array of error messages |
| repro_hints | TEXT | JSON array of reproduction steps |
| urls | TEXT | JSON array of referenced URLs |
| has_media | INTEGER NOT NULL | 0 or 1 |
| media_keys | TEXT | JSON array of media key IDs |
| language | TEXT | Detected language |
| conversation_id | TEXT | X conversation thread ID |
| thread_root_id | TEXT | Root post of thread |
| reply_to_id | TEXT | Direct parent post ID |
| referenced_post_ids | TEXT | JSON array of {type, id} |
| public_metrics | TEXT | JSON {like_count, reply_count, retweet_count, quote_count} |
| classification | TEXT NOT NULL | One of 12 categories |
| classification_confidence | REAL NOT NULL | 0.0 to 1.0 |
| classification_rationale | TEXT | Why this classification |
| report_quality_score | REAL | 0.0 to 1.0 |
| independence_score | REAL | 0.0 to 1.0 |
| account_authenticity_score | REAL | 0.0 to 1.0 |
| historical_accuracy_score | REAL | 0.0 to 1.0 |
| reporter_reliability_score | REAL | Composite score |
| reporter_category | TEXT DEFAULT 'public' | public, internal, partner, tester |
| pii_flags | TEXT | JSON array of detected PII types |
| raw_text_redacted | TEXT | Post text with PII replaced |
| raw_text_storage_policy | TEXT DEFAULT 'store_redacted' | store_redacted, store_hash_only, do_not_store |
| triage_run_id | TEXT NOT NULL | FK to triage_runs |

### clusters

| Field | Type | Description |
|-------|------|-------------|
| cluster_id | TEXT PK | UUID |
| bug_signature | TEXT NOT NULL | Stable signature for matching |
| cluster_family | TEXT NOT NULL | product_defect, model_quality_defect, policy_mismatch, ux_friction |
| product_surface | TEXT | Primary surface |
| feature_area | TEXT | Primary feature area |
| title | TEXT | Human-readable summary |
| severity | TEXT NOT NULL | low, medium, high, critical |
| severity_rationale | TEXT | Why this severity |
| state | TEXT NOT NULL DEFAULT 'open' | 7 lifecycle states |
| sub_status | TEXT | new_evidence, late_tail, regression_reopened, possible_duplicate |
| report_count | INTEGER NOT NULL DEFAULT 0 | Total linked candidates |
| first_seen | TEXT NOT NULL | Earliest candidate timestamp |
| last_seen | TEXT NOT NULL | Latest candidate timestamp |
| created_at | TEXT NOT NULL | Cluster creation time |
| updated_at | TEXT NOT NULL | Last modification time |
| triage_run_id | TEXT NOT NULL | Run that created this cluster |

### cluster_posts

Junction table linking candidates to clusters.

| Field | Type | Description |
|-------|------|-------------|
| cluster_id | TEXT NOT NULL | FK to clusters |
| post_id | TEXT NOT NULL | FK to candidates |
| added_at | TEXT NOT NULL | When post was linked |
| added_by_run_id | TEXT NOT NULL | Which run linked it |

### overrides (8 types)

Human corrections that persist across runs.

| Field | Type | Description |
|-------|------|-------------|
| override_id | TEXT PK | UUID |
| override_type | TEXT NOT NULL | cluster_merge, cluster_split, noise_suppression, routing_override, issue_family_link, severity_override, label_correction, snooze |
| target_cluster_id | TEXT | Cluster this applies to |
| parameters | TEXT NOT NULL | JSON — type-specific parameters |
| reason | TEXT NOT NULL | Human-provided reason |
| created_by | TEXT NOT NULL | Who created it |
| created_at | TEXT NOT NULL | When created |
| expires_at | TEXT | For snooze type only |
| active | INTEGER NOT NULL DEFAULT 1 | 0 = revoked |

### suppression_rules

Known noise patterns that auto-dismiss matching candidates.

| Field | Type | Description |
|-------|------|-------------|
| rule_id | TEXT PK | UUID |
| pattern_type | TEXT NOT NULL | How to match (keyword, regex, author, etc.) |
| pattern_value | TEXT NOT NULL | Match pattern |
| reason | TEXT NOT NULL | Why suppressed |
| created_by | TEXT NOT NULL | Who created |
| created_at | TEXT NOT NULL | When created |
| expires_at | TEXT | Optional expiry |
| active | INTEGER NOT NULL DEFAULT 1 | 0 = disabled |

### issue_links

Bidirectional cluster ↔ issue mapping.

| Field | Type | Description |
|-------|------|-------------|
| link_id | TEXT PK | UUID |
| cluster_id | TEXT NOT NULL | FK to clusters |
| issue_url | TEXT NOT NULL | GitHub issue URL |
| issue_number | INTEGER | Issue number |
| repo | TEXT NOT NULL | owner/repo |
| link_type | TEXT NOT NULL | filed, merged, related |
| created_at | TEXT NOT NULL | When linked |

### triage_runs

Metadata for each triage execution.

| Field | Type | Description |
|-------|------|-------------|
| run_id | TEXT PK | UUID |
| started_at | TEXT NOT NULL | Run start time |
| completed_at | TEXT | Run end time |
| status | TEXT NOT NULL | running, completed, partial, failed |
| accounts_ingested | TEXT | JSON array of accounts processed |
| endpoints_summary | TEXT | JSON summary of endpoint status |
| candidates_parsed | INTEGER DEFAULT 0 | Total candidates |
| clusters_created | INTEGER DEFAULT 0 | New clusters |
| clusters_updated | INTEGER DEFAULT 0 | Updated clusters |
| warnings | TEXT | JSON array of warnings |

### audit_log

Complete audit trail for all triage operations.

| Field | Type | Description |
|-------|------|-------------|
| event_id | TEXT PK | UUID |
| event_type | TEXT NOT NULL | One of 12 audit event types |
| timestamp | TEXT NOT NULL | ISO 8601 |
| run_id | TEXT | FK to triage_runs |
| cluster_id | TEXT | Related cluster |
| post_id | TEXT | Related candidate |
| details | TEXT NOT NULL | JSON event-specific data |

## Enums

### Classification (12)
bug_report, sarcastic_bug_report, feature_request, account_problem, billing_problem, policy_or_expectation_mismatch, ux_friction, model_quality_issue, user_error_or_confusion, praise, noise, needs_review

### ClusterFamily (4)
product_defect, model_quality_defect, policy_mismatch, ux_friction

### ClusterState (7)
open, filed, monitoring, fix_deployed, resolved, closed, suppressed

### ClusterSubStatus (4)
new_evidence, late_tail, regression_reopened, possible_duplicate

### Severity (4)
low, medium, high, critical

### EvidenceTier (4)
1 (Exact), 2 (Strong contextual), 3 (Moderate), 4 (Weak)

### OverrideType (8)
cluster_merge, cluster_split, noise_suppression, routing_override, issue_family_link, severity_override, label_correction, snooze

### SourceType (5)
reply, mention, quote_post, search_hit, stream_hit

### StoragePolicy (3)
store_redacted, store_hash_only, do_not_store

### ReporterCategory (4)
public, internal, partner, tester

### AuditEventType (12)
ingest_run_started, ingest_run_completed, source_fetched, candidate_classified, pii_redaction, cluster_created, cluster_updated, cluster_state_changed, routing_recommendation, escalation_triggered, human_action, override_created
