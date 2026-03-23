import { describe, test, expect } from "bun:test";
import { formatTriageSummary, parseReviewCommand, formatEscalation, formatIssueDraft } from "./lib";
import type { SlackClusterSummary } from "./types";

function makeSummary(n: number, overrides: Partial<SlackClusterSummary> = {}): SlackClusterSummary {
  return {
    number: n,
    signature: `web_app:chat:Error 500:crash`,
    reportCount: 5,
    severity: "medium",
    statusNote: "new",
    team: "platform-team",
    topEvidence: "Error string match",
    evidenceTier: 1,
    ...overrides,
  };
}

describe("slack-notification", () => {
  test("formats summary for ≤5 clusters", () => {
    const summary = formatTriageSummary("2026-03-23", "10:00", "TestProduct", "24h", 100, [
      makeSummary(1),
      makeSummary(2, { severity: "high" }),
    ]);
    expect(summary).toContain("🔍 X Bug Triage");
    expect(summary).toContain("100 posts ingested");
    expect(summary).toContain("2 clusters");
    expect(summary).not.toContain("more — reply");
  });

  test("truncates to top 5 for >5 clusters", () => {
    const clusters = Array.from({ length: 8 }, (_, i) => makeSummary(i + 1));
    const summary = formatTriageSummary("2026-03-23", "10:00", "TestProduct", "24h", 200, clusters);
    expect(summary).toContain("3 more — reply `full-report`");
  });

  test("parses details command", () => {
    const cmd = parseReviewCommand("details 3");
    expect(cmd.valid).toBe(true);
    expect(cmd.command).toBe("details");
    expect(cmd.clusterNumber).toBe(3);
  });

  test("parses file command", () => {
    const cmd = parseReviewCommand("file 1");
    expect(cmd.valid).toBe(true);
    expect(cmd.command).toBe("file");
  });

  test("parses confirm file command", () => {
    const cmd = parseReviewCommand("confirm file 2");
    expect(cmd.valid).toBe(true);
    expect(cmd.command).toBe("confirm file");
    expect(cmd.clusterNumber).toBe(2);
  });

  test("parses dismiss with reason", () => {
    const cmd = parseReviewCommand("dismiss 3 false positive");
    expect(cmd.valid).toBe(true);
    expect(cmd.command).toBe("dismiss");
    expect(cmd.args).toBe("false positive");
  });

  test("parses merge with issue", () => {
    const cmd = parseReviewCommand("merge 1 ISSUE-42");
    expect(cmd.valid).toBe(true);
    expect(cmd.args).toBe("issue-42");
  });

  test("parses snooze with duration", () => {
    const cmd = parseReviewCommand("snooze 2 24h");
    expect(cmd.valid).toBe(true);
    expect(cmd.command).toBe("snooze");
    expect(cmd.args).toBe("24h");
  });

  test("parses full-report", () => {
    const cmd = parseReviewCommand("full-report");
    expect(cmd.valid).toBe(true);
    expect(cmd.command).toBe("full-report");
  });

  test("rejects missing cluster number", () => {
    const cmd = parseReviewCommand("details");
    expect(cmd.valid).toBe(false);
    expect(cmd.error).toContain("Which cluster?");
  });

  test("rejects unrecognized command", () => {
    const cmd = parseReviewCommand("unknown 1");
    expect(cmd.valid).toBe(false);
    expect(cmd.error).toContain("Available commands");
  });

  test("formats escalation", () => {
    const text = formatEscalation(1, "web_app:chat:Error 500", "critical", "data_loss_language", "Keywords: deleted, gone");
    expect(text).toContain("ESCALATION");
    expect(text).toContain("critical");
  });

  test("formats issue draft", () => {
    const text = formatIssueDraft(1, "[Web] Chat crash", ["bug", "chat"], "high", "@dev", "5 reports describe...");
    expect(text).toContain("Issue Draft");
    expect(text).toContain("confirm file");
  });
});
