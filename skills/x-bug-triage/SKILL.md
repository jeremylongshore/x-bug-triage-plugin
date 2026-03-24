---
name: x-bug-triage
description: |
  Run X bug triage workflow. Use when user says "triage X bugs",
  "run bug triage", "x bug triage", or "check X for bugs".
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
version: 0.2.0
author: Jeremy Longshore <jeremy@intentsolutions.io>
license: SEE LICENSE IN LICENSE
user-invocable: true
argument-hint: "<account> [--window 24h]"
tags: [triage, x-api, bug-tracking]
---

# X Bug Triage — Orchestration Playbook

Run an end-to-end triage cycle for public X/Twitter complaints.

## Arguments

- `<account>` — X account to triage (e.g., `@TestProduct`)
- `--window` — Lookback window (default: `24h`)

## 11-Step Workflow

### Step 1: Intake

1. Resolve account username to ID: `mcp__triage__resolve_username`
2. Fetch mention timeline: `mcp__triage__fetch_mentions`
3. Run approved searches: `mcp__triage__search_recent`
4. Cross-reference mentions with search results for completeness
5. Hydrate conversation threads for posts with conversation_id: `mcp__triage__fetch_conversation`
6. Fetch quote tweets for high-engagement posts: `mcp__triage__fetch_quote_tweets`

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
- For each candidate, compute bug signature and match against existing clusters at >=70% overlap
- Family-first guard: different families NEVER cluster

### Step 4: Create/Update Clusters

- New matches -> create cluster with initial severity "low"
- Existing matches -> update report_count, last_seen, sub_status
- Resolved matches -> set state to "open", sub_status to "regression_reopened"
- Suppressed candidates -> skip with audit log

### Step 5: Repo Scan

For each cluster (top 3 repos per cluster):
- `mcp__triage__search_issues` — Match symptoms/errors
- `mcp__triage__inspect_recent_commits` — 7-day commit window
- `mcp__triage__inspect_code_paths` — Affected paths
- `mcp__triage__check_recent_deploys` — Recent releases

Assign evidence tiers (1-4) per evidence policy.

### Step 6: Route Ownership

For each cluster, use strict 6-level precedence:
1. `mcp__triage__lookup_service_owner`
2. `mcp__triage__lookup_oncall`
3. `mcp__triage__parse_codeowners`
4. `mcp__triage__lookup_recent_assignees`
5. `mcp__triage__lookup_recent_committers`
6. Fallback mapping from config

Apply routing overrides from prior runs. Flag stale signals (>30 days).

### Step 7: Evaluate Severity + Escalation

Compute severity (low/medium/high/critical) based on:
- Report velocity, data loss signals, security/privacy, auth/billing lockout
- Cross-surface failure, enterprise impact, reproducibility quality
- Apply severity overrides from prior runs

Check escalation triggers (6 from `config/severity-thresholds.json`).

### Step 8: Display Results

Display triage results directly in the terminal as formatted markdown:
- Severity icons: red_circle critical/high, yellow_circle medium, green_circle low
- Top 5 clusters by severity (or all if <=5)
- Per cluster: report count, severity, status, assigned team, top evidence tier
- Available commands listed at the bottom

Format:
```
X Bug Triage — Run {date} {time} UTC
Account: @{account} · Window: last {window} · {count} posts ingested

--- {n} clusters ({new} new, {existing} existing) ---

{icon} {#} · {bug_signature}
     {report_count} reports · {severity} severity · {status_note}
     Owner: {team}
     Top evidence: {description} (Tier {n})

--- Commands ---
details <#>  ·  file <#>  ·  dismiss <#>  ·  merge <#> <issue>
escalate <#>  ·  monitor <#>  ·  snooze <#> <duration>
split <#>  ·  reroute <#>  ·  full-report
```

### Step 9: Optional Slack Delivery

Check if the `claude-code-slack-channel` plugin is available by testing for the `mcp__slack__reply` tool. If available, ALSO deliver the triage summary to the configured Slack channel for team review. If not available, skip — terminal output from Step 8 is the primary interface. This is not an error condition.

If Slack delivery fails, save to `data/reports/` as JSON fallback.

### Step 10: Interactive Review

Accept review commands directly from the user in the terminal. Parse commands via `mcp__triage__parse_review_command`.

When the Slack plugin is connected, also accept commands from Slack inbound messages.

Handle all 11 commands:

| Command | Action |
|---------|--------|
| `details <#>` | Display full cluster detail (family, evidence, posts, routing) |
| `file <#>` | Generate draft via `mcp__triage__create_draft_issue`, display for review |
| `dismiss <#> <reason>` | Create noise_suppression override, update cluster state |
| `merge <#> <issue>` | Create issue_family_link override, insert issue_link |
| `escalate <#>` | Raise severity, display escalation alert |
| `monitor <#>` | Set cluster state to monitoring |
| `snooze <#> <duration>` | Create snooze override with expiry |
| `split <#>` | Create cluster_split override |
| `reroute <#>` | Create routing_override |
| `full-report` | Display all clusters |
| `confirm file <#>` | File via `mcp__triage__confirm_and_file`, create issue_link |

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
