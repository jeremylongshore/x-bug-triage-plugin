# Local Development Runbook — X Bug Triage Plugin

## Prerequisites

- **Bun** >= 1.1 (`curl -fsSL https://bun.sh/install | bash`)
- **X API credentials** (Pay-Per-Use or Basic tier)
- **GitHub CLI** (`gh`) for issue filing
- **Claude Code** with MCP support

## Initial Setup

### 1. Clone

```bash
git clone https://github.com/jeremylongshore/x-bug-triage-plugin.git
cd x-bug-triage-plugin
```

### 2. Install dependencies

```bash
bun install
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

## Running a Triage

In Claude Code terminal:

```
/x-bug-triage @account --window 24h
```

Results display directly. Interact with review commands:
```
> details 1
> file 2
> dismiss 3 noise
> confirm file 2
```

## Optional: Slack for Team Review

If you want async team review via Slack, install the [`claude-code-slack-channel`](https://github.com/jeremylongshore/claude-code-slack-channel) plugin separately:

1. Clone and install `claude-code-slack-channel` per its README
2. Register it in your Claude Code MCP settings (separate from this plugin)
3. Configure Slack tokens in the bridge's `.env`
4. Triage results will be delivered to both terminal and Slack

## Config Files

All operational parameters are in `config/`. Edit these to customize behavior:

| File | Purpose |
|------|---------|
| approved-accounts.json | Known accounts (internal, partner, tester) |
| approved-searches.json | Pre-approved X search queries |
| severity-thresholds.json | Escalation triggers and thresholds |
| surface-repo-mapping.json | Product surface → GitHub repo mapping |
| routing-source-priority.json | 6-level routing precedence |
| slack-preferences.json | Slack display preferences |
| retention-policy.json | Data retention periods |
| cluster-matching-thresholds.json | Clustering signal weights |

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
