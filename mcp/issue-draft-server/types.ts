export interface IssueDraft {
  cluster_id: string;
  title: string;
  labels: string[];
  priority: string;
  assignee_suggestion: string | null;
  body: string;
  repo: string;
}

export interface DuplicateCheck {
  found: boolean;
  existing_issue_url?: string;
  existing_issue_number?: number;
  similarity: number;
}
