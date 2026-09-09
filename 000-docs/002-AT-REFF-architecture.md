# Architecture Reference — X Bug Triage Plugin

> **Status: target architecture.** The diagram and full data flow below describe the intended system. Today only X intake makes live network requests; local processing libraries are separate, repository/routing/filing MCP handlers are stubs, and Slack delivery is absent. See `skills/x-bug-triage/references/runtime-contract.md` for current behavior.

## System Overview

```
X API v2 → triage-server (19 tools) → Parser/Classifier/Redactor/Scorer
                                              ↓
                                     Clusterer (family-first)
                                              ↓
                                     Repo evidence (Tier 1-4)
                                              ↓
                                     Owner recommendation (6-level)
                                              ↓
                                     Terminal display (markdown)
                                              ↓
                              ┌───── Human review (11 commands) ─────┐
                              │                                       │
                         Terminal input                    Slack input (optional)
                              │                    (via claude-code-slack-channel)
                              ↓
                        Issue draft → confirm gate → GitHub Issues
```

## Component Responsibilities

### MCP Server (1)

| Server | Tool Groups      | Tools | Responsibility                                                |
| ------ | ---------------- | ----- | ------------------------------------------------------------- |
| triage | X Intake         | 6     | X API v2 ingestion with rate limiting, budgeting, degradation |
|        | Repo Analysis    | 4     | GitHub repo scanning for issues, commits, paths, deploys      |
|        | Internal Routing | 5     | Ownership lookup with 6-level precedence cascade              |
|        | Issue Draft      | 3     | Draft generation, confirmation gate, duplicate check          |
|        | Review           | 1     | Deterministic review command parsing                          |

### Shared Library (lib/)

| Module             | Purpose                                           |
| ------------------ | ------------------------------------------------- |
| types.ts           | All TypeScript interfaces and enums               |
| db.ts              | SQLite connection, typed queries, transactions    |
| config.ts          | JSON config loader with validation                |
| audit.ts           | Audit log writer (12 event types)                 |
| parser.ts          | Raw post → BugCandidate normalization             |
| classifier.ts      | 12-category classification with sarcasm detection |
| redactor.ts        | PII detection and replacement (6 types)           |
| reporter-scorer.ts | 4-dimension reliability scoring                   |
| clusterer.ts       | Family-first clustering engine                    |
| signatures.ts      | Bug signature generation and matching             |
| overrides.ts       | Human override loading and application            |

### Subagents (4)

| Agent             | Purpose                                 |
| ----------------- | --------------------------------------- |
| bug-clusterer     | Parse, classify, redact, score, cluster |
| repo-scanner      | Scan repos for evidence                 |
| owner-router      | Route ownership via precedence          |
| triage-summarizer | Format terminal output                  |

### Orchestration

The target orchestration is documented in `skills/x-bug-triage/SKILL.md`. The current public skill deliberately separates live intake, offline library evaluation, and contract demonstrations because no checked-in runner drives the original 11-step flow.

## Data Flow

1. **Intake**: X API → raw posts with full field expansions
2. **Parse**: Raw post → BugCandidate (33 fields)
3. **Classify**: BugCandidate → classification + confidence + rationale
4. **Redact**: PII detection → `[REDACTED:type]` replacement
5. **Score**: Reporter reliability (4 dimensions)
6. **Tag**: reporter_category from approved-accounts config
7. **Cluster**: Family-first → signature match → create/update cluster
8. **Scan**: Top 3 repos per cluster → evidence tiered 1-4
9. **Route**: 6-level ownership precedence → ranked assignees
10. **Display**: Clusters → formatted markdown in terminal
11. **Slack** (optional): If plugin available, also deliver to Slack channel
12. **Review**: User commands from terminal (or Slack) → parsed → responses
13. **File**: Draft → confirm gate → duplicate check → GitHub issue
14. **Link**: Issue ↔ cluster bidirectional linking
15. **Audit**: Every step logged (12 event types)

## Persistence

SQLite at `data/triage.db` with 8 tables:
candidates, clusters, cluster_posts, overrides, suppression_rules, issue_links, triage_runs, audit_log

Schema-versioned migrations in `db/migrations/`.

## Slack Integration (Optional)

The `claude-code-slack-channel` plugin is a separate peer plugin. This document preserves the intended integration design, but x-bug-triage exposes no Slack tool and does not automatically call the peer plugin. Any Slack bridge requires a separately implemented orchestration layer.

## Security Boundaries

- Complaint text sanitized before downstream use
- Links/instructions from complaints never executed
- Unredacted secrets never stored
- Internal routing details never exposed publicly
- Issue drafts only include redacted, approved content
- Transport logic separate from triage logic
