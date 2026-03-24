![CI](https://github.com/jeremylongshore/x-bug-triage-plugin/actions/workflows/ci.yml/badge.svg)
![Version](https://img.shields.io/github/v/release/jeremylongshore/x-bug-triage-plugin)

# X Bug Triage Plugin

Closed-loop bug triage pipeline for Claude Code: public X/Twitter complaints → structured bug candidates → clustered families → repo evidence → owner routing → Slack review → filed GitHub issues → future evidence auto-attaches.

## Architecture

5 MCP servers orchestrated by a single SKILL.md playbook:

| Server | Purpose |
|--------|---------|
| `x-intake` | X API v2 ingestion (mentions, search, conversations, quotes) |
| `repo-analysis` | GitHub repo evidence scanning (issues, commits, paths, deploys) |
| `internal-routing` | Ownership lookup with 6-level precedence |
| `issue-draft` | Draft generation with confirmation gate and duplicate check |
| `slack-notification` | Slack mrkdwn formatting for triage summaries and review commands |

## Slack Review Loop

Interactive triage via the `claude-code-slack-channel` bridge (two-way):

1. Triage runs produce cluster summaries sent to Slack
2. Reviewer sends commands (`details`, `file`, `dismiss`, `merge`, etc.)
3. Claude parses commands and responds in-thread
4. `confirm file` gates all issue creation

## Quick Start

```bash
# Install dependencies
bun install

# Run migrations
bun run db:migrate

# Run tests
bun test

# Type check
bun run typecheck
```

See [000-docs/010-OP-GUID-runbook-local-dev.md](000-docs/010-OP-GUID-runbook-local-dev.md) for full setup instructions.

## Project Structure

```
mcp/                    # 5 MCP servers (each with server.ts + lib.ts)
lib/                    # Shared library (types, db, config, audit)
db/                     # SQLite schema and migrations
config/                 # 8 operational config files
skills/x-bug-triage/    # Orchestration skill and policy references
agents/                 # 4 subagent definitions
integrations/slack/     # Slack bridge submodule
data/                   # Runtime data (SQLite DB, reports, audit logs)
tests/fixtures/         # Mock API responses for deterministic testing
000-docs/               # Durable project documentation
```

## License

Intent Solutions Proprietary — see [LICENSE](LICENSE).
