import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  validateApprovedQuery,
  buildUserLookupUrl,
  buildMentionsUrl,
  buildSearchUrl,
  buildConversationSearchUrl,
  buildQuoteTweetsUrl,
  parsePostsFromResponse,
  buildMetadata,
  deduplicatePosts,
  crossReferencePosts,
  updateRateLimitFromHeaders,
  isRateLimited,
  calculateBackoff,
  estimateBudget,
  checkBudgetWarning,
  createDegradationReport,
  MAX_RETRIES,
  REQUEST_TIMEOUT_MS,
} from "./lib";
import type { XApiResponse, XPost, XUser, DegradationReport, IntakeResult } from "./types";
import { loadApprovedSearches } from "../../lib/config";

const server = new McpServer({
  name: "x-intake",
  version: "0.1.0",
});

// Load bearer token from env
function getBearerToken(): string {
  const token = process.env.X_BEARER_TOKEN;
  if (!token) {
    throw new Error("X_BEARER_TOKEN not set. Configure in ~/.claude/channels/x-triage/.env");
  }
  return token;
}

// Generic fetch with auth, retry, timeout, and rate limit tracking
async function xApiFetch(
  url: string,
  endpoint: string,
): Promise<{ response: XApiResponse; headers: Record<string, string>; degradation: DegradationReport | null }> {
  const token = getBearerToken();

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (isRateLimited(endpoint)) {
      const waitMs = calculateBackoff(attempt);
      if (attempt < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      } else {
        return {
          response: { data: [] as XPost[] },
          headers: {},
          degradation: createDegradationReport(endpoint, "degraded", attempt, "Rate limited", "Max retries on 429"),
        };
      }
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const hdrs: Record<string, string> = {};
      res.headers.forEach((v, k) => { hdrs[k] = v; });
      updateRateLimitFromHeaders(endpoint, hdrs);

      if (res.status === 429) {
        if (attempt < MAX_RETRIES) {
          const waitMs = calculateBackoff(attempt, parseInt(hdrs["x-rate-limit-reset"] || "0", 10));
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          continue;
        }
        return {
          response: { data: [] as XPost[] },
          headers: hdrs,
          degradation: createDegradationReport(endpoint, "degraded", attempt, "429 Too Many Requests", "Max retries exhausted"),
        };
      }

      if (res.status === 401) {
        return {
          response: { data: [] as XPost[] },
          headers: hdrs,
          degradation: createDegradationReport(endpoint, "failed", attempt, "401 Unauthorized", "Auth failed — check X_BEARER_TOKEN"),
        };
      }

      if (res.status >= 500) {
        if (attempt < 1) {
          await new Promise((resolve) => setTimeout(resolve, 30000));
          continue;
        }
        return {
          response: { data: [] as XPost[] },
          headers: hdrs,
          degradation: createDegradationReport(endpoint, "degraded", attempt, `${res.status} Server Error`, "Server error after retry"),
        };
      }

      const json = (await res.json()) as XApiResponse;
      return { response: json, headers: hdrs, degradation: null };
    } catch (err) {
      if (attempt < 1) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        continue;
      }
      return {
        response: { data: [] as XPost[] },
        headers: {},
        degradation: createDegradationReport(
          endpoint,
          "failed",
          attempt,
          err instanceof Error ? err.message : "Unknown error",
          "Request failed after retry",
        ),
      };
    }
  }

  return {
    response: { data: [] as XPost[] },
    headers: {},
    degradation: createDegradationReport(endpoint, "failed", MAX_RETRIES, "Exhausted retries"),
  };
}

// Tool 1: resolve_username
server.tool(
  "resolve_username",
  "Resolve an X/Twitter username to a user ID",
  { username: z.string().describe("X username without @ prefix") },
  async ({ username }) => {
    const url = buildUserLookupUrl(username.replace(/^@/, ""));
    const { response, degradation } = await xApiFetch(url, "users/by/username");

    if (degradation) {
      return { content: [{ type: "text" as const, text: JSON.stringify({ error: degradation }) }] };
    }

    const user = (response.data as unknown) as XUser;
    return {
      content: [{ type: "text" as const, text: JSON.stringify({ user_id: user.id, username: user.username, name: user.name }) }],
    };
  },
);

// Tool 2: fetch_mentions
server.tool(
  "fetch_mentions",
  "Fetch mention timeline for a user ID (up to 800 posts)",
  {
    user_id: z.string().describe("X user ID"),
    since_id: z.string().optional().describe("Only return posts newer than this ID"),
    max_pages: z.number().optional().default(8).describe("Max pagination pages (100 per page, 800 cap)"),
  },
  async ({ user_id, since_id, max_pages }) => {
    const allPosts: XPost[] = [];
    const warnings: string[] = [];
    let nextToken: string | undefined;
    let pages = 0;

    while (pages < (max_pages ?? 8)) {
      let url = buildMentionsUrl(user_id, since_id);
      if (nextToken) url += `&pagination_token=${nextToken}`;

      const { response, degradation } = await xApiFetch(url, "users/:id/mentions");
      if (degradation) {
        warnings.push(`Degraded: ${degradation.error}`);
        break;
      }

      const posts = parsePostsFromResponse(response);
      allPosts.push(...posts);
      nextToken = response.meta?.next_token;
      pages++;

      if (!nextToken || allPosts.length >= 800) break;
    }

    if (allPosts.length >= 800) {
      warnings.push("Hit 800-post mention cap");
    }

    const metadata = buildMetadata("users/:id/mentions", allPosts, { data: allPosts, meta: { next_token: nextToken } }, warnings);
    const result: IntakeResult = { posts: allPosts, metadata };
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  },
);

