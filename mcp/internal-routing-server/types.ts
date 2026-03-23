export interface RoutingResult {
  level: number;
  source: string;
  team?: string;
  assignee?: string;
  confidence: number;
  stale: boolean;
  staleDays?: number;
}

export interface RoutingRecommendation {
  cluster_id: string;
  ranked_results: RoutingResult[];
  top_recommendation: RoutingResult | null;
  uncertainty: boolean;
  uncertainty_reason?: string;
  override_applied: boolean;
}
