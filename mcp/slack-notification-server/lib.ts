import type { SlackClusterSummary, ParsedCommand } from "./types";

const SEVERITY_ICONS: Record<string, string> = {
  critical: "🔴",
  high: "🔴",
  medium: "🟡",
  low: "🟢",
};

const VALID_COMMANDS = ["details", "file", "dismiss", "merge", "escalate", "monitor", "snooze", "split", "reroute", "full-report", "confirm"];

export function formatTriageSummary(
  date: string,
  time: string,
  account: string,
  window: string,
  postCount: number,
  clusters: SlackClusterSummary[],
  maxClusters: number = 5,
): string {
  const lines: string[] = [];
  lines.push(`🔍 X Bug Triage — Run ${date} ${time} UTC`);
  lines.push(`   Account: @${account} · Window: last ${window} · ${postCount} posts ingested`);
  lines.push("");

  const newCount = clusters.filter((c) => c.statusNote.includes("new")).length;
  const existingCount = clusters.length - newCount;
  lines.push(`━━━ ${clusters.length} clusters (${newCount} new, ${existingCount} existing) ━━━`);
  lines.push("");

  const display = clusters.length > maxClusters ? clusters.slice(0, maxClusters) : clusters;
  for (const c of display) {
    const icon = SEVERITY_ICONS[c.severity] || "⚪";
    lines.push(`${icon} ${c.number} · ${c.signature}`);
    lines.push(`     ${c.reportCount} reports · ${c.severity} severity · ${c.statusNote}`);
    lines.push(`     Owner: ${c.team || "unassigned"}`);
    if (c.topEvidence) {
      lines.push(`     Top evidence: ${c.topEvidence} (Tier ${c.evidenceTier})`);
    }
    lines.push("");
  }

  if (clusters.length > maxClusters) {
    lines.push(`${clusters.length - maxClusters} more — reply \`full-report\``);
    lines.push("");
  }

  lines.push("━━━ Commands ━━━");
  lines.push("details <#>  ·  file <#>  ·  dismiss <#>  ·  merge <#> <issue>");
  lines.push("escalate <#>  ·  monitor <#>  ·  snooze <#> <duration>");
  lines.push("split <#>  ·  reroute <#>  ·  full-report");

  return lines.join("\n");
}

export function formatClusterDetails(
  cluster: SlackClusterSummary & {
    family: string;
    surface: string;
    featureArea: string;
    confidence: number;
    severityRationale: string;
    timeRange: string;
    evidence: Array<{ tier: number; description: string }>;
    representativePosts: Array<{ text: string; author: string; quality: number }>;
    routing: Array<{ team: string; source: string; confidence: number }>;
  },
): string {
  const icon = SEVERITY_ICONS[cluster.severity] || "⚪";
  const lines: string[] = [];
  lines.push(`${icon} Cluster ${cluster.number} — ${cluster.signature}`);
  lines.push(`Family: ${cluster.family} · Surface: ${cluster.surface} · Feature: ${cluster.featureArea}`);
  lines.push(`Reports: ${cluster.reportCount} · Confidence: ${(cluster.confidence * 100).toFixed(0)}%`);
  lines.push(`Severity: ${cluster.severity} — ${cluster.severityRationale}`);
  lines.push(`Time range: ${cluster.timeRange}`);
  lines.push("");

  lines.push("Evidence:");
  for (const e of cluster.evidence) {
    lines.push(`  Tier ${e.tier}: ${e.description}`);
  }
  lines.push("");

  lines.push("Representative posts:");
  for (const p of cluster.representativePosts.slice(0, 3)) {
    lines.push(`  @${p.author}: "${p.text.slice(0, 100)}${p.text.length > 100 ? "..." : ""}"`);
  }
  lines.push("");

  lines.push("Routing:");
  for (const r of cluster.routing) {
    lines.push(`  ${r.team} (${r.source}, ${(r.confidence * 100).toFixed(0)}%)`);
  }

  return lines.join("\n");
}

export function parseReviewCommand(text: string): ParsedCommand {
  const trimmed = text.trim().toLowerCase();

  if (trimmed === "full-report") {
    return { command: "full-report", valid: true };
  }

  // "confirm file <#>"
  const confirmMatch = trimmed.match(/^confirm\s+file\s+(\d+)$/);
  if (confirmMatch) {
    return { command: "confirm file", clusterNumber: parseInt(confirmMatch[1], 10), valid: true };
  }

  // "<command> <#> [args]"
  const cmdMatch = trimmed.match(/^(\w+(?:-\w+)?)\s+(\d+)(?:\s+(.+))?$/);
  if (cmdMatch) {
    const [, cmd, num, args] = cmdMatch;
    if (VALID_COMMANDS.includes(cmd)) {
      return { command: cmd, clusterNumber: parseInt(num, 10), args, valid: true };
    }
    return { command: cmd, valid: false, error: `Available commands: ${VALID_COMMANDS.join(", ")}` };
  }

  // Just a command name without number
  const singleCmd = trimmed.match(/^(\w+(?:-\w+)?)$/);
  if (singleCmd && VALID_COMMANDS.includes(singleCmd[1]) && singleCmd[1] !== "full-report") {
    return { command: singleCmd[1], valid: false, error: "Which cluster?" };
  }

  return { command: trimmed, valid: false, error: `Available commands: ${VALID_COMMANDS.join(", ")}` };
}

export function formatEscalation(
  clusterNumber: number,
  signature: string,
  severity: string,
  triggerType: string,
  evidence: string,
): string {
  const icon = SEVERITY_ICONS[severity] || "⚪";
  return [
    `${icon} ESCALATION — Cluster ${clusterNumber}`,
    `Signature: ${signature}`,
    `Severity: ${severity}`,
    `Trigger: ${triggerType}`,
    `Evidence: ${evidence}`,
  ].join("\n");
}

export function formatIssueDraft(
  clusterNumber: number,
  title: string,
  labels: string[],
  priority: string,
  assignee: string | null,
  body: string,
): string {
  return [
    `📋 Issue Draft — Cluster ${clusterNumber}`,
    "",
    `Title: ${title}`,
    `Labels: ${labels.join(", ")}`,
    `Priority: ${priority}`,
    `Assignee: ${assignee || "unassigned"}`,
    "",
    "Body:",
    body,
    "",
    "Reply `confirm file ${clusterNumber}` to file this issue.",
  ].join("\n");
}
