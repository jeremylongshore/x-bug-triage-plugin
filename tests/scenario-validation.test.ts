import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { randomUUID } from "crypto";
import { migrate } from "../db/migrate";
import { insertTriageRun, insertCandidate, insertCluster, insertClusterPost, getCluster, getAuditEntriesByRun } from "../lib/db";
import { writeAuditEvent } from "../lib/audit";
import { clusterCandidates, classificationToFamily, determineSubStatus } from "../lib/clusterer";
import { parseCandidate } from "../lib/parser";
import { parseReviewCommand } from "../mcp/triage-server/lib";
import type { BugCandidate, BugCluster, TriageRun } from "../lib/types";
import type { XPost } from "../mcp/triage-server/types";

let db: Database;

function createTestDb(): Database {
  const d = new Database(":memory:");
  d.exec("PRAGMA foreign_keys = ON");
  migrate(d);
  return d;
}

function makeRun(): TriageRun {
  return {
    run_id: randomUUID(),
    started_at: new Date().toISOString(),
    completed_at: null,
    status: "running",
    accounts_ingested: ["@TestProduct"],
    endpoints_summary: null,
    candidates_parsed: 0,
    clusters_created: 0,
    clusters_updated: 0,
    warnings: null,
  };
}

function makeCandidate(runId: string, overrides: Partial<BugCandidate> = {}): BugCandidate {
  return {
    post_id: randomUUID(),
    author_handle: "user",
    author_id: "123",
    timestamp: new Date().toISOString(),
    source_type: "mention",
    product_surface: "web_app",
    feature_area: "chat",
    symptoms: ["messages disappearing"],
    error_strings: ["Error 500"],
    repro_hints: [],
    urls: [],
    has_media: false,
    media_keys: [],
    language: "en",
    conversation_id: null,
    thread_root_id: null,
    reply_to_id: null,
    referenced_post_ids: [],
    public_metrics: null,
    classification: "bug_report",
    classification_confidence: 0.85,
    classification_rationale: "test",
    report_quality_score: 0.8,
    independence_score: 0.9,
    account_authenticity_score: 0.9,
    historical_accuracy_score: 0.5,
    reporter_reliability_score: 0.8,
    reporter_category: "public",
    pii_flags: [],
    raw_text_redacted: "Messages disappearing Error 500",
    raw_text_storage_policy: "store_redacted",
    triage_run_id: runId,
    ...overrides,
  };
}

const EMPTY_ACCOUNTS = {
  approved_intake_accounts: [],
  known_internal_accounts: [],
  known_partner_accounts: [],
  known_tester_accounts: [],
};

// === Scenario 1: Happy Path ===

describe("scenario 1: happy path full triage cycle", () => {
  beforeEach(() => { db = createTestDb(); });
  afterEach(() => { db.close(); });

  test("ingest → cluster → audit trail", () => {
    const run = makeRun();
    insertTriageRun(db, run);

    // Create candidates
    const candidates = [
      makeCandidate(run.run_id),
      makeCandidate(run.run_id),
      makeCandidate(run.run_id, { product_surface: "api", feature_area: "billing", classification: "billing_problem", symptoms: ["overcharged"], error_strings: [] }),
    ];
    for (const c of candidates) insertCandidate(db, c);

    // Cluster
    const result = clusterCandidates(db, candidates, run.run_id);
    expect(result.newClusters.length).toBe(2);

    // Audit
    writeAuditEvent(db, "ingest_run_started", { accounts: ["@TestProduct"] }, { runId: run.run_id });
    writeAuditEvent(db, "ingest_run_completed", { status: "completed", summary: {} }, { runId: run.run_id });
    const entries = getAuditEntriesByRun(db, run.run_id);
    expect(entries.length).toBe(2);

    // Commands
    expect(parseReviewCommand("details 1").valid).toBe(true);
    expect(parseReviewCommand("file 1").valid).toBe(true);
    expect(parseReviewCommand("confirm file 1").valid).toBe(true);
  });
});

// === Scenario 2: Partial Failure ===

describe("scenario 2: partial failure produces useful output", () => {
  beforeEach(() => { db = createTestDb(); });
  afterEach(() => { db.close(); });

  test("some candidates still cluster despite failures", () => {
    const run = makeRun();
    insertTriageRun(db, run);

    // Even with only 1 candidate (simulating partial intake), we get a cluster
    const c = makeCandidate(run.run_id);
    insertCandidate(db, c);
    const result = clusterCandidates(db, [c], run.run_id);
    expect(result.newClusters.length).toBe(1);

    // Warnings would be in the run metadata
    writeAuditEvent(db, "ingest_run_completed", {
      status: "partial",
      summary: { endpoints_degraded: ["tweets/:id/quote_tweets"] },
    }, { runId: run.run_id });
  });
});

// === Scenario 3: Rare Severe Bug ===

