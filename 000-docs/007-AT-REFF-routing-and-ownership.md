# Routing and Ownership Reference — X Bug Triage Plugin

## Routing Precedence (strict order)

| Level | Source | Confidence | Description |
|-------|--------|-----------|-------------|
| 1 | Service/component owner | 1.0 | Active ownership metadata |
| 2 | Oncall | 0.9 | Current oncall/escalation metadata |
| 3 | CODEOWNERS | 0.8 | CODEOWNERS file analysis |
| 4 | Recent assignees | 0.6 | Issue/PR assignees in last 30 days |
| 5 | Recent committers | 0.5 | Committers to affected paths in last 14 days |
| 6 | Fallback mapping | 0.3 | Static fallback from config |

Weaker sources never silently overrule stronger ones. If Level 1 is available, Levels 2-6 are supporting context only.

## Staleness

Any routing signal older than 30 days is flagged as stale. Stale signals are still used but with reduced confidence and explicit warning.

## Uncertainty

When no routing signals are available at any level:
> "Routing: uncertain — no routing signals available. Manual assignment required."

Uncertainty is always stated explicitly. Never fabricate a routing recommendation.

## Repo Scanning

Top 3 repos per cluster (hard cap). Repos selected from `config/surface-repo-mapping.json`.

### Scan Capabilities
- **Issue search**: Match symptoms/error strings against open/recent issues
- **Recent commits**: Commits and PRs in last 7 days
- **Path inspection**: Likely affected code paths from surface-repo mapping
- **Deploy/release check**: Recent deploy tags correlated with report timing

### Evidence Tiering
Each repo evidence item is tagged Tier 1-4 per the evidence hierarchy. Repo scan evidence is triage-quality — it supports investigation, NOT root cause proof.

## Degradation

| Scenario | Response |
|----------|----------|
| Repo access denied | Skip repo, note "Repo X: access denied, skipped" |
| GitHub rate limit | Backoff, retry, skip if blocked |
| Timeout (60s) | Skip on timeout |
| Ownership unavailable | Fall to next precedence level |
| CODEOWNERS missing | Skip, note in rationale |
| All routing fails | Explicit uncertainty statement |

## Override Application

Prior routing overrides (from `overrides` table) are applied before generating new recommendations. If a human previously rerouted a cluster, that correction takes precedence.

## Escalation Triggers (6)

| Trigger | Threshold |
|---------|-----------|
| Report velocity spike | 50 reports in 30 minutes |
| Data loss language | Keywords: lost, deleted, gone, disappeared, missing conversations |
| Security/privacy language | Keywords: unauthorized, leaked, exposed |
| Auth/billing cascade | 20 reports in 60 minutes |
| Cross-surface failure | 3+ surfaces affected |
| Enterprise blocking | Keywords: enterprise, API-critical, workflow blocked |

## External Dependencies

When evidence points to a third-party dependency rather than owned code, the cluster is flagged as `external_dependency_candidate` with the dependency identified.
