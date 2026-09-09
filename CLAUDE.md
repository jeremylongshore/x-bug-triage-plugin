# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Public Claude Code prototype with live bounded X/Twitter intake plus local triage libraries and downstream MCP contract stubs. It does not currently scan GitHub, resolve owners, compute severity, deliver Slack messages, file issues, or run the full pipeline end to end.

## Build & Test

```bash
bun install --frozen-lockfile      # Install locked dependencies
bun run typecheck                  # TypeScript strict check (tsc --noEmit)
bun test                           # Run the complete test suite
bun test lib/parser.test.ts        # Run a single test file
bun test --watch                   # Watch mode
bun run db:migrate                 # Create/update SQLite database
bun run db:reset                   # Destroy and recreate database (DESTRUCTIVE)
```

## Architecture

Terminal-first Claude Code plugin. Six MCP tools perform live authenticated X API v2 intake. The remaining MCP groups are prototype contracts: repo analysis produces synthetic records, routing returns no owner, review parsing validates syntax only, and filing returns a simulated receipt. The local libraries are not wired into a unified MCP runner.

### Component Map

- **1 MCP server** (`triage`) at `mcp/triage-server/` — 19 tools in 5 groups, all prefixed `mcp__triage__`
- **Shared library** at `lib/` — types, db, config, audit, parser, classifier, clusterer, signatures, redactor, scorer, overrides, retention
- **Primary skill** at `skills/x-bug-triage/SKILL.md` — bounded intake and prototype evaluation
- **4 focused public skills** at `skills/` — bug-clustering, repo-scanning, owner-routing, triage-display
- **4 subagents** at `agents/` — bug-clusterer, repo-scanner, owner-router, triage-summarizer
- **SQLite** at `data/triage.db` — 9 tables, schema-versioned migrations in `db/migrations/`
- **8 config files** at `config/` — all operational parameters externalized

### Data Flow

Implemented paths are separate today:

- X API → six live MCP intake tools
- fixtures or caller data → local parser/classifier/redactor/scorer/dedupe/cluster/database libraries
- caller data → synthetic repo records → empty routing results → local draft text → simulated filing receipt

Do not describe these paths as a closed loop. No checked-in runner connects live intake to the local libraries or downstream contract tools.

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

Deterministic mock data at `tests/fixtures/` includes X API responses, synthetic GitHub-shaped responses, candidate objects, and cluster objects. Fixture presence does not imply a live GitHub integration.

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
