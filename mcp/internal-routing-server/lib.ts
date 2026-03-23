import type { RoutingResult, RoutingRecommendation } from "./types";
import type { RoutingSourcePriorityConfig } from "../../lib/config";

const STALENESS_THRESHOLD_DAYS = 30;

export function isStale(lastActiveDate: string | null, thresholdDays: number = STALENESS_THRESHOLD_DAYS): boolean {
  if (!lastActiveDate) return true;
  const daysSince = (Date.now() - new Date(lastActiveDate).getTime()) / (1000 * 60 * 60 * 24);
  return daysSince > thresholdDays;
}

export function buildRoutingRecommendation(
  clusterId: string,
  results: RoutingResult[],
  overrideParams: Record<string, unknown> | null,
): RoutingRecommendation {
  if (overrideParams) {
    return {
      cluster_id: clusterId,
      ranked_results: results,
      top_recommendation: {
        level: 0,
        source: "routing_override",
        team: (overrideParams.new_team as string) || undefined,
        assignee: (overrideParams.new_assignee as string) || undefined,
        confidence: 1.0,
        stale: false,
      },
      uncertainty: false,
      override_applied: true,
    };
  }

  const validResults = results.filter((r) => r.team || r.assignee);
  if (validResults.length === 0) {
    return {
      cluster_id: clusterId,
      ranked_results: [],
      top_recommendation: null,
      uncertainty: true,
      uncertainty_reason: "Routing: uncertain — no routing signals available. Manual assignment required.",
      override_applied: false,
    };
  }

  return {
    cluster_id: clusterId,
    ranked_results: validResults.sort((a, b) => a.level - b.level),
    top_recommendation: validResults[0],
    uncertainty: false,
    override_applied: false,
  };
}

export function applyPrecedenceConfidence(
  result: RoutingResult,
  precedenceConfig: RoutingSourcePriorityConfig,
): RoutingResult {
  const level = precedenceConfig.precedence.find((p) => p.level === result.level);
  if (level) {
    return { ...result, confidence: result.confidence * level.confidence_modifier };
  }
  return result;
}
