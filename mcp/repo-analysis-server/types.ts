export interface RepoEvidence {
  repo: string;
  evidenceType: "issue_match" | "recent_commit" | "affected_path" | "recent_deploy" | "sibling_failure" | "external_dependency";
  tier: 1 | 2 | 3 | 4;
  title: string;
  url?: string;
  description: string;
  timestamp?: string;
  confidence: number;
}

export interface RepoScanResult {
  repo: string;
  evidence: RepoEvidence[];
  scanned: boolean;
  error?: string;
}
