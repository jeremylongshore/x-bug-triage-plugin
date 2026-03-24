# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Closed-loop bug triage plugin for Claude Code. Ingests public X/Twitter complaints, normalizes into structured bug candidates, clusters by family and signal layers, scans repos for evidence, routes to owners, displays interactive triage results in the terminal, and files GitHub issues with human confirmation.

## Build & Test

```bash
bun install                        # Install dependencies
bun run typecheck                  # TypeScript strict check (tsc --noEmit)
bun test                           # Run all 278 tests
bun test lib/parser.test.ts        # Run a single test file
bun test --watch                   # Watch mode
bun run db:migrate                 # Create/update SQLite database
bun run db:reset                   # Destroy and recreate database (DESTRUCTIVE)
```

## Architecture

Terminal-first Claude Code plugin. Results display as markdown in the terminal. Users type review commands directly. Optional Slack delivery via peer plugin `claude-code-slack-channel` (not bundled).

### Component Map

- **1 MCP server** (`triage`) at `mcp/triage-server/` — 19 tools in 5 groups, all prefixed `mcp__triage__`
- **Shared library** at `lib/` — types, db, config, audit, parser, classifier, clusterer, signatures, redactor, scorer, overrides, retention
- **Orchestration skill** at `skills/x-bug-triage/SKILL.md` — 11-step workflow
- **4 per-agent skills** at `skills/` — bug-clustering, repo-scanning, owner-routing, triage-display (internal, not user-invocable)
- **4 subagents** at `agents/` — bug-clusterer, repo-scanner, owner-router, triage-summarizer
- **SQLite** at `data/triage.db` — 9 tables, schema-versioned migrations in `db/migrations/`
- **8 config files** at `config/` — all operational parameters externalized

### Data Flow

X API → intake (6 tools) → parser/classifier/redactor/scorer (lib/) → clusterer (lib/) → repo evidence (4 tools) → routing (5 tools) → terminal display → review commands (1 tool) → issue draft (3 tools) → GitHub issue

### Cross-Module Dependencies

The MCP server and shared library have a **bidirectional import relationship**:

- `mcp/triage-server/lib.ts` imports from `../../lib/types` and `../../lib/config` (relative paths — the `@lib/*` alias is NOT available in MCP server code)
- `lib/parser.ts` and `lib/reporter-scorer.ts` import `XPost` from `../mcp/triage-server/types`

The `@lib/*` path alias (defined in `tsconfig.base.json`) only resolves within the base tsconfig's `include` scope (`lib/`, `db/`). The MCP server has its own `tsconfig.json` extending the base.

### MCP Server Pattern

Single server with `server.ts` + `lib.ts` split:
- `server.ts` — tool registration, X API fetch infrastructure (auth, retry, rate limiting), calls lib functions
- `lib.ts` — pure business logic, fully testable without MCP
- `lib.test.ts` — tests against lib.ts directly
- `types.ts` — server-specific types (XPost, RepoEvidence, RoutingResult, IssueDraft, ParsedCommand)

### Test Fixtures

Deterministic mock data at `tests/fixtures/` — X API responses, GitHub API responses, candidate objects, cluster objects. Used by `tests/scenario-validation.test.ts` (19 integration tests).

## Key Conventions

### Config
8 JSON config files in `config/`. Never hardcode thresholds, keywords, or mappings.

### Evidence Standards
- Tier 1 (Exact) alone justifies clustering
- Tier 2 (Strong) strengthens, never silently substitutes for Tier 1
- Tier 3 (Moderate) supports grouping, not routing
- Tier 4 (Weak) must never be presented as hard evidence

### Severity Rules
- Independent from reporter prestige and cluster size
- High consequence outranks high volume
- High/critical must always expose rationale

### Reporter Reliability
- Supporting signal only, not truth oracle
- Low reliability never invalidates bug hypothesis alone
- Never suppress security/privacy/data-loss/billing candidates by reliability alone

### PII
- 6 types detected: emails, API keys, phones, account IDs, media flags, URL tokens
- Replaced with `[REDACTED:type]`
- Raw unredacted text is NEVER stored

### Branching
- Feature branches: `feature/epic-NN-description`
- Commits: `feat(epic-NN): description`
- One PR per epic

## Documentation

All durable docs live in `000-docs/` following doc-filing conventions (NNN-CC-ABCD format).

## Task Tracking

Uses Beads (`bd`) for post-compaction recovery. Workflow: `bd update <id> --status in_progress` → work → `bd close <id> --reason "evidence"` → `bd sync`.
