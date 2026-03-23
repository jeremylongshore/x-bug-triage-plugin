# CLAUDE.md — x-bug-triage-plugin

## What This Is

Closed-loop bug triage plugin for Claude Code. Ingests public X/Twitter complaints, normalizes into structured bug candidates, clusters by family and signal layers, scans repos for evidence, routes to owners, delivers interactive Slack review, and files GitHub issues with human confirmation.

## Architecture

- **5 MCP servers** in `mcp/` — each has `server.ts` (MCP registration) + `lib.ts` (pure functions) + `types.ts`
- **Shared library** in `lib/` — types, db, config, audit, parser, classifier, clusterer, etc.
- **1 orchestration skill** at `skills/x-bug-triage/SKILL.md` — 11-step workflow
- **4 subagents** in `agents/` — bug-clusterer, repo-scanner, owner-router, triage-summarizer
- **SQLite** at `data/triage.db` — 8 tables, schema-versioned migrations
- **Slack bridge** via git submodule at `integrations/slack/claude-code-slack-channel/`

## Build & Test

```bash
bun install                # Install dependencies
bun run typecheck          # TypeScript strict check
bun test                   # Run all tests
bun run db:migrate         # Create/update SQLite database
bun run db:reset           # Destroy and recreate database
```

## Key Conventions

### MCP Server Pattern
Each server follows the `server.ts` + `lib.ts` split:
- `server.ts` — MCP tool registration, input validation, calls lib functions
- `lib.ts` — Pure business logic, fully testable without MCP
- `lib.test.ts` — Tests against lib.ts directly
- `types.ts` — Server-specific types (imports shared types from `@lib/types`)

### Module Resolution
- `tsconfig.base.json` defines `@lib/*` → `./lib/*` path alias
- Each MCP server extends `../../tsconfig.base.json`
- Import shared code as `@lib/types`, `@lib/db`, `@lib/config`, etc.

### Config
8 JSON config files in `config/` — all operational parameters externalized. Never hardcode thresholds, keywords, or mappings.

### Database
SQLite via `bun:sqlite`. Schema in `db/schema.sql`. Migrations in `db/migrations/`. Run `bun run db:migrate` after schema changes.

### Branching
- Feature branches: `feature/epic-NN-description`
- Commits: `feat(epic-NN): description`, `test(epic-NN): description`, `docs(epic-NN): description`
- One PR per epic

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

## Documentation
All durable docs live in `000-docs/` following doc-filing conventions (NNN-CC-ABCD format).

## Task Tracking
Uses Beads (`bd`) for post-compaction recovery. Workflow: `bd update <id> --status in_progress` → work → `bd close <id> --reason "evidence"` → `bd sync`.
