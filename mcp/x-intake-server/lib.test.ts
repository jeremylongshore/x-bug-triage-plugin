import { describe, test, expect, beforeEach } from "bun:test";
import {
  validateApprovedQuery,
  validateQueryParenthesization,
  compileSearchParams,
  updateRateLimitFromHeaders,
  getRateLimitState,
  isRateLimited,
  getResetWaitMs,
  resetRateLimitState,
  estimateBudget,
  checkBudgetWarning,
  parsePostsFromResponse,
  buildMetadata,
  deduplicatePosts,
  crossReferencePosts,
  calculateBackoff,
  buildUrl,
  buildMentionsUrl,
  buildUserLookupUrl,
  buildSearchUrl,
  buildConversationSearchUrl,
  buildQuoteTweetsUrl,
  createDegradationReport,
} from "./lib";
import type { XPost, XApiResponse, ApprovedSearch } from "./types";

const APPROVED_SEARCHES: ApprovedSearch[] = [
  { name: "claude-bugs", query: '("claude" OR "anthropic") (broken OR bug OR error OR crash)', description: "Claude product bugs" },
  { name: "api-issues", query: '("claude api" OR "anthropic api") (error OR timeout OR 500)', description: "API issues" },
];

function makePost(overrides: Partial<XPost> = {}): XPost {
  return {
    id: Math.random().toString(36).slice(2),
    text: "Test post",
    author_id: "123",
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

// === Query Compiler Tests ===

describe("query validation", () => {
  test("validates approved query", () => {
    const result = validateApprovedQuery("claude-bugs", APPROVED_SEARCHES);
    expect(result.name).toBe("claude-bugs");
    expect(result.query).toContain("claude");
  });

  test("rejects unapproved query", () => {
    expect(() => validateApprovedQuery("hacker-tools", APPROVED_SEARCHES)).toThrow(
      'Query "hacker-tools" is not in approved-searches.json',
    );
  });

  test("lists available queries in error", () => {
    try {
      validateApprovedQuery("nope", APPROVED_SEARCHES);
    } catch (e: unknown) {
      expect((e as Error).message).toContain("claude-bugs");
      expect((e as Error).message).toContain("api-issues");
    }
  });
});

describe("query parenthesization", () => {
  test("accepts fully parenthesized OR groups", () => {
    expect(() =>
      validateQueryParenthesization('("claude" OR "anthropic") broken'),
    ).not.toThrow();
  });

  test("accepts queries without OR", () => {
    expect(() =>
      validateQueryParenthesization("claude broken bug"),
    ).not.toThrow();
  });

  test("rejects unparenthesized OR groups", () => {
    expect(() =>
      validateQueryParenthesization('"claude" OR "anthropic" broken'),
    ).toThrow("unparenthesized OR");
  });

  test("accepts nested parenthesized ORs", () => {
    expect(() =>
      validateQueryParenthesization('("a" OR "b") ("c" OR "d")'),
    ).not.toThrow();
  });
});

describe("compileSearchParams", () => {
  test("includes all field expansions", () => {
    const params = compileSearchParams("test query");
    expect(params.query).toBe("test query");
    expect(params["tweet.fields"]).toContain("id");
    expect(params["tweet.fields"]).toContain("public_metrics");
    expect(params["user.fields"]).toContain("username");
    expect(params["media.fields"]).toContain("media_key");
    expect(params.expansions).toContain("author_id");
  });
});

// === Rate Limit Tests ===

describe("rate limiting", () => {
  beforeEach(() => resetRateLimitState());

  test("tracks rate limit from headers", () => {
    updateRateLimitFromHeaders("tweets/search/recent", {
      "x-rate-limit-limit": "300",
      "x-rate-limit-remaining": "250",
      "x-rate-limit-reset": String(Math.floor(Date.now() / 1000) + 900),
    });
    const state = getRateLimitState("tweets/search/recent");
    expect(state).toBeDefined();
    expect(state!.limit).toBe(300);
    expect(state!.remaining).toBe(250);
  });

  test("detects rate limited state", () => {
    updateRateLimitFromHeaders("tweets/search/recent", {
      "x-rate-limit-limit": "300",
      "x-rate-limit-remaining": "0",
      "x-rate-limit-reset": String(Math.floor(Date.now() / 1000) + 900),
    });
    expect(isRateLimited("tweets/search/recent")).toBe(true);
  });

  test("not rate limited when quota remaining", () => {
    updateRateLimitFromHeaders("tweets/search/recent", {
      "x-rate-limit-limit": "300",
      "x-rate-limit-remaining": "100",
      "x-rate-limit-reset": String(Math.floor(Date.now() / 1000) + 900),
    });
    expect(isRateLimited("tweets/search/recent")).toBe(false);
  });

  test("not rate limited after reset time", () => {
    updateRateLimitFromHeaders("tweets/search/recent", {
      "x-rate-limit-limit": "300",
      "x-rate-limit-remaining": "0",
      "x-rate-limit-reset": String(Math.floor(Date.now() / 1000) - 10),
    });
    expect(isRateLimited("tweets/search/recent")).toBe(false);
  });
});

// === Budget Tests ===

describe("budget estimation", () => {
  beforeEach(() => resetRateLimitState());

  test("within budget when quota sufficient", () => {
    updateRateLimitFromHeaders("tweets/search/recent", {
      "x-rate-limit-limit": "300",
      "x-rate-limit-remaining": "200",
      "x-rate-limit-reset": "0",
    });
    const budget = estimateBudget("tweets/search/recent", 10);
    expect(budget.withinBudget).toBe(true);
  });

  test("over budget when quota insufficient", () => {
    updateRateLimitFromHeaders("tweets/search/recent", {
      "x-rate-limit-limit": "300",
      "x-rate-limit-remaining": "5",
      "x-rate-limit-reset": "0",
    });
    const budget = estimateBudget("tweets/search/recent", 10);
    expect(budget.withinBudget).toBe(false);
  });

  test("warns at high usage", () => {
    updateRateLimitFromHeaders("tweets/search/recent", {
      "x-rate-limit-limit": "300",
      "x-rate-limit-remaining": "50",
      "x-rate-limit-reset": "0",
    });
    const budget = estimateBudget("tweets/search/recent", 45);
    const warning = checkBudgetWarning(budget);
    expect(warning).toContain("High usage");
  });
});

// === Response Parsing Tests ===

describe("response parsing", () => {
  test("parses array of posts", () => {
    const response: XApiResponse = {
      data: [makePost({ id: "1" }), makePost({ id: "2" })],
    };
    const posts = parsePostsFromResponse(response);
    expect(posts.length).toBe(2);
  });

  test("handles empty response", () => {
    const response: XApiResponse = { data: [] };
    const posts = parsePostsFromResponse(response);
    expect(posts.length).toBe(0);
  });

  test("builds metadata correctly", () => {
    const posts = [makePost()];
    const response: XApiResponse = { data: posts, meta: { next_token: "abc" } };
    const metadata = buildMetadata("tweets/search/recent", posts, response, ["test warning"]);
    expect(metadata.endpoint).toBe("tweets/search/recent");
    expect(metadata.count).toBe(1);
    expect(metadata.has_more).toBe(true);
    expect(metadata.warnings).toEqual(["test warning"]);
  });
});

// === Deduplication Tests ===

describe("deduplication", () => {
  test("removes duplicate posts by id", () => {
    const posts = [makePost({ id: "1" }), makePost({ id: "2" }), makePost({ id: "1" })];
    const deduped = deduplicatePosts(posts);
    expect(deduped.length).toBe(2);
  });

  test("cross-references mentions and search", () => {
    const mentions = [makePost({ id: "1" }), makePost({ id: "2" }), makePost({ id: "3" })];
    const search = [makePost({ id: "2" }), makePost({ id: "4" })];
    const result = crossReferencePosts(mentions, search);
    expect(result.combined.length).toBe(4);
    expect(result.overlap).toBe(1);
    expect(result.mentionOnly).toBe(2);
    expect(result.searchOnly).toBe(1);
  });
});

// === Backoff Tests ===

describe("backoff calculation", () => {
  test("exponential backoff increases", () => {
    const b0 = calculateBackoff(0);
    const b1 = calculateBackoff(1);
    const b2 = calculateBackoff(2);
    expect(b1).toBeGreaterThan(b0);
    expect(b2).toBeGreaterThan(b1);
  });

  test("uses reset time when available", () => {
    const futureReset = Date.now() / 1000 + 60;
    const backoff = calculateBackoff(0, futureReset);
    expect(backoff).toBeGreaterThan(50000); // > 50 seconds
  });

  test("caps at 30 seconds for exponential", () => {
    const backoff = calculateBackoff(10);
    expect(backoff).toBeLessThanOrEqual(30000);
  });
});

// === URL Building Tests ===

describe("URL building", () => {
  test("builds user lookup URL", () => {
    const url = buildUserLookupUrl("testuser");
    expect(url).toContain("users/by/username/testuser");
    expect(url).toContain("user.fields=");
  });

  test("builds mentions URL with since_id", () => {
    const url = buildMentionsUrl("12345", "67890");
    expect(url).toContain("users/12345/mentions");
    expect(url).toContain("since_id=67890");
  });

  test("builds search URL", () => {
    const url = buildSearchUrl("test query", "recent");
    expect(url).toContain("tweets/search/recent");
    expect(url).toContain("query=");
  });

  test("builds conversation search URL", () => {
    const url = buildConversationSearchUrl("conv123");
    expect(url).toContain("conversation_id%3Aconv123");
  });

  test("builds quote tweets URL", () => {
    const url = buildQuoteTweetsUrl("tweet123");
    expect(url).toContain("tweets/tweet123/quote_tweets");
  });
});

// === Degradation Report Tests ===

describe("degradation reporting", () => {
  test("creates degraded report", () => {
    const report = createDegradationReport("tweets/search/recent", "degraded", 3, "429 Too Many Requests", "Max retries");
    expect(report.status).toBe("degraded");
    expect(report.retries).toBe(3);
    expect(report.error).toContain("429");
  });

  test("creates failed report", () => {
    const report = createDegradationReport("users/by/username", "failed", 0, "401 Unauthorized");
    expect(report.status).toBe("failed");
  });
});
