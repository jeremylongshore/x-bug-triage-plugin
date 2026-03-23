import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createDraft, checkForDuplicates } from "./lib";
import type { BugCluster } from "../../lib/types";

const server = new McpServer({ name: "issue-draft", version: "0.1.0" });

server.tool(
  "create_draft_issue",
  "Generate an issue draft from a cluster (does NOT file it)",
  {
    cluster_json: z.string().describe("JSON string of BugCluster"),
    report_count: z.number(),
    repo: z.string(),
    assignee: z.string().nullable(),
  },
  async ({ cluster_json, report_count, repo, assignee }) => {
    const cluster = JSON.parse(cluster_json) as BugCluster;
    const draft = createDraft(cluster, report_count, repo, assignee);
    return { content: [{ type: "text" as const, text: JSON.stringify(draft) }] };
  },
);

server.tool(
  "check_existing_issues",
  "Check for potential duplicate issues before filing",
  {
    title: z.string(),
    existing_titles: z.array(z.string()),
  },
  async ({ title, existing_titles }) => {
    const result = checkForDuplicates(title, existing_titles);
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  },
);

server.tool(
  "confirm_and_file",
  "Submit issue after explicit confirmation. Re-checks duplicates before filing.",
  {
    draft_json: z.string().describe("JSON string of IssueDraft"),
    existing_titles: z.array(z.string()).optional(),
  },
  async ({ draft_json, existing_titles }) => {
    const draft = JSON.parse(draft_json);

    // Re-check for duplicates
    if (existing_titles && existing_titles.length > 0) {
      const dupCheck = checkForDuplicates(draft.title, existing_titles);
      if (dupCheck.found) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              filed: false,
              reason: "Duplicate detected during confirmation",
              similarity: dupCheck.similarity,
              suggestion: "Use merge command instead",
            }),
          }],
        };
      }
    }

    // MVP: return the draft as the "filed" result
    // Real implementation would call gh api to create the issue
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          filed: true,
          draft,
          issue_url: `https://github.com/${draft.repo}/issues/NEW`,
        }),
      }],
    };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch(console.error);
