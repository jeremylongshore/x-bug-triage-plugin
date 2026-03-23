import { describe, test, expect } from "bun:test";
import { isStale, buildRoutingRecommendation, applyPrecedenceConfidence } from "./lib";
import type { RoutingResult } from "./types";

describe("internal-routing", () => {
  test("staleness: 31 days is stale", () => {
    const date = new Date(Date.now() - 31 * 86400000).toISOString();
    expect(isStale(date)).toBe(true);
  });

  test("staleness: 29 days is not stale", () => {
    const date = new Date(Date.now() - 29 * 86400000).toISOString();
    expect(isStale(date)).toBe(false);
  });

  test("staleness: null date is stale", () => {
    expect(isStale(null)).toBe(true);
  });

  test("routing: override takes precedence", () => {
    const result = buildRoutingRecommendation("c1", [], { new_team: "override-team" });
    expect(result.override_applied).toBe(true);
    expect(result.top_recommendation?.team).toBe("override-team");
  });

  test("routing: uncertainty when no results", () => {
    const result = buildRoutingRecommendation("c1", [], null);
    expect(result.uncertainty).toBe(true);
    expect(result.uncertainty_reason).toContain("Manual assignment required");
  });

  test("routing: best result by level", () => {
    const results: RoutingResult[] = [
      { level: 3, source: "codeowners", team: "team-a", confidence: 0.8, stale: false },
      { level: 1, source: "service_owner", team: "team-b", confidence: 1.0, stale: false },
    ];
    const rec = buildRoutingRecommendation("c1", results, null);
    expect(rec.top_recommendation?.team).toBe("team-b");
  });

  test("routing: precedence confidence modifier", () => {
    const result: RoutingResult = { level: 4, source: "recent_assignees", confidence: 1.0, stale: false };
    const config = {
      precedence: [{ level: 4, source: "recent_assignees", description: "", confidence_modifier: 0.6 }],
      staleness_threshold_days: 30,
    };
    const modified = applyPrecedenceConfidence(result, config);
    expect(modified.confidence).toBe(0.6);
  });
});
