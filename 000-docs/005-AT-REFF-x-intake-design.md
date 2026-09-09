# X Intake Design Reference — X Bug Triage Plugin

> **Current implementation:** all six listed tools make live X API v2 requests with `X_BEARER_TOKEN`. Page caps and retries are implemented. Provider limits can change and must be confirmed from live response headers. `since_id` is caller-supplied rather than persisted automatically, and the server cannot refresh bearer tokens.

## Overview

Poll-based ingestion from X API v2 using 6 MCP tools. No streaming for MVP.

## Endpoints

| Tool               | X API Endpoint                     | Purpose                  | Rate Limit          |
| ------------------ | ---------------------------------- | ------------------------ | ------------------- |
| resolve_username   | GET /2/users/by/username/:username | Username → user ID       | 300/15min           |
| fetch_mentions     | GET /2/users/:id/mentions          | Account mention timeline | 450/15min (app)     |
| search_recent      | GET /2/tweets/search/recent        | 7-day keyword search     | 300/15min (app)     |
| search_archive     | GET /2/tweets/search/all           | Full-archive search      | 300/15min (app)     |
| fetch_conversation | conversation_id search             | Thread reconstruction    | (uses search quota) |
| fetch_quote_tweets | GET /2/tweets/:id/quote_tweets     | Quote-post lookup        | 75/15min            |

## Field Expansions

Every request includes:

- `tweet.fields`: id, text, author_id, conversation_id, created_at, in_reply_to_user_id, referenced_tweets, attachments, public_metrics, entities, lang
- `user.fields`: id, username, name, verified, created_at, public_metrics
- `media.fields`: media_key, type, url, preview_image_url
- `expansions`: author_id, referenced_tweets.id, attachments.media_keys, in_reply_to_user_id

## Query Rules

- All searches must be pre-approved in `config/approved-searches.json`
- All OR groups must be explicitly parenthesized
- Unapproved queries are rejected before execution
- Version queries recommended to detect stale client reports

## Cross-Reference

`fetch_mentions` results are cross-referenced with `search_recent` (@username query) for completeness. Posts appearing in both are deduplicated by post_id.

## Rate Limiting

- Track per-endpoint, per-15-minute window
- Use `x-rate-limit-remaining` and `x-rate-limit-reset` headers
- Pre-run budget estimation before execution
- Warning at configurable thresholds

## Degradation Behavior

| Scenario              | Response                                                                     |
| --------------------- | ---------------------------------------------------------------------------- |
| 429 Too Many Requests | Exponential backoff using x-rate-limit-reset, max 3 retries, then skip + log |
| 401 Unauthorized      | Return a failed/degraded result; the operator must replace the bearer token  |
| 500/503 Server Error  | Retry once after 30s, then skip + log                                        |
| Timeout (30s)         | Retry once, then skip + log                                                  |
| Credits exhausted     | Abort ingest, alert operator                                                 |
| Partial mentions      | Log gap + supplement with search                                             |

## Request Budgeting

Before each run:

1. Estimate total requests needed (accounts × endpoints)
2. Check remaining quota per endpoint
3. Warn if projected usage exceeds 80% of remaining
4. Abort if credits insufficient

## since_id Tracking

Tools accept an optional caller-supplied `since_id`. No handler persists or automatically reloads the last-seen ID.

## Pagination

- Respect `next_token` for paginated responses
- mentions: 800 post cap per timeline pull
- search: follow pagination tokens to completion within budget
