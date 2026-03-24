# CLAUDE.md — x-bug-triage-plugin

## What This Is

Closed-loop bug triage plugin for Claude Code. Ingests public X/Twitter complaints, normalizes into structured bug candidates, clusters by family and signal layers, scans repos for evidence, routes to owners, displays interactive triage results in the terminal, and files GitHub issues with human confirmation.

## Architecture

- **1 MCP server** (`triage`) in `mcp/triage-server/` — `server.ts` (19 tools) + `lib.ts` (pure functions) + `types.ts`
- **Shared library** in `lib/` — types, db, config, audit, parser, classifier, clusterer, etc.
- **1 orchestration skill** at `skills/x-bug-triage/SKILL.md` — 11-step workflow
- **4 subagents** in `agents/` — bug-clusterer, repo-scanner, owner-router, triage-summarizer
- **SQLite** at `data/triage.db` — 8 tables, schema-versioned migrations
- **Optional Slack delivery** via peer plugin `claude-code-slack-channel` (not bundled)

## UX Model

Terminal-first. Results display directly in Claude Code as markdown. Users interact with review commands (`details`, `file`, `dismiss`, etc.) by typing in the terminal. If the `claude-code-slack-channel` plugin is installed, results are also delivered to Slack for async team review.

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
Single server with `server.ts` + `lib.ts` split:
- `server.ts` — MCP tool registration (19 tools), input validation, calls lib functions
- `lib.ts` — Pure business logic, fully testable without MCP
- `lib.test.ts` — Tests against lib.ts directly
- `types.ts` — Server-specific types (imports shared types from `@lib/types`)

Tool groups within the single server:
- X Intake (6): `resolve_username`, `fetch_mentions`, `search_recent`, `search_archive`, `fetch_conversation`, `fetch_quote_tweets`
- Repo Analysis (4): `search_issues`, `inspect_recent_commits`, `inspect_code_paths`, `check_recent_deploys`
- Internal Routing (5): `lookup_service_owner`, `lookup_oncall`, `parse_codeowners`, `lookup_recent_assignees`, `lookup_recent_committers`
- Issue Draft (3): `create_draft_issue`, `check_existing_issues`, `confirm_and_file`
- Review (1): `parse_review_command`

All tools use the `mcp__triage__` prefix.

### Module Resolution
- `tsconfig.base.json` defines `@lib/*` → `./lib/*` path alias
- MCP server extends `../../tsconfig.base.json`
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
