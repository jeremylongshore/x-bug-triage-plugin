import type { IssueDraft, DuplicateCheck } from "./types";
import type { BugCluster } from "../../lib/types";

export function generateDraftTitle(cluster: BugCluster, reportCount: number): string {
  const surface = cluster.product_surface ? `[${cluster.product_surface}]` : "";
  const symptom = cluster.title || cluster.bug_signature.split("|").slice(2).join(", ").slice(0, 80);
  return `${surface} ${symptom} — ${reportCount} public reports`.trim();
}

export function generateDraftLabels(cluster: BugCluster): string[] {
  const labels = ["bug"];
  if (cluster.feature_area) labels.push(cluster.feature_area);
  if (cluster.product_surface) labels.push(cluster.product_surface);
  return labels;
}

export function generateDraftBody(cluster: BugCluster, reportCount: number): string {
  const lines: string[] = [];
  lines.push(`${reportCount} public reports on X describe ${cluster.title || cluster.bug_signature}.`);
  lines.push("");
  lines.push(`**Surface:** ${cluster.product_surface || "unknown"}`);
  lines.push(`**Feature area:** ${cluster.feature_area || "unknown"}`);
  lines.push(`**Severity:** ${cluster.severity}`);
  if (cluster.severity_rationale) lines.push(`**Severity rationale:** ${cluster.severity_rationale}`);
  lines.push(`**Family:** ${cluster.cluster_family}`);
  lines.push(`**First seen:** ${cluster.first_seen}`);
  lines.push(`**Last seen:** ${cluster.last_seen}`);
  lines.push("");
  lines.push("---");
  lines.push("*Filed via x-bug-triage-plugin from public X complaint analysis.*");
  return lines.join("\n");
}

export function createDraft(cluster: BugCluster, reportCount: number, repo: string, assignee: string | null): IssueDraft {
  return {
    cluster_id: cluster.cluster_id,
    title: generateDraftTitle(cluster, reportCount),
    labels: generateDraftLabels(cluster),
    priority: cluster.severity,
    assignee_suggestion: assignee,
    body: generateDraftBody(cluster, reportCount),
    repo,
  };
}

export function checkForDuplicates(title: string, existingTitles: string[]): DuplicateCheck {
  for (const existing of existingTitles) {
    const similarity = calculateTitleSimilarity(title, existing);
    if (similarity > 0.8) {
      return { found: true, similarity };
    }
  }
  return { found: false, similarity: 0 };
}

function calculateTitleSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/));
  const wordsB = new Set(b.toLowerCase().split(/\s+/));
  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }
  const union = new Set([...wordsA, ...wordsB]).size;
  return union > 0 ? intersection / union : 0;
}
