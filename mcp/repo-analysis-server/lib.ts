import type { RepoEvidence, RepoScanResult } from "./types";

export function rankRepos(surfaceRepos: string[], maxRepos: number = 3): string[] {
  return surfaceRepos.slice(0, maxRepos);
}

export function assignEvidenceTier(evidenceType: RepoEvidence["evidenceType"], confidence: number): 1 | 2 | 3 | 4 {
  switch (evidenceType) {
    case "issue_match":
      return confidence >= 0.9 ? 1 : confidence >= 0.7 ? 2 : 3;
    case "recent_commit":
      return confidence >= 0.8 ? 2 : 3;
    case "affected_path":
      return confidence >= 0.7 ? 2 : 3;
    case "recent_deploy":
      return confidence >= 0.8 ? 2 : 3;
    case "sibling_failure":
      return 3;
    case "external_dependency":
      return 4;
    default:
      return 4;
  }
}

export function createDegradedScanResult(repo: string, error: string): RepoScanResult {
  return { repo, evidence: [], scanned: false, error };
}

export function sortEvidenceByTier(evidence: RepoEvidence[]): RepoEvidence[] {
  return [...evidence].sort((a, b) => a.tier - b.tier);
}

export function isExternalDependency(evidence: RepoEvidence[]): boolean {
  return evidence.some((e) => e.evidenceType === "external_dependency");
}
