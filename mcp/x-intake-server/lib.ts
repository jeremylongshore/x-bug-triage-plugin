/**
 * X Intake — pure business logic
 * Handles query compilation, rate limiting, budget estimation, and response parsing.
 */

import type {
  XPost,
  XApiResponse,
  RateLimitState,
  RequestBudget,
  ApprovedSearch,
  IntakeResult,
  PartialResultMetadata,
  DegradationReport,
} from "./types";
import { TWEET_FIELDS, USER_FIELDS, MEDIA_FIELDS, EXPANSIONS, RATE_LIMITS } from "./types";

// === Query Compiler ===

/**
 * Validates a query against the approved searches list.
 * Returns the approved query or throws if not found.
 */
export function validateApprovedQuery(
  queryName: string,
  approvedSearches: ApprovedSearch[],
): ApprovedSearch {
  const found = approvedSearches.find((s) => s.name === queryName);
  if (!found) {
    throw new Error(
      `Query "${queryName}" is not in approved-searches.json. Available: ${approvedSearches.map((s) => s.name).join(", ")}`,
    );
  }
  return found;
}

/**
 * Ensures all OR groups in a query are explicitly parenthesized.
 * Throws if unparenthesized OR groups are detected.
 */
export function validateQueryParenthesization(query: string): void {
  // Split by OR and check each segment is within parens
  const orSegments = query.split(/\s+OR\s+/);
  if (orSegments.length > 1) {
    // The entire OR group should be within parentheses
    // Check that there's a matching set of parens wrapping the OR groups
    const stripped = query.trim();
    // Simple check: if there are ORs, either the whole thing is in parens
    // or each OR group is individually parenthesized
    let depth = 0;
    let hasUnparenthesizedOr = false;
    for (let i = 0; i < stripped.length; i++) {
      if (stripped[i] === "(") depth++;
      if (stripped[i] === ")") depth--;
      if (depth === 0 && stripped.substring(i).match(/^\s+OR\s+/)) {
        hasUnparenthesizedOr = true;
        break;
      }
    }
    if (hasUnparenthesizedOr) {
      throw new Error(
        `Query contains unparenthesized OR groups. All OR groups must be wrapped in parentheses: ${query}`,
      );
    }
  }
}

/**
 * Compiles a search query with standard field parameters.
 */
export function compileSearchParams(query: string): Record<string, string> {
  validateQueryParenthesization(query);
  return {
    query,
    "tweet.fields": TWEET_FIELDS,
    "user.fields": USER_FIELDS,
    "media.fields": MEDIA_FIELDS,
    expansions: EXPANSIONS,
    max_results: "100",
  };
}

// === Rate Limit Tracking ===

const rateLimitState: Map<string, RateLimitState> = new Map();

export function updateRateLimitFromHeaders(
  endpoint: string,
  headers: Record<string, string>,
): RateLimitState {
  const state: RateLimitState = {
    endpoint,
    limit: parseInt(headers["x-rate-limit-limit"] || "0", 10),
    remaining: parseInt(headers["x-rate-limit-remaining"] || "0", 10),
    resetAt: parseInt(headers["x-rate-limit-reset"] || "0", 10),
  };
  rateLimitState.set(endpoint, state);
  return state;
}

export function getRateLimitState(endpoint: string): RateLimitState | undefined {
  return rateLimitState.get(endpoint);
}

export function isRateLimited(endpoint: string): boolean {
  const state = rateLimitState.get(endpoint);
  if (!state) return false;
  return state.remaining <= 0 && Date.now() / 1000 < state.resetAt;
}

export function getResetWaitMs(endpoint: string): number {
  const state = rateLimitState.get(endpoint);
  if (!state) return 0;
  const waitMs = (state.resetAt - Date.now() / 1000) * 1000;
  return Math.max(0, waitMs);
}

export function resetRateLimitState(): void {
  rateLimitState.clear();
}

// === Budget Estimation ===

export function estimateBudget(
  endpoint: string,
  estimatedRequests: number,
): RequestBudget {
  const state = rateLimitState.get(endpoint);
  const limits = RATE_LIMITS[endpoint];
  const remainingQuota = state?.remaining ?? limits?.limit ?? 0;
  const percentUsed = remainingQuota > 0 ? ((remainingQuota - estimatedRequests) / remainingQuota) * 100 : 100;

  return {
    endpoint,
    estimatedRequests,
    remainingQuota,
    percentUsed: Math.max(0, 100 - percentUsed),
    withinBudget: estimatedRequests <= remainingQuota,
  };
}

