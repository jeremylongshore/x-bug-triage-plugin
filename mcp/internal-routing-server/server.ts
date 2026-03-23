import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { isStale, buildRoutingRecommendation } from "./lib";
import type { RoutingResult } from "./types";

const server = new McpServer({ name: "internal-routing", version: "0.1.0" });

server.tool(
  "lookup_service_owner",
  "Look up active service/component ownership metadata (Level 1)",
  { repo: z.string(), surface: z.string().optional() },
  async ({ repo, surface }) => {
    // MVP: placeholder — real implementation would query ownership DB/API
    const result: RoutingResult = {
      level: 1,
      source: "service_owner",
      team: undefined,
      confidence: 1.0,
      stale: false,
    };
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  },
);

server.tool(
  "lookup_oncall",
  "Look up current oncall/escalation metadata (Level 2)",
  { repo: z.string() },
  async ({ repo }) => {
    const result: RoutingResult = {
      level: 2,
      source: "oncall",
      team: undefined,
      confidence: 0.9,
      stale: false,
    };
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  },
);

server.tool(
  "parse_codeowners",
  "Parse CODEOWNERS file for affected paths (Level 3)",
  { repo: z.string(), paths: z.array(z.string()).optional() },
  async ({ repo, paths }) => {
    const result: RoutingResult = {
      level: 3,
      source: "codeowners",
      team: undefined,
      confidence: 0.8,
      stale: false,
    };
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  },
);

server.tool(
  "lookup_recent_assignees",
  "Look up issue/PR assignees in last 30 days (Level 4)",
  { repo: z.string() },
  async ({ repo }) => {
    const result: RoutingResult = {
      level: 4,
      source: "recent_assignees",
      team: undefined,
      confidence: 0.6,
      stale: false,
    };
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  },
);

server.tool(
  "lookup_recent_committers",
  "Look up committers to affected paths in last 14 days (Level 5)",
  { repo: z.string(), paths: z.array(z.string()).optional() },
  async ({ repo, paths }) => {
    const result: RoutingResult = {
      level: 5,
      source: "recent_committers",
      team: undefined,
      confidence: 0.5,
      stale: false,
    };
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch(console.error);
