export interface SlackClusterSummary {
  number: number;
  signature: string;
  reportCount: number;
  severity: string;
  statusNote: string;
  team: string | null;
  topEvidence: string | null;
  evidenceTier: number | null;
}

export interface ParsedCommand {
  command: string;
  clusterNumber?: number;
  args?: string;
  valid: boolean;
  error?: string;
}

export interface ThreadState {
  runId: string;
  clusters: Map<number, { clusterId: string; actedOn: boolean; action?: string; timestamp?: string }>;
  lastActivity: Date;
}
