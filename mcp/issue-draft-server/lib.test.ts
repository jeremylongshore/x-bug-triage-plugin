import { describe, test, expect } from "bun:test";
import { generateDraftTitle, generateDraftLabels, generateDraftBody, createDraft, checkForDuplicates } from "./lib";
import type { BugCluster } from "../../lib/types";

function makeCluster(overrides: Partial<BugCluster> = {}): BugCluster {
  const now = new Date().toISOString();
  return {
    cluster_id: "c1",
    bug_signature: "web_app|chat|error 500|messages disappearing",
    cluster_family: "product_defect",
    product_surface: "web_app",
    feature_area: "chat",
    title: "Messages disappearing in chat",
    severity: "high",
    severity_rationale: "Data loss signals",
    state: "open",
    sub_status: null,
    report_count: 5,
    first_seen: now,
    last_seen: now,
    created_at: now,
    updated_at: now,
    triage_run_id: "run1",
    ...overrides,
  };
}

describe("issue-draft", () => {
  test("generates title with surface and count", () => {
    const title = generateDraftTitle(makeCluster(), 5);
    expect(title).toContain("[web_app]");
    expect(title).toContain("5 public reports");
  });

  test("generates labels from cluster", () => {
    const labels = generateDraftLabels(makeCluster());
    expect(labels).toContain("bug");
    expect(labels).toContain("chat");
    expect(labels).toContain("web_app");
  });

  test("generates body with severity rationale", () => {
    const body = generateDraftBody(makeCluster(), 5);
    expect(body).toContain("5 public reports");
    expect(body).toContain("Data loss signals");
    expect(body).toContain("product_defect");
  });

  test("creates complete draft", () => {
    const draft = createDraft(makeCluster(), 5, "org/repo", "@dev");
    expect(draft.repo).toBe("org/repo");
    expect(draft.assignee_suggestion).toBe("@dev");
    expect(draft.priority).toBe("high");
  });

  test("detects duplicate titles", () => {
    const result = checkForDuplicates(
      "[web_app] Messages disappearing in chat",
      ["[web_app] Messages disappearing in chat"],
    );
    expect(result.found).toBe(true);
    expect(result.similarity).toBeGreaterThan(0.8);
  });

  test("no duplicate for different titles", () => {
    const result = checkForDuplicates(
      "[web_app] Chat crash on iOS",
      ["[api] Authentication timeout on v2 endpoint"],
    );
    expect(result.found).toBe(false);
  });
});