// Tool 3: search_recent
server.tool(
  "search_recent",
  "Search recent tweets (7-day window) using an approved query",
  {
    query_name: z.string().describe("Name from approved-searches.json"),
    since_id: z.string().optional().describe("Only return posts newer than this ID"),
    max_pages: z.number().optional().default(3).describe("Max pagination pages"),
  },
  async ({ query_name, since_id, max_pages }) => {
    const searches = loadApprovedSearches();
    const approved = validateApprovedQuery(query_name, searches.searches);

    const allPosts: XPost[] = [];
    const warnings: string[] = [];
    let nextToken: string | undefined;
    let pages = 0;

    while (pages < (max_pages ?? 3)) {
      let url = buildSearchUrl(approved.query, "recent", since_id);
      if (nextToken) url += `&next_token=${nextToken}`;

      const { response, degradation } = await xApiFetch(url, "tweets/search/recent");
      if (degradation) {
        warnings.push(`Degraded: ${degradation.error}`);
        break;
      }

      const posts = parsePostsFromResponse(response);
      allPosts.push(...posts);
      nextToken = response.meta?.next_token;
      pages++;

      if (!nextToken) break;
    }

    const metadata = buildMetadata("tweets/search/recent", allPosts, { data: allPosts, meta: { next_token: nextToken } }, warnings);
    const result: IntakeResult = { posts: allPosts, metadata };
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  },
);

// Tool 4: search_archive
server.tool(
  "search_archive",
  "Search full tweet archive using an approved query (bounded for MVP)",
  {
    query_name: z.string().describe("Name from approved-searches.json"),
    since_id: z.string().optional(),
    max_pages: z.number().optional().default(2),
  },
  async ({ query_name, since_id, max_pages }) => {
    const searches = loadApprovedSearches();
    const approved = validateApprovedQuery(query_name, searches.searches);

    const allPosts: XPost[] = [];
    const warnings: string[] = [];
    let nextToken: string | undefined;
    let pages = 0;

    while (pages < (max_pages ?? 2)) {
      let url = buildSearchUrl(approved.query, "all", since_id);
      if (nextToken) url += `&next_token=${nextToken}`;

      const { response, degradation } = await xApiFetch(url, "tweets/search/all");
      if (degradation) {
        warnings.push(`Degraded: ${degradation.error}`);
        break;
      }

      allPosts.push(...parsePostsFromResponse(response));
      nextToken = response.meta?.next_token;
      pages++;
      if (!nextToken) break;
    }

    const metadata = buildMetadata("tweets/search/all", allPosts, { data: allPosts, meta: { next_token: nextToken } }, warnings);
    return { content: [{ type: "text" as const, text: JSON.stringify({ posts: allPosts, metadata }) }] };
  },
);

// Tool 5: fetch_conversation
server.tool(
  "fetch_conversation",
  "Retrieve a full conversation thread by conversation_id",
  { conversation_id: z.string().describe("X conversation ID") },
  async ({ conversation_id }) => {
    const allPosts: XPost[] = [];
    const warnings: string[] = [];
    let nextToken: string | undefined;

    // Use search to find all posts in the conversation
    for (let page = 0; page < 5; page++) {
      let url = buildConversationSearchUrl(conversation_id);
      if (nextToken) url += `&next_token=${nextToken}`;

      const { response, degradation } = await xApiFetch(url, "tweets/search/recent");
      if (degradation) {
        warnings.push(`Degraded: ${degradation.error}`);
        break;
      }

      allPosts.push(...parsePostsFromResponse(response));
      nextToken = response.meta?.next_token;
      if (!nextToken) break;
    }

    const metadata = buildMetadata("tweets/search/recent", allPosts, { data: allPosts }, warnings);
    return { content: [{ type: "text" as const, text: JSON.stringify({ posts: deduplicatePosts(allPosts), metadata }) }] };
  },
);

// Tool 6: fetch_quote_tweets
server.tool(
  "fetch_quote_tweets",
  "Fetch quote tweets for a specific tweet",
  { tweet_id: z.string().describe("X tweet ID to find quotes for") },
  async ({ tweet_id }) => {
    const url = buildQuoteTweetsUrl(tweet_id);
    const { response, degradation } = await xApiFetch(url, "tweets/:id/quote_tweets");

    if (degradation) {
      return { content: [{ type: "text" as const, text: JSON.stringify({ posts: [], metadata: { endpoint: "tweets/:id/quote_tweets", count: 0, has_more: false, rate_limit_remaining: null, warnings: [degradation.error || "Degraded"], cost_estimate: 1 } }) }] };
    }

    const posts = parsePostsFromResponse(response);
    const metadata = buildMetadata("tweets/:id/quote_tweets", posts, response);
    return { content: [{ type: "text" as const, text: JSON.stringify({ posts, metadata }) }] };
  },
);

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