export function checkBudgetWarning(budget: RequestBudget): string | null {
  if (!budget.withinBudget) {
    return `Budget exceeded for ${budget.endpoint}: need ${budget.estimatedRequests}, have ${budget.remainingQuota}`;
  }
  if (budget.percentUsed > 80) {
    return `High usage for ${budget.endpoint}: ${budget.percentUsed.toFixed(0)}% of quota used`;
  }
  return null;
}

// === Response Parsing ===

export function parsePostsFromResponse(response: XApiResponse): XPost[] {
  if (!response.data) return [];
  return Array.isArray(response.data) ? response.data : [response.data];
}

export function buildMetadata(
  endpoint: string,
  posts: XPost[],
  response: XApiResponse,
  warnings: string[] = [],
): PartialResultMetadata {
  const state = rateLimitState.get(endpoint);
  return {
    endpoint,
    count: posts.length,
    has_more: !!response.meta?.next_token,
    rate_limit_remaining: state?.remaining ?? null,
    warnings,
    cost_estimate: 1, // Each request = 1 cost unit
  };
}

// === Deduplication ===

export function deduplicatePosts(posts: XPost[]): XPost[] {
  const seen = new Set<string>();
  return posts.filter((post) => {
    if (seen.has(post.id)) return false;
    seen.add(post.id);
    return true;
  });
}

/**
 * Cross-reference mentions with search results for completeness.
 * Returns deduplicated combined posts.
 */
export function crossReferencePosts(
  mentionPosts: XPost[],
  searchPosts: XPost[],
): { combined: XPost[]; mentionOnly: number; searchOnly: number; overlap: number } {
  const mentionIds = new Set(mentionPosts.map((p) => p.id));
  const searchIds = new Set(searchPosts.map((p) => p.id));
  const overlap = [...mentionIds].filter((id) => searchIds.has(id)).length;

  const combined = deduplicatePosts([...mentionPosts, ...searchPosts]);
  return {
    combined,
    mentionOnly: mentionPosts.length - overlap,
    searchOnly: searchPosts.length - overlap,
    overlap,
  };
}

// === Retry / Backoff ===

export function calculateBackoff(attempt: number, resetAt?: number): number {
  if (resetAt && resetAt > Date.now() / 1000) {
    return (resetAt - Date.now() / 1000) * 1000 + 1000; // Wait until reset + 1s buffer
  }
  // Exponential backoff: 1s, 2s, 4s
  return Math.min(1000 * Math.pow(2, attempt), 30000);
}

export const MAX_RETRIES = 3;
export const REQUEST_TIMEOUT_MS = 30000;

// === Degradation Reporting ===

export function createDegradationReport(
  endpoint: string,
  status: DegradationReport["status"],
  retries: number,
  error?: string,
  skippedReason?: string,
): DegradationReport {
  return {
    endpoint,
    status,
    error,
    retries,
    skipped_reason: skippedReason,
  };
}

// === URL Building ===

const X_API_BASE = "https://api.x.com/2";

export function buildUrl(path: string, params?: Record<string, string>): string {
  const url = new URL(`${X_API_BASE}/${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

export function buildMentionsUrl(userId: string, sinceId?: string): string {
  const params: Record<string, string> = {
    "tweet.fields": TWEET_FIELDS,
    "user.fields": USER_FIELDS,
    "media.fields": MEDIA_FIELDS,
    expansions: EXPANSIONS,
    max_results: "100",
  };
  if (sinceId) params.since_id = sinceId;
  return buildUrl(`users/${userId}/mentions`, params);
}

export function buildQuoteTweetsUrl(tweetId: string): string {
  return buildUrl(`tweets/${tweetId}/quote_tweets`, {
    "tweet.fields": TWEET_FIELDS,
    "user.fields": USER_FIELDS,
    expansions: EXPANSIONS,
    max_results: "100",
  });
}

export function buildUserLookupUrl(username: string): string {
  return buildUrl(`users/by/username/${username}`, {
    "user.fields": USER_FIELDS,
  });
}

export function buildSearchUrl(query: string, variant: "recent" | "all" = "recent", sinceId?: string): string {
  const params = compileSearchParams(query);
  if (sinceId) params.since_id = sinceId;
  const path = variant === "all" ? "tweets/search/all" : "tweets/search/recent";
  return buildUrl(path, params);
}

export function buildConversationSearchUrl(conversationId: string): string {
  return buildSearchUrl(`conversation_id:${conversationId}`);
}
