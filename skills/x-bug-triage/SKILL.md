---
name: x-bug-triage
description: |
  Analyzes public X/Twitter complaints to detect, cluster, and triage bugs with
  repo evidence and owner routing. Use when monitoring product health from social
  signals. Trigger with "/x-bug-triage" or "triage X bugs for @account".
  Make sure to use this skill whenever triaging bugs from X/Twitter mentions.
allowed-tools: "Read,Write,Edit,Glob,Grep,Bash(bun:*)"
version: 0.2.0
author: Jeremy Longshore <jeremy@intentsolutions.io>
license: SEE LICENSE IN LICENSE
user-invocable: true
argument-hint: "<account> [--window 24h]"
model: inherit
compatible-with: claude-code
tags: [triage, x-api, bug-tracking, social-monitoring]
---

# X Bug Triage

Closed-loop bug triage from public X/Twitter complaints to clustered, evidence-backed GitHub issues.

## Overview

Product teams learn about bugs from X/Twitter hours before internal monitoring catches them. This skill automates the pipeline: ingest complaints, classify and cluster them by bug family, scan repos for corroborating evidence, route to owners, and file issues — all with human confirmation gates. Runs in the terminal with optional Slack delivery for team review.

## Prerequisites

- X API bearer token configured at `~/.claude/channels/x-triage/.env`
- SQLite database initialized (`bun run db:migrate`)
- `config/approved-accounts.json` and `config/approved-searches.json` populated
- GitHub CLI (`gh`) for issue filing

## Instructions

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

- New matches: create cluster with initial severity "low"
- Existing matches: update report_count, last_seen, sub_status
- Resolved matches: set state to "open", sub_status to "regression_reopened"
- Suppressed candidates: skip with audit log

### Step 5: Repo Scan

For each cluster (top 3 repos per cluster):
- `mcp__triage__search_issues` — Match symptoms/errors
- `mcp__triage__inspect_recent_commits` — 7-day commit window
- `mcp__triage__inspect_code_paths` — Affected paths
- `mcp__triage__check_recent_deploys` — Recent releases

Assign evidence tiers (1-4) per [evidence-policy.md](evidence-policy.md).

### Step 6: Route Ownership

For each cluster, use strict 6-level precedence per [routing-rules.md](routing-rules.md):
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

### Step 9: Optional Slack Delivery

Check if `claude-code-slack-channel` plugin is available via `mcp__slack__reply` tool. If available, also deliver summary to Slack. If not, skip — terminal output is sufficient. Not an error.

### Step 10: Interactive Review

Accept review commands from the user in the terminal. Parse via `mcp__triage__parse_review_command`.

| Command | Action |
|---------|--------|
| `details <#>` | Display full cluster detail |
| `file <#>` | Generate draft via `mcp__triage__create_draft_issue` |
| `dismiss <#> <reason>` | Create noise_suppression override |
| `merge <#> <issue>` | Link cluster to existing issue |
| `escalate <#>` | Raise severity |
| `monitor <#>` | Set cluster to monitoring |
| `snooze <#> <duration>` | Temporarily suppress |
| `split <#>` | Split cluster |
| `reroute <#>` | Change routing |
| `full-report` | Display all clusters |
| `confirm file <#>` | File via `mcp__triage__confirm_and_file` |

### Step 11: Persist Learning

- All overrides stored in DB for future runs
- Audit log captures all actions (12 event types)
- Suppression rules created from dismiss commands
- Issue-family links created from file/merge commands

## Output

Terminal markdown summary with severity-ranked clusters, evidence tiers, team assignments, and interactive command menu. Optionally mirrored to Slack.

## Examples

### Basic triage run

```
/x-bug-triage @AnthropicAI --window 24h
```

Produces cluster summary, then user interacts:
```
> details 1
> file 2
> dismiss 3 noise
> confirm file 2
```

### Review a specific cluster

```
> details 1
```

Shows family, surface, feature area, evidence by tier, representative posts, routing recommendation.

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| X_BEARER_TOKEN not set | Missing env config | Create `~/.claude/channels/x-triage/.env` |
| Rate limited (429) | X API quota exhausted | Automatic retry with backoff, degrades gracefully |
| No clusters found | No bug-like posts in window | Widen `--window` or check `approved-searches.json` |
| Routing uncertain | No routing signals | Manual assignment required — flagged in output |
| Duplicate detected | Issue already filed | Use `merge` command instead of `file` |

## Resources

- [schemas.md](schemas.md) — Data model reference
- [routing-rules.md](routing-rules.md) — 6-level routing precedence
- [escalation-rules.md](escalation-rules.md) — 6 escalation triggers
- [evidence-policy.md](evidence-policy.md) — 4-tier evidence hierarchy
- [review-memory-policy.md](review-memory-policy.md) — Override types and application order
