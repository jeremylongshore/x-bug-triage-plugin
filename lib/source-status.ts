/**
 * Aggregates DegradationReport and RateLimitState into a visible
 * per-source status header for the triage display.
 */

import type { DegradationReport, RateLimitState } from "../mcp/triage-server/types";

export interface SourceStatus {
  name: string;
  status: "ok" | "degraded" | "failed";
  post_count: number | null;
  error: string | null;
  rate_limit_display: string | null;
}

export interface SourceStatusReport {
  sources: SourceStatus[];
  all_healthy: boolean;
  any_failed: boolean;
}

/**
 * Build a consolidated source status report from per-endpoint
 * degradation reports and rate limit states.
 *
 * @param degradations - Array of DegradationReport from each intake endpoint (null entries = succeeded)
 * @param rateLimits - Map of endpoint to current RateLimitState
 * @param postCounts - Map of source name to post count
 */
export function buildSourceStatusReport(
  degradations: Array<{ name: string; report: DegradationReport | null }>,
  rateLimits: Map<string, RateLimitState>,
  postCounts: Map<string, number>,
): SourceStatusReport {
  const sources: SourceStatus[] = degradations.map(({ name, report }) => {
    const rl = rateLimits.get(name);
    const count = postCounts.get(name) ?? null;

    if (!report || report.status === "succeeded") {
      return {
        name,
        status: "ok" as const,
        post_count: count,
        error: null,
        rate_limit_display: rl ? `${rl.remaining}/${rl.limit}` : null,
      };
    }

    return {
      name,
      status: report.status,
      post_count: count,
      error: report.error || report.skipped_reason || null,
      rate_limit_display: rl ? `${rl.remaining}/${rl.limit}` : "---",
    };
  });

  return {
    sources,
    all_healthy: sources.every((s) => s.status === "ok"),
    any_failed: sources.some((s) => s.status === "failed"),
  };
}

/**
 * Format the source status report as a terminal-ready string.
 */
export function formatSourceStatusBlock(report: SourceStatusReport): string {
  const lines = ["--- Sources ---"];
  for (const s of report.sources) {
    const statusPad = s.status.padEnd(8);
    const countStr = s.post_count !== null ? `${s.post_count} posts` : s.error || "---";
    const rlStr = s.rate_limit_display ? `(rate limit: ${s.rate_limit_display})` : "";
    lines.push(`${s.name.padEnd(18)} ${statusPad}  ${countStr.padEnd(12)} ${rlStr}`);
  }
  return lines.join("\n");
}
