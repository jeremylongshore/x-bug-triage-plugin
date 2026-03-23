# MVP Scope and Non-Goals — X Bug Triage Plugin

## In Scope (MVP)

### Intake
- Poll-based X API v2 ingestion (mentions, search, conversations, quotes)
- 6 MCP tools for X interaction
- Approved-query enforcement
- Rate limiting and budget estimation
- Graceful degradation on all error paths

### Processing
- 33-field candidate normalization
- 12-category classification with sarcasm detection
- 6-type PII redaction
- 4-dimension reporter reliability scoring
- Reporter category tagging (public/internal/partner/tester)

### Clustering
- Family-first clustering (4 families)
- Deterministic + semantic + temporal signal layers
- Cross-session cluster continuity
- 7 lifecycle states, 4 sub-statuses
- 8 override types with persistence
- Suppression rules

### Evidence & Routing
- Surface-to-repo mapping (top 3 repos per cluster)
- 4-tier evidence hierarchy
- 6-level routing precedence
- Staleness detection (>30 days)
- Explicit uncertainty when routing fails

### Review
- Slack integration via claude-code-slack-channel bridge (two-way)
- Formatted triage summaries
- 11 interactive review commands
- Thread state tracking
- 24h idle reminders
- Fallback to local JSON on Slack failure

### Filing
- GitHub Issues as draft target
- Human confirmation gate (no auto-filing)
- Duplicate detection before submission
- Bidirectional issue-family linking
- Future evidence auto-attachment

### Operations
- SQLite persistence (8 tables)
- Schema-versioned migrations
- 12-type audit logging
- Retention enforcement
- Backup with checksum

## Non-Goals (Explicitly Out of Scope)

- **Streaming intake**: No filtered stream connection. Poll-based only.
- **Multi-workspace Slack**: Single Slack workspace via one bridge instance.
- **Linear/Jira integration**: GitHub Issues only for MVP.
- **Automated remediation**: Triage and routing only, no code fixes.
- **Public dashboard**: No web UI. Slack is the review interface.
- **Multi-tenant**: Single-operator deployment.
- **ML model training**: Classification uses heuristics and LLM, not custom-trained models.
- **Historical backfill**: No bulk import of historical complaints.
- **Real-time alerting**: Batch triage runs, not real-time monitoring.
- **Cost optimization UI**: Budget estimation is API-level, not user-facing dashboard.
- **Internationalization**: Symptoms normalized to English; no multi-language UI.

## Success Criteria

1. Full triage cycle completes with mock data (happy path)
2. Partial failures produce useful output with warnings
3. Rare severe bugs surface at appropriate severity despite low volume
4. New complaints attach to existing filed clusters
5. Regression reopening works correctly
6. All 12 audit event types logged
7. All 6 PII types caught
8. All 11 Slack commands parse correctly
9. No issue filed without human confirmation
