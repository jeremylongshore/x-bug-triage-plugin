import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { formatTriageSummary, formatClusterDetails, parseReviewCommand, formatEscalation, formatIssueDraft } from "./lib";

const server = new McpServer({ name: "slack-notification", version: "0.1.0" });

server.tool(
  "format_triage_summary",
  "Format triage results as Slack mrkdwn summary",
  {
    date: z.string(),
    time: z.string(),
    account: z.string(),
    window: z.string(),
    post_count: z.number(),
    clusters: z.array(z.object({
      number: z.number(),
      signature: z.string(),
      reportCount: z.number(),
      severity: z.string(),
      statusNote: z.string(),
      team: z.string().nullable(),
      topEvidence: z.string().nullable(),
      evidenceTier: z.number().nullable(),
    })),
  },
  async ({ date, time, account, window, post_count, clusters }) => {
    const text = formatTriageSummary(date, time, account, window, post_count, clusters);
    return { content: [{ type: "text" as const, text }] };
  },
);

server.tool(
  "parse_review_command",
  "Parse an inbound Slack message into a structured review command",
  { message_text: z.string() },
  async ({ message_text }) => {
    const parsed = parseReviewCommand(message_text);
    return { content: [{ type: "text" as const, text: JSON.stringify(parsed) }] };
  },
);

server.tool(
  "format_cluster_details",
  "Format full cluster detail view as Slack mrkdwn",
  { cluster_json: z.string().describe("JSON string of cluster detail object") },
  async ({ cluster_json }) => {
    const cluster = JSON.parse(cluster_json);
    const text = formatClusterDetails(cluster);
    return { content: [{ type: "text" as const, text }] };
  },
);

server.tool(
  "format_escalation",
  "Format escalation alert as Slack mrkdwn",
  {
    cluster_number: z.number(),
    signature: z.string(),
    severity: z.string(),
    trigger_type: z.string(),
    evidence: z.string(),
  },
  async ({ cluster_number, signature, severity, trigger_type, evidence }) => {
    const text = formatEscalation(cluster_number, signature, severity, trigger_type, evidence);
    return { content: [{ type: "text" as const, text }] };
  },
);

server.tool(
  "format_issue_draft",
  "Format issue draft preview as Slack mrkdwn",
  {
    cluster_number: z.number(),
    title: z.string(),
    labels: z.array(z.string()),
    priority: z.string(),
    assignee: z.string().nullable(),
    body: z.string(),
  },
  async ({ cluster_number, title, labels, priority, assignee, body }) => {
    const text = formatIssueDraft(cluster_number, title, labels, priority, assignee, body);
    return { content: [{ type: "text" as const, text }] };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch(console.error);
