# Local Development Runbook — X Bug Triage Plugin

## Prerequisites

- **Bun** >= 1.1 (`curl -fsSL https://bun.sh/install | bash`)
- **X API credentials** (Pay-Per-Use or Basic tier)
- **Claude Code** with MCP support

## Initial Setup

### 1. Clone

```bash
git clone https://github.com/jeremylongshore/x-bug-triage-plugin.git
cd x-bug-triage-plugin
```

### 2. Install dependencies

```bash
bun install --frozen-lockfile
```

### 3. Configure X API credentials

Create `~/.claude/channels/x-triage/.env`:

```bash
mkdir -p ~/.claude/channels/x-triage
cat > ~/.claude/channels/x-triage/.env << 'EOF'
X_BEARER_TOKEN=your_bearer_token_here
EOF
chmod 600 ~/.claude/channels/x-triage/.env
```

### 4. Initialize database

```bash
bun run db:migrate
```

### 5. Verify setup

```bash
bun run typecheck   # Should pass with no errors
bun test            # Should pass all tests
```

## Running Live Intake

In Claude Code terminal:

```
/x-bug-triage @account --window 24h
```

The skill can fetch a bounded public sample. It does not automatically run the local parser and clusterer, scan GitHub, resolve owners, execute review commands, or file an issue. Use its explicit offline-library or contract-demonstration modes when evaluating those separate surfaces.

## Slack Design Reference

The separate [`claude-code-slack-channel`](https://github.com/jeremylongshore/claude-code-slack-channel) plugin can provide Slack tools, but x-bug-triage does not call it automatically. Installing both plugins is not a working integration by itself. The intended future setup is:

1. Clone and install `claude-code-slack-channel` per its README
2. Register it in your Claude Code MCP settings (separate from this plugin)
3. Configure Slack tokens in the bridge's `.env`
4. Implement an orchestration layer that explicitly passes approved, redacted results between them

## Config Files

Configuration schemas are in `config/`. Only settings consumed by the current handler or local helper affect runtime behavior:

| File                             | Purpose                                    |
| -------------------------------- | ------------------------------------------ |
| approved-accounts.json           | Known accounts (internal, partner, tester) |
| approved-searches.json           | Pre-approved X search queries              |
| severity-thresholds.json         | Escalation triggers and thresholds         |
| surface-repo-mapping.json        | Product surface → GitHub repo mapping      |
| routing-source-priority.json     | 6-level routing precedence                 |
| slack-preferences.json           | Slack display preferences                  |
| retention-policy.json            | Data retention periods                     |
| cluster-matching-thresholds.json | Clustering signal weights                  |

## Database Operations

```bash
bun run db:migrate    # Apply pending migrations
bun run db:reset      # Destroy and recreate database (DESTRUCTIVE)
```

SQLite database lives at `data/triage.db`. Excluded from git.

## Testing

```bash
bun test                        # Run all tests
bun test lib/parser.test.ts     # Run specific test file
bun test --watch                # Watch mode
```

Test fixtures in `tests/fixtures/` provide deterministic mock data:

- `x-api/` — Mock X API responses
- `github-api/` — Mock GitHub API responses
- `candidates/` — Test bug candidate objects
- `clusters/` — Test cluster objects

## Backup

```bash
./scripts/backup.sh             # Create timestamped backup with checksum
```

## Troubleshooting

### TypeScript errors

```bash
bun run typecheck               # Check for type errors
```

### Database issues

```bash
bun run db:reset                # Nuclear option: destroy and recreate
```

### MCP server issues

The single triage server can be tested directly:

```bash
cd mcp/triage-server && bun run start
```

### Beads

```bash
bd doctor                       # Check beads health
bd list --status in_progress    # See active tasks
bd sync                         # Sync state
```
