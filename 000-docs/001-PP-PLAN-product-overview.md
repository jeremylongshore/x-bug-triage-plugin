# Product Overview — X Bug Triage Plugin

## Problem

Public X/Twitter complaints about software products are a noisy, unstructured signal. Engineering teams miss real bugs buried in sarcasm, duplicate reports, feature requests, and policy disagreements. Manual triage is slow, inconsistent, and doesn't scale.

## Solution

A closed-loop triage pipeline that:

1. **Ingests** public X complaints via X API v2 (mentions, search, conversations, quotes)
2. **Normalizes** raw posts into structured bug candidates with 33 fields
3. **Classifies** into 12 categories including sarcasm detection
4. **Redacts** PII (6 types) before storage
5. **Scores** reporter reliability across 4 dimensions
6. **Clusters** by family-first logic with deterministic + semantic + temporal signals
7. **Scans** mapped repos for issue/commit/deploy evidence (4 tiers)
8. **Routes** to likely owners via strict 6-level precedence
9. **Delivers** interactive Slack summaries via two-way bridge
10. **Files** GitHub issues only after explicit human confirmation
11. **Learns** from human overrides (8 types) for future runs

## Key Properties

- **Human-in-the-loop**: No auto-filing. Every issue requires `confirm file` command.
- **Evidence-tiered**: All evidence labeled Tier 1-4. Weak evidence never presented as strong.
- **Severity-independent**: Severity computed independently from reporter prestige and cluster size.
- **Memory-bearing**: Human corrections (merge, split, dismiss, reroute, etc.) persist across runs.
- **Degradation-aware**: Partial failures produce truthful, useful output with explicit warnings.

## Target Users

Engineering leads and oncall teams who want structured signal from public complaint channels without manual monitoring.

## MVP Scope

- Poll-based X intake (no streaming)
- GitHub Issues as filing target
- Single Slack workspace via claude-code-slack-channel bridge
- SQLite persistence (local)
