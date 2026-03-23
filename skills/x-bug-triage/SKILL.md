---
name: x-bug-triage
description: |
  Run X bug triage workflow. Use when user says "triage X bugs",
  "run bug triage", "x bug triage", or "check X for bugs".
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
version: 0.1.0
author: Jeremy Longshore <jeremy@intentsolutions.io>
license: SEE LICENSE IN LICENSE
user-invocable: true
argument-hint: "<account> [--window 24h]"
tags: [triage, x-api, bug-tracking, slack]
---

# X Bug Triage — Orchestration Playbook

Run an end-to-end triage cycle for public X/Twitter complaints.

## Arguments

- `<account>` — X account to triage (e.g., `@TestProduct`)
- `--window` — Lookback window (default: `24h`)

## 11-Step Workflow

### Step 1: Intake

1. Resolve account username to ID: `mcp__x-intake__resolve_username`
2. Fetch mention timeline: `mcp__x-intake__fetch_mentions`
3. Run approved searches: `mcp__x-intake__search_recent`
4. Cross-reference mentions with search results for completeness
5. Hydrate conversation threads for posts with conversation_id: `mcp__x-intake__fetch_conversation`
6. Fetch quote tweets for high-engagement posts: `mcp__x-intake__fetch_quote_tweets`

### Step 2: Normalize

For each ingested post:
- Parse into BugCandidate (all 33 fields) using `lib/parser.ts`
- Classify into 12 categories using `lib/classifier.ts`
- Redact PII (6 types) using `lib/redactor.ts`
- Score reporter reliability (4 dimensions) using `lib/reporter-scorer.ts`
- Tag reporter_category from `config/approved-accounts.json`

### Step 3: Match Existing Clusters

- Load active clusters from DB
- Load active overrides and suppression rules
- For each candidate, compute bug signature and match against existing clusters at ≥70% overlap
- Family-first guard: different families NEVER cluster

### Step 4: Create/Update Clusters

- New matches → create cluster with initial severity "low"
- Existing matches → update report_count, last_seen, sub_status
- Resolved matches → set state to "open", sub_status to "regression_reopened"
- Suppressed candidates → skip with audit log

### Step 5: Repo Scan

For each cluster (top 3 repos per cluster):
- `mcp__repo-analysis__search_issues` — Match symptoms/errors
- `mcp__repo-analysis__inspect_recent_commits` — 7-day commit window
- `mcp__repo-analysis__inspect_code_paths` — Affected paths
- `mcp__repo-analysis__check_recent_deploys` — Recent releases

Assign evidence tiers (1-4) per evidence policy.

### Step 6: Route Ownership

For each cluster, use strict 6-level precedence:
1. `mcp__internal-routing__lookup_service_owner`
2. `mcp__internal-routing__lookup_oncall`
3. `mcp__internal-routing__parse_codeowners`
4. `mcp__internal-routing__lookup_recent_assignees`
5. `mcp__internal-routing__lookup_recent_committers`
6. Fallback mapping from config

Apply routing overrides from prior runs. Flag stale signals (>30 days).

### Step 7: Evaluate Severity + Escalation

Compute severity (low/medium/high/critical) based on:
- Report velocity, data loss signals, security/privacy, auth/billing lockout
- Cross-surface failure, enterprise impact, reproducibility quality
- Apply severity overrides from prior runs

Check escalation triggers (6 from `config/severity-thresholds.json`).

### Step 8: Summarize

Format clusters for Slack using `mcp__slack-notification__format_triage_summary`:
- Top 5 by severity (or all if ≤5)
- Severity icons, report counts, top evidence tier, team

### Step 9: Deliver to Slack

Send formatted summary via the `claude-code-slack-channel` bridge's `reply` tool.
If Slack delivery fails, save to `data/reports/` as JSON fallback.

### Step 10: Interactive Review

Parse inbound Slack commands via `mcp__slack-notification__parse_review_command`.
Handle all 11 commands:

| Command | Action |
|---------|--------|
| `details <#>` | Format and send cluster detail via `mcp__slack-notification__format_cluster_details` |
| `file <#>` | Generate draft via `mcp__issue-draft__create_draft_issue`, format via `mcp__slack-notification__format_issue_draft` |
| `dismiss <#> <reason>` | Create noise_suppression override, update cluster state |
| `merge <#> <issue>` | Create issue_family_link override, insert issue_link |
| `escalate <#>` | Format escalation via `mcp__slack-notification__format_escalation` |
| `monitor <#>` | Set cluster state to monitoring |
| `snooze <#> <duration>` | Create snooze override with expiry |
| `split <#>` | Create cluster_split override |
| `reroute <#>` | Create routing_override |
| `full-report` | Send all clusters |
| `confirm file <#>` | File via `mcp__issue-draft__confirm_and_file`, create issue_link |

### Step 11: Persist Learning

- All overrides stored in DB for future runs
- Audit log captures all actions (12 event types)
- Suppression rules created from dismiss commands
- Issue-family links created from file/merge commands

## References

- [schemas.md](schemas.md) — Data model
- [routing-rules.md](routing-rules.md) — Routing precedence
- [escalation-rules.md](escalation-rules.md) — Escalation triggers
- [evidence-policy.md](evidence-policy.md) — Evidence tiers
- [review-memory-policy.md](review-memory-policy.md) — Override handling
