import { describe, test, expect } from "bun:test";
import { rankRepos, assignEvidenceTier, createDegradedScanResult, sortEvidenceByTier, isExternalDependency } from "./lib";
import type { RepoEvidence } from "./types";

describe("repo-analysis", () => {
  test("ranks repos with top-3 cap", () => {
    expect(rankRepos(["a", "b", "c", "d"], 3).length).toBe(3);
  });

  test("assigns tier 1 for high-confidence issue match", () => {
    expect(assignEvidenceTier("issue_match", 0.95)).toBe(1);
  });

  test("assigns tier 2 for moderate issue match", () => {
    expect(assignEvidenceTier("issue_match", 0.75)).toBe(2);
  });

  test("assigns tier 3 for low-confidence match", () => {
    expect(assignEvidenceTier("issue_match", 0.5)).toBe(3);
  });

  test("assigns tier 4 for external dependency", () => {
    expect(assignEvidenceTier("external_dependency", 0.9)).toBe(4);
  });

  test("creates degraded scan result", () => {
    const result = createDegradedScanResult("org/repo", "Access denied");
    expect(result.scanned).toBe(false);
    expect(result.error).toBe("Access denied");
  });

  test("sorts evidence by tier", () => {
    const evidence: RepoEvidence[] = [
      { repo: "a", evidenceType: "issue_match", tier: 3, title: "", description: "", confidence: 0.5 },
      { repo: "a", evidenceType: "issue_match", tier: 1, title: "", description: "", confidence: 0.9 },
      { repo: "a", evidenceType: "recent_commit", tier: 2, title: "", description: "", confidence: 0.7 },
    ];
    const sorted = sortEvidenceByTier(evidence);
    expect(sorted[0].tier).toBe(1);
    expect(sorted[1].tier).toBe(2);
    expect(sorted[2].tier).toBe(3);
  });

  test("detects external dependency", () => {
    const evidence: RepoEvidence[] = [
      { repo: "a", evidenceType: "external_dependency", tier: 4, title: "", description: "", confidence: 0.5 },
    ];
    expect(isExternalDependency(evidence)).toBe(true);
  });
});
