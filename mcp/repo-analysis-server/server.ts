import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { rankRepos, assignEvidenceTier, createDegradedScanResult, sortEvidenceByTier } from "./lib";
import type { RepoEvidence, RepoScanResult } from "./types";

const server = new McpServer({ name: "repo-analysis", version: "0.1.0" });

server.tool(
  "search_issues",
  "Search GitHub issues matching symptoms/error strings",
  {
    repo: z.string().describe("owner/repo"),
    symptoms: z.array(z.string()),
    error_strings: z.array(z.string()),
  },
  async ({ repo, symptoms, error_strings }) => {
    // MVP: returns structured result; actual GitHub API calls would go here
    const evidence: RepoEvidence[] = [];
    const searchTerms = [...symptoms, ...error_strings].slice(0, 5);
    for (const term of searchTerms) {
      evidence.push({
        repo,
        evidenceType: "issue_match",
        tier: assignEvidenceTier("issue_match", 0.6),
        title: `Potential match for: ${term}`,
        description: `Search for "${term}" in ${repo} issues`,
        confidence: 0.6,
      });
    }
    return { content: [{ type: "text" as const, text: JSON.stringify(sortEvidenceByTier(evidence)) }] };
  },
);

server.tool(
  "inspect_recent_commits",
  "Inspect commits/PRs in the last 7 days for affected paths",
  {
    repo: z.string(),
    paths: z.array(z.string()).optional(),
  },
  async ({ repo, paths }) => {
    const evidence: RepoEvidence[] = [{
      repo,
      evidenceType: "recent_commit",
      tier: assignEvidenceTier("recent_commit", 0.5),
      title: "Recent commit scan",
      description: `Scanned ${repo} commits in last 7 days${paths ? ` for paths: ${paths.join(", ")}` : ""}`,
      confidence: 0.5,
    }];
    return { content: [{ type: "text" as const, text: JSON.stringify(evidence) }] };
  },
);

server.tool(
  "inspect_code_paths",
  "Inspect likely affected code paths from surface-repo mapping",
  {
    repo: z.string(),
    surface: z.string(),
    feature_area: z.string().optional(),
  },
  async ({ repo, surface, feature_area }) => {
    const evidence: RepoEvidence[] = [{
      repo,
      evidenceType: "affected_path",
      tier: assignEvidenceTier("affected_path", 0.5),
      title: `Path analysis for ${surface}${feature_area ? `/${feature_area}` : ""}`,
      description: `Inspected code paths in ${repo} for surface ${surface}`,
      confidence: 0.5,
    }];
    return { content: [{ type: "text" as const, text: JSON.stringify(evidence) }] };
  },
);

server.tool(
  "check_recent_deploys",
  "Check recent deploy/release tags correlated with report timing",
  {
    repo: z.string(),
    since: z.string().optional().describe("ISO 8601 timestamp"),
  },
  async ({ repo, since }) => {
    const evidence: RepoEvidence[] = [{
      repo,
      evidenceType: "recent_deploy",
      tier: assignEvidenceTier("recent_deploy", 0.4),
      title: "Deploy check",
      description: `Checked ${repo} deploys${since ? ` since ${since}` : " in last 7 days"}`,
      confidence: 0.4,
    }];
    return { content: [{ type: "text" as const, text: JSON.stringify(evidence) }] };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch(console.error);
