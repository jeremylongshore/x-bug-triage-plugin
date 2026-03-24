# Optional Team Review Flow — X Bug Triage Plugin

## Overview

The primary interface is the Claude Code terminal. Users run `/x-bug-triage`, see results, and type review commands directly. No additional setup needed.

For **team workflows**, the optional `claude-code-slack-channel` plugin adds async Slack delivery so multiple reviewers can triage from a shared channel.

## Terminal-First Flow (Default)

```
User runs /x-bug-triage @account
  → Claude fetches, analyzes, clusters
  → Results displayed as markdown in terminal
  → User types commands: "details 1", "file 2", "dismiss 3 noise"
  → Claude processes command, displays response
  → "confirm file 2" gates all issue creation
```

## Optional Slack Flow (When Plugin Installed)

```
User runs /x-bug-triage @account
  → Results displayed in terminal (same as above)
  → ALSO sent to configured Slack channel via bridge's reply tool
  → Team members can send commands from Slack
  → Claude processes commands from both terminal and Slack
```

**Key distinction:** The triage server's `parse_review_command` tool handles command parsing. Claude formats all output directly as markdown. All Slack transport goes through the separate `claude-code-slack-channel` plugin.

## Summary Format

```
X Bug Triage — Run {date} {time} UTC
   Account: @{account} · Window: last {window} · {count} posts ingested

--- {n} clusters ({new} new, {existing} existing) ---

{severity_icon} {#} · {bug_signature}
     {report_count} reports · {severity} severity · {status_note}
     Owner: {team}
     Top evidence: {highest_tier_description} (Tier {n})

--- Commands ---
details <#>  ·  file <#>  ·  dismiss <#>  ·  merge <#> <issue>
escalate <#>  ·  monitor <#>  ·  snooze <#> <duration>
split <#>  ·  reroute <#>  ·  full-report
```

- Max 20 lines for <=5 clusters
- Top 5 by severity for 6+ clusters, then "N more — type `full-report`"

## Detail View

Full cluster detail includes:
- Family, surface, feature area
- Report count, confidence
- Severity + rationale (always show why for high/critical)
- Status and time range
- Evidence by tier (all tiers shown)
- 3 representative posts (highest quality, most distinct, most recent)
- Repo evidence summary
- Routing with ranked assignees
- Available actions

## 11 Review Commands

| Command | Action |
|---------|--------|
| `details <#>` | Show full cluster detail |
| `file <#>` | Generate issue draft for review |
| `dismiss <#> <reason>` | Suppress cluster with reason |
| `merge <#> <issue>` | Link cluster to existing issue |
| `escalate <#>` | Escalate to higher severity |
| `monitor <#>` | Set cluster to monitoring state |
| `snooze <#> <duration>` | Temporarily suppress (e.g., `snooze 3 24h`) |
| `split <#>` | Split cluster into sub-clusters |
| `reroute <#>` | Change routing recommendation |
| `full-report` | Show all clusters |
| `confirm file <#>` | Actually file the issue (after reviewing draft) |

## Error Handling

| Situation | Response |
|-----------|----------|
| Missing cluster number | "Which cluster?" |
| Invalid number | "No cluster N. Available: 1, 2, 3" |
| Unrecognized command | "Available commands: ..." |
| Already filed | "Cluster N was already filed as ISSUE-XXX. Want to update instead?" |

## Formatting Rules

- Severity icons: red_circle critical/high, yellow_circle medium, green_circle low
- Initial summary: highest evidence tier only, team only
- Detail view: all tiers, ranked assignees, full rationale
- 3 representative posts per cluster (by quality, distinctness, recency)
- >50 reports: show count + top 3 only
- Tone: concise, factual, no hype, no exclamation marks

## Degradation (Slack Only)

- Slack plugin not installed → terminal-only, not an error
- Slack API error → retry 3x with backoff, then save to `data/reports/` as JSON
- Channel not found → alert via fallback channel or log
- Message too long → truncate to top 5 by severity, link to full report
