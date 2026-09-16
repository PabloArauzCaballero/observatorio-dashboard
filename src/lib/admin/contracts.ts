/**
 * The shapes the core returns, written down once.
 *
 * They mirror `docs/endpoints/openapi.yaml`, and they are deliberately not
 * validated at runtime here: the core is the authority on its own contract, and
 * a second validation in the console would either duplicate its rules or
 * disagree with them. What these types buy is that a renamed field breaks the
 * build instead of printing «undefined» to an operator.
 */
export type EvidenceState = 'known' | 'unknown' | 'stale' | 'not_applicable';

export interface OverviewCardCommon {
  readonly evidenceState: EvidenceState;
}

export interface AdminOverview {
  readonly window: { hours: number; cutoffAt: string };
  readonly site: OverviewCardCommon & {
    status: string;
    observedAt: string | null;
    checks: number;
    failedChecks: number;
    openIncidents: number;
  };
  readonly sources: OverviewCardCommon & {
    total: number;
    late: number;
    withoutSchedule: number;
    lastSuccessAt: string | null;
  };
  readonly ingestion: OverviewCardCommon & {
    failedRuns: number;
    partialRuns: number;
    runningRuns: number;
    deadLetters: number;
    pendingReviews: number;
    openContradictions: number;
    lastRunStartedAt: string | null;
  };
  readonly publication: OverviewCardCommon & { pending: number; datasets: number };
  readonly quality: OverviewCardCommon & { criticalIssues: number; openIssues: number };
  readonly seeds: OverviewCardCommon & {
    packages: number;
    requiredMissing: number;
    conflicts: number;
  };
  readonly exports: OverviewCardCommon & { generated: number; failed: number };
  readonly traffic: OverviewCardCommon & {
    measured: boolean;
    events: number | null;
    robotShare: number | null;
    firstEventAt: string | null;
    lastEventAt: string | null;
  };
}

export interface SourceStatus {
  readonly sourceId: string;
  readonly code: string;
  readonly name: string;
  readonly organization: string;
  readonly isActive: boolean;
  readonly cadence: string | null;
  readonly freshness: { state: string; overdueHours: number | null; reason: string };
  readonly lastAttemptAt: string | null;
  readonly lastSuccessAt: string | null;
  readonly lastObservedAt: string | null;
  readonly lastPersistedAt: string | null;
  readonly lastPublishedAt: string | null;
  readonly publicationLagHours: number | null;
  readonly artifactCount: number;
}

export interface SourceList {
  readonly items: readonly SourceStatus[];
  readonly late: number;
  readonly withoutSchedule: number;
}

export interface RunCounters {
  readonly received: number;
  readonly accepted: number;
  readonly rejected: number;
  readonly quarantined: number;
  readonly unresolved: number;
}

export interface IngestionRun {
  readonly agentRunId: string;
  readonly sourceCode: string;
  readonly sourceName: string;
  readonly status: string;
  readonly triggerType: string;
  readonly attemptNo: number;
  readonly startedAt: string;
  readonly completedAt: string | null;
  readonly counters: RunCounters;
  readonly errorSummary: string | null;
  readonly stagesWithProblems: number;
  readonly correlationId: string;
}

export interface IngestionStage {
  readonly eventId: string;
  readonly stage: string;
  readonly outcome: string;
  readonly occurredAt: string;
  readonly durationMs: number | null;
  readonly artifactReference: string | null;
  readonly artifactSha256: string | null;
  readonly counters: { received: number; accepted: number; rejected: number; skipped: number };
  readonly reason: string | null;
}

export interface IngestionRunDetail extends IngestionRun {
  readonly stages: readonly IngestionStage[];
  readonly stagesRecorded: boolean;
}

export interface Paged<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
}

export interface SeedPackage {
  readonly code: string;
  readonly label: string;
  readonly kind: string;
  readonly version: string;
  readonly checksum: string;
  readonly ownership: string;
  readonly dependsOn: ReadonlyArray<{ code: string; version: string }>;
  readonly requiredFor: readonly string[];
  readonly fileCount: number;
  readonly ledgerState: 'absent' | 'applied' | 'outdated' | 'conflict';
  readonly appliedVersions: ReadonlyArray<{
    version: string;
    checksum: string;
    appliedAt: string;
    appliedCommit: string | null;
  }>;
  readonly refusal: { code: string; message: string } | null;
  readonly applicable: boolean;
}

export interface SeedPackageList {
  readonly items: readonly SeedPackage[];
  readonly profile: string;
  readonly demoEnabled: boolean;
}

export interface CatalogueDifference {
  readonly label: string;
  readonly table: string;
  readonly declared: number;
  readonly present: number;
  readonly missing: readonly string[];
  readonly modified: ReadonlyArray<{
    identity: string;
    fields: ReadonlyArray<{ field: string; expected: string; stored: string }>;
  }>;
  readonly additional: number;
}

