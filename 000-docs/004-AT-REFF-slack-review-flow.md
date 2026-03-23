# Slack Review Flow Reference — X Bug Triage Plugin

## Two-Way Bridge Architecture

The `claude-code-slack-channel` bridge is a bidirectional channel:

```
User types in Slack thread
  → Bridge forwards message to Claude as inbound text
  → Claude's SKILL.md orchestration parses the command
  → Claude calls slack-notification-server to format response
  → Claude calls bridge's `reply` tool with formatted mrkdwn
  → User sees response in Slack thread
```

**Key distinction:** The `slack-notification-server` MCP is a formatting-only layer. It produces Slack mrkdwn strings. It does NOT connect to Slack. All transport goes through the bridge.

## Initial Summary Format

```
🔍 X Bug Triage — Run {date} {time} UTC
   Account: @{account} · Window: last {window} · {count} posts ingested

━━━ {n} clusters ({new} new, {existing} existing) ━━━

{severity_icon} {#} · {bug_signature}
     {report_count} reports · {severity} severity · {status_note}
     Owner: {team}
     Top evidence: {highest_tier_description} (Tier {n})

━━━ Commands ━━━
details <#>  ·  file <#>  ·  dismiss <#>  ·  merge <#> <issue>
escalate <#>  ·  monitor <#>  ·  snooze <#> <duration>
split <#>  ·  reroute <#>  ·  full-report
```

- Max 20 lines for ≤5 clusters
- Top 5 by severity for 6+ clusters, then "N more — reply `full-report`"

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
| `escalate <#>` | Escalate to higher severity channel |
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

## Thread State

Each Slack thread tracks:
- Which clusters have been acted on
- Which clusters are still pending
- Actions taken (with timestamps)
- 24h idle → reminder of unresolved clusters

## Formatting Rules

- Severity icons: 🔴 critical/high, 🟡 medium, 🟢 low
- Initial summary: highest evidence tier only, team only
- Detail view: all tiers, ranked assignees, full rationale
- 3 representative posts per cluster (by quality, distinctness, recency)
- >50 reports: show count + top 3 only
- Tone: concise, factual, no hype, no exclamation marks

## Degradation

- Slack API error → retry 3x with backoff, then save to `data/reports/` as JSON
- Channel not found → alert via fallback channel or log
- Message too long → truncate to top 5 by severity, link to full report
