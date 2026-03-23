# Clustering and Evidence Reference — X Bug Triage Plugin

## Family-First Clustering

Different families NEVER cluster together. Family is derived from classification:

| Family | Classifications |
|--------|----------------|
| product_defect | bug_report, sarcastic_bug_report, account_problem, billing_problem |
| model_quality_defect | model_quality_issue |
| policy_mismatch | policy_or_expectation_mismatch |
| ux_friction | ux_friction |

Classifications that don't cluster: feature_request, user_error_or_confusion, praise, noise, needs_review.

## Signal Layers

### High-Weight Deterministic
- Exact error string overlap
- Linked URL match
- Shared conversation_id
- Same media fingerprint
- Same known issue link

### Medium-Weight Semantic
- Symptom phrase similarity
- Feature-area match
- Surface match
- Repro-hint overlap

### Supporting Temporal
- Same release/deploy/incident window
- Concentrated time burst

## Anti-Clustering Rules

- Different surface → penalty
- Contradictory repro steps → penalty
- Mutually exclusive platform/version → penalty
- Different family → hard block
- Rollout-split evidence → possible_rollout_split flag

## Bug Signatures

`bug_signature = surface + feature_area + normalized_top_error_strings + normalized_top_symptoms`

Matching threshold: ≥70% overlap (configurable via `config/cluster-matching-thresholds.json`).

## Cluster Lifecycle (7 states)

```
open → filed → monitoring → fix_deployed → resolved → closed
                                                       ↓
                                                   suppressed
```

## Sub-Statuses (4)

| Sub-Status | Meaning |
|------------|---------|
| new_evidence | Fresh reports added to existing cluster |
| late_tail | Reports arriving after fix deployed |
| regression_reopened | Resolved cluster receiving fresh matching complaints |
| possible_duplicate | Cluster may overlap with another |

## Evidence Hierarchy (4 tiers)

| Tier | Name | Examples | Use |
|------|------|----------|-----|
| 1 | Exact | Error string match, known issue match, explicit repro, screenshot reuse, same thread | Justifies clustering alone |
| 2 | Strong contextual | Same conversation tree, same surface + repro, suspicious commit, matching deploy window | Strengthens, never substitutes Tier 1 |
| 3 | Moderate | Semantic symptom similarity, similar language, same platform/release window | Supports grouping, not routing |
| 4 | Weak | Generalized complaint language, high-level feature mention, heuristic proximity | Never presented as hard evidence |

## Override Memory (8 types)

All overrides stored in `overrides` table, loaded at run start:

| Type | Effect |
|------|--------|
| cluster_merge | Combine two clusters |
| cluster_split | Divide a cluster |
| noise_suppression | Suppress matching pattern |
| routing_override | Change owner recommendation |
| issue_family_link | Link cluster to issue family |
| severity_override | Change severity assessment |
| label_correction | Fix classification/family |
| snooze | Temporary suppression with expiry |

## Severity Model

**4 buckets:** low, medium, high, critical

**Inputs:** report velocity, data loss signals, security/privacy signals, auth/billing lockout, cross-surface failure, enterprise impact, workflow blocking, reproducibility quality, blast radius.

**Core rule:** Severity computed independently from reporter quality. High consequence outranks high volume. Low-volume-but-high-consequence is a valid high/critical rating.
