# Contributing to x-bug-triage-plugin

Thank you for your interest in contributing to **x-bug-triage-plugin**! This guide will help you get started.

## Getting Started

### Prerequisites

- Git
- GitHub account
- [Bun](https://bun.sh/) runtime (v1.0+)
- Node.js 20+ (for compatibility)

### Development Setup

```bash
# Clone the repository
git clone https://github.com/jeremylongshore/x-bug-triage-plugin.git
cd x-bug-triage-plugin

# Install dependencies
bun install

# Run typecheck
bun run typecheck

# Run tests
bun test

# Set up database
bun run db:migrate
```

## How to Contribute

### Reporting Bugs

1. Search [existing issues](https://github.com/jeremylongshore/x-bug-triage-plugin/issues) first
2. Open a [bug report](https://github.com/jeremylongshore/x-bug-triage-plugin/issues/new?template=bug_report.md)
3. Include reproduction steps, expected vs actual behavior, and environment details

### Suggesting Enhancements

1. Check [existing feature requests](https://github.com/jeremylongshore/x-bug-triage-plugin/issues?q=label%3Aenhancement)
2. Open a [feature request](https://github.com/jeremylongshore/x-bug-triage-plugin/issues/new?template=feature_request.md)

### Pull Requests

1. Fork the repository
2. Create a feature branch from `main`:
   ```bash
   git checkout -b feature/epic-NN-description
   ```
3. Make your changes
4. Write or update tests
5. Ensure all tests pass (`bun test`)
6. Run typecheck (`bun run typecheck`)
7. Commit with [conventional commit messages](#commit-messages)
8. Push and open a pull request

## Development Process

### Branch Strategy

| Branch | Purpose |
|--------|---------|
| `main` | Production-ready code |
| `feature/*` | New features (epic-based) |
| `fix/*` | Bug fixes |
| `docs/*` | Documentation changes |

### Testing

Run the test suite before submitting a PR:

```bash
bun test              # Run all tests
bun run typecheck     # TypeScript strict check
```

### Code Review

- All PRs require at least 1 maintainer approval
- CI must pass (typecheck + tests)
- Gemini review must complete before merge
- Keep PRs focused — one feature or fix per PR

## Style Guides

### Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

[optional body]
[optional footer]
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `ci`

**Examples:**
- `feat(epic-03): add X/Twitter intake server`
- `fix(parser): handle empty input gracefully`
- `docs(readme): update installation instructions`

### Code Style

- Follow the MCP server pattern: `server.ts` + `lib.ts` + `types.ts`
- Use `@lib/*` path aliases for shared imports
- TypeScript strict mode — no `any` types
- Write clear, self-documenting code
- Add comments only where logic isn't obvious

## Community

- **Questions**: [GitHub Discussions](https://github.com/jeremylongshore/x-bug-triage-plugin/discussions)
- **Bugs**: [Issue Tracker](https://github.com/jeremylongshore/x-bug-triage-plugin/issues)
- **Email**: jeremy@intentsolutions.io

## License

By contributing, you agree that your contributions will be licensed under the
project's existing license terms.

---

*Thank you for helping improve x-bug-triage-plugin!*