export interface SeedValidation {
  readonly seedRunId: string;
  readonly code: string;
  readonly label: string;
  readonly version: string;
  readonly checksum: string;
  readonly kind: string;
  readonly ownership: string;
  readonly schemaVersion: string;
  readonly ledgerState: string;
  readonly refusal: { code: string; message: string } | null;
  readonly difference: {
    compared: boolean;
    reason: string;
    catalogues: readonly CatalogueDifference[];
  } | null;
}

export interface SeedRun {
  readonly seedRunId: string;
  readonly packageCode: string;
  readonly packageVersion: string;
  readonly operation: string;
  readonly status: string;
  readonly attemptNo: number;
  readonly startedAt: string;
  readonly heartbeatAt: string;
  readonly completedAt: string | null;
  readonly errorSummary: string | null;
  readonly checkpoint: { completed?: string[] } | null;
  readonly counters: Record<string, unknown>;
}

export interface QualityEvaluation {
  readonly evaluationId: string;
  readonly ruleCode: string;
  readonly ruleName: string;
  readonly ruleVersion: string | null;
  readonly dimension: string;
  readonly severity: string;
  readonly scope: string | null;
  readonly status: string;
  readonly numerator: number | null;
  readonly denominator: number | null;
  readonly notEvaluated: number | null;
  readonly share: number | null;
  readonly measuredValue: string | null;
  readonly assessedAt: string;
  readonly cutoffAt: string | null;
}

export interface QualitySummary {
  readonly rules: ReadonlyArray<{
    ruleCode: string;
    ruleName: string;
    severity: string;
    isActive: boolean;
    evaluations: number;
    lastAssessedAt: string | null;
    lastStatus: string;
  }>;
  readonly coverage: { declared: number; evaluated: number; share: number | null };
  readonly blocking: number;
  readonly issues: ReadonlyArray<{ severity: string; status: string; issues: number }>;
}

export interface QualityIssue {
  readonly dataIssueId: string;
  readonly issueType: string;
  readonly severity: string;
  readonly status: string;
  readonly title: string;
  readonly description: string;
  readonly target: { type: string; id: string };
  readonly detectedAt: string;
  readonly resolvedAt: string | null;
  readonly resolutionNotes: string | null;
  readonly evidence: {
    ruleCode: string | null;
    assessmentStatus: string | null;
    measuredValue: string | null;
    numerator: number | null;
    denominator: number | null;
    share: number | null;
  };
  readonly history: ReadonlyArray<{
    actorSubject: string;
    actorRoles: readonly string[];
    action: string;
    outcome: string;
    occurredAt: string;
  }>;
}

export interface MetadataCatalog {
  readonly catalog: string;
  readonly entries: ReadonlyArray<{
    identity: string;
    code: string;
    name: string;
    detail: string | null;
    active: boolean | null;
    references: number;
  }>;
}

export interface HealthSummary {
  readonly build: { commit: string | null; environmentId: string };
  readonly probes: ReadonlyArray<{
    target: string;
    probeType: string;
    lastOutcome: string;
    lastObservedAt: string | null;
    checks: number;
    failedChecks: number;
    unknownChecks: number;
  }>;
  readonly incidents: ReadonlyArray<{
    healthIncidentId: string;
    target: string;
    status: string;
    cause: string;
    consecutiveFailures: number;
    openedAt: string;
    closedAt: string | null;
    durationSeconds: number | null;
    delivery: { attempts: number; delivered: number };
  }>;
  readonly publication: ReadonlyArray<{
    datasetCode: string;
    status: string;
    sourceCutoffAt: string | null;
    lastAttemptAt: string | null;
    lastSuccessAt: string | null;
    lastError: string | null;
  }>;
  readonly storedCopies: ReadonlyArray<{ name: string; built: boolean }>;
}

export interface TrafficReport {
  readonly granularity: string;
  readonly buckets: ReadonlyArray<{
    bucket: string;
    route: string;
    kind: string;
    device: string;
    referrer: string;
    views: number;
    estimatedSessions: number;
  }>;
  readonly coverage: {
    measured: boolean;
    firstEventAt: string | null;
    lastEventAt: string | null;
    totalEvents: number | null;
    robotShare: number | null;
  };
}

export interface ExportReport extends Paged<{
  exportRequestId: string;
  requestId: string;
  datasetCode: string;
  format: string;
  status: string;
  filters: Record<string, unknown>;
  rowCount: number | null;
  byteCount: number | null;
  durationMs: number | null;
  truncated: boolean;
  occurredAt: string;
  errorCode: string | null;
}> {
  readonly summary: ReadonlyArray<{
    datasetCode: string;
    status: string;
    requests: number;
    rows: number | null;
  }>;
  readonly measures: readonly string[];
}

export interface AuditEvent {
  readonly auditLogId: string;
  readonly actorSubject: string;
  readonly actorRoles: readonly string[];
  readonly action: string;
  readonly entityType: string;
  readonly entityReference: string | null;
  readonly outcome: string;
  readonly correlationId: string;
  readonly occurredAt: string;
}