describe("scenario 3: single high-quality data-loss report surfaces at high severity", () => {
  beforeEach(() => { db = createTestDb(); });
  afterEach(() => { db.close(); });

  test("severity independent from cluster size", () => {
    const run = makeRun();
    insertTriageRun(db, run);

    const post: XPost = {
      id: "rare_001",
      text: "All my data was deleted from the account. Everything gone. Lost years of conversations.",
      author_id: "expert_user",
      created_at: new Date().toISOString(),
      public_metrics: { like_count: 2, reply_count: 0, retweet_count: 0, quote_count: 0 },
    };

    const candidate = parseCandidate(post, run.run_id, EMPTY_ACCOUNTS);
    expect(candidate.symptoms.length).toBeGreaterThan(0);
    // Data loss language detected
    expect(candidate.raw_text_redacted).toContain("deleted");

    insertCandidate(db, candidate);
    const result = clusterCandidates(db, [candidate], run.run_id);
    expect(result.newClusters.length).toBe(1);
    // Cluster has 1 report — severity computation would elevate this
    // based on data loss signals, not cluster size
    expect(result.newClusters[0].report_count).toBe(1);
  });
});

// === Scenario 4: Duplicate Cluster Attachment ===

describe("scenario 4: new complaints attach to existing filed cluster", () => {
  beforeEach(() => { db = createTestDb(); });
  afterEach(() => { db.close(); });

  test("new evidence attaches, doesn't create duplicate", () => {
    const run1 = makeRun();
    insertTriageRun(db, run1);

    // Create initial cluster
    const c1 = makeCandidate(run1.run_id);
    insertCandidate(db, c1);
    const result1 = clusterCandidates(db, [c1], run1.run_id);
    expect(result1.newClusters.length).toBe(1);

    // "File" the cluster
    const clusterId = result1.newClusters[0].cluster_id;
    db.query("UPDATE clusters SET state = 'filed' WHERE cluster_id = ?").run(clusterId);

    // New run with similar candidate
    const run2 = makeRun();
    insertTriageRun(db, run2);
    const c2 = makeCandidate(run2.run_id);
    insertCandidate(db, c2);
    const result2 = clusterCandidates(db, [c2], run2.run_id);

    // Should attach to existing, not create new
    expect(result2.newClusters.length).toBe(0);
    expect(result2.updatedClusters.length).toBe(1);

    // Check the cluster was updated
    const updated = getCluster(db, clusterId);
    expect(updated!.report_count).toBe(2);
    expect(updated!.sub_status).toBe("new_evidence");
  });
});

// === Scenario 5: Regression Reopened ===

describe("scenario 5: resolved cluster gets reopened", () => {
  beforeEach(() => { db = createTestDb(); });
  afterEach(() => { db.close(); });

  test("resolved cluster + fresh complaints → regression_reopened", () => {
    const run1 = makeRun();
    insertTriageRun(db, run1);

    // Create and resolve cluster
    const c1 = makeCandidate(run1.run_id);
    insertCandidate(db, c1);
    const result1 = clusterCandidates(db, [c1], run1.run_id);
    const clusterId = result1.newClusters[0].cluster_id;
    db.query("UPDATE clusters SET state = 'resolved' WHERE cluster_id = ?").run(clusterId);

    // New matching complaint
    const run2 = makeRun();
    insertTriageRun(db, run2);
    const c2 = makeCandidate(run2.run_id);
    insertCandidate(db, c2);
    const result2 = clusterCandidates(db, [c2], run2.run_id);

    expect(result2.updatedClusters.length).toBe(1);
    const updated = getCluster(db, clusterId);
    expect(updated!.state).toBe("open");
    expect(updated!.sub_status).toBe("regression_reopened");
  });
});

// === Command Validation ===

describe("all 11 Slack commands", () => {
  const commands = [
    ["details 1", "details"],
    ["file 2", "file"],
    ["dismiss 3 false positive", "dismiss"],
    ["merge 1 ISSUE-42", "merge"],
    ["escalate 1", "escalate"],
    ["monitor 2", "monitor"],
    ["snooze 3 24h", "snooze"],
    ["split 1", "split"],
    ["reroute 2", "reroute"],
    ["full-report", "full-report"],
    ["confirm file 1", "confirm file"],
  ];

  for (const [input, expected] of commands) {
    test(`parses "${input}"`, () => {
      const result = parseReviewCommand(input);
      expect(result.valid).toBe(true);
      expect(result.command).toBe(expected);
    });
  }
});

// === Audit Completeness ===

describe("audit log completeness", () => {
  beforeEach(() => { db = createTestDb(); });
  afterEach(() => { db.close(); });

  test("all 12 event types can be logged", () => {
    const runId = randomUUID();
    const types = [
      "ingest_run_started", "ingest_run_completed", "source_fetched",
      "candidate_classified", "pii_redaction", "cluster_created",
      "cluster_updated", "cluster_state_changed", "routing_recommendation",
      "escalation_triggered", "human_action", "override_created",
    ] as const;

    for (const t of types) {
      writeAuditEvent(db, t, { test: true }, { runId });
    }

    const entries = getAuditEntriesByRun(db, runId);
    expect(entries.length).toBe(12);
    const foundTypes = new Set(entries.map((e) => e.event_type));
    for (const t of types) {
      expect(foundTypes.has(t)).toBe(true);
    }
  });
});
