# Changelog

## [v0.3.1] - 2026-03-24

- fix: scaffold audit — version sync, terminal-first descriptions, start script (#13) (f9d62b5)


All notable changes to x-bug-triage-plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [v0.3.0] - 2026-03-24

### Changed
- SKILL.md restructured: DCI directives, references/ section, A-grade (96/100) (#12)

### Fixed
- Version sync: all 5 version files now agree on 0.3.0 (#13)
- `.mcp.json` entry point: added missing `start` script to package.json (#13)
- Description consistency: "Slack review" → "terminal review" in package.json and plugin.json (#13)
- plugin.json: version bumped from 0.1.1, removed stale "slack" keyword, added homepage (#13)
- CLAUDE.md test count: 278 → 282 (#13)

## [v0.2.0] - 2026-03-24

### Changed
- feat: add disallowedTools guardrails to all 4 subagents (#11) (c294416)

## [v0.1.4] - 2026-03-24

### Changed
- Terminal-first UX, consolidate 5 MCP servers into 1, fix false claims (#10) (45671ed)

## [v0.1.3] - 2026-03-24

### Fixed
- Presentation polish for public showcase (cfbfc88)

## [v0.1.2] - 2026-03-23

### Changed
- chore(release): clean up CHANGELOG and add .gist-id (f6256cb)

## [v0.1.1] - 2026-03-23

### Changed
- ci(deps): bump actions/checkout from 4 to 6 (#8)

## [v0.1.0] - 2026-03-23

### Added
- Closed-loop bug triage plugin with 1 MCP server (19 tools)
- X/Twitter complaint intake with 6 MCP tools (EPIC-03)
- Candidate parsing, classification, PII redaction, and scoring (EPIC-04)
- Family-first clustering, signatures, lifecycle, and override memory (EPIC-05)
- Repo scanning, routing, Slack review, issue drafting + SKILL.md (EPICs 06-09)
- SQLite storage with 8-table schema, contracts, and audit foundation (EPIC-02)
- Repo foundation, plugin skeleton, and 10 durable docs (EPIC-01)
- 89 tests filling P0/P1 gaps from test quality audit
- Full governance suite: CODE_OF_CONDUCT, CONTRIBUTING, SECURITY, SUPPORT, AGENTS
- CI/CD: GitHub Actions for tests, PR quality gate, Gemini review, release
- Dependabot for npm and GitHub Actions dependencies

### Changed
- EPIC-10: Hardening, validation, and MVP readiness report (#7)
