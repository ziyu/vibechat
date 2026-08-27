export interface RuntimeLease {
  spaceInstanceId: string;
  ownerId: string;
  fencingToken: number;
  expiresAt: Date;
}

export interface RuntimeInstanceState {
  spaceInstanceId: string;
  sequence: number;
  snapshot: Record<string, unknown>;
  fencingToken: number;
  updatedAt: Date;
}

export interface RuntimeProjectPointer {
  projectId: string;
  spaceInstanceId: string;
  sourceObjectKey: string | null;
  sourceHash: string | null;
  artifactObjectKey: string | null;
  artifactHash: string | null;
  readyRevisionId: string | null;
  publishedRevisionId: string | null;
  releaseId: string | null;
  metadata: Record<string, unknown>;
  fencingToken: number;
  updatedAt: Date;
}

export type RuntimeTurnKind = "message" | "publish" | "restore";
export type RuntimeTurnStatus = "queued" | "active" | "completed" | "failed";

export interface RuntimeTurnRecord {
  turnId: string;
  spaceInstanceId: string;
  externalRequestId: string;
  kind: RuntimeTurnKind;
  status: RuntimeTurnStatus;
  agentId: string | null;
  agentDefinitionId: string | null;
  agentDefinitionVersion: string | null;
  adapterKey: string | null;
  adapterVersion: string | null;
  sessionGeneration: number | null;
  policySnapshotHash: string | null;
  reservationTransactionId: string | null;
  payloadSchemaVersion: string | null;
  payload: Record<string, unknown>;
  resultSchemaVersion: string | null;
  result: Record<string, unknown> | null;
  cancelRequestedAt: Date | null;
  attempt: number;
  ownerId: string | null;
  fencingToken: number;
  createdAt: Date;
  updatedAt: Date;
}

type RuntimeTurnSnapshotField =
  | "agentId"
  | "agentDefinitionId"
  | "agentDefinitionVersion"
  | "adapterKey"
  | "adapterVersion"
  | "sessionGeneration"
  | "policySnapshotHash"
  | "reservationTransactionId"
  | "payloadSchemaVersion"
  | "resultSchemaVersion"
  | "result"
  | "cancelRequestedAt";

export type RuntimeTurnEnqueue = Omit<
  RuntimeTurnRecord,
  | "status"
  | "attempt"
  | "ownerId"
  | "fencingToken"
  | "createdAt"
  | "updatedAt"
  | RuntimeTurnSnapshotField
> & Partial<Pick<RuntimeTurnRecord, RuntimeTurnSnapshotField>>;

export type RuntimeOutboxEventType =
  | "matrix_v2_state"
  | "agent_reply"
  | "credits_callback";
export type RuntimeOutboxStatus = "pending" | "processing" | "completed";

export interface RuntimeOutboxEvent {
  eventId: string;
  spaceInstanceId: string;
  eventType: RuntimeOutboxEventType;
  dedupeKey: string;
  payload: Record<string, unknown>;
  status: RuntimeOutboxStatus;
  attempt: number;
  ownerId: string | null;
  fencingToken: number;
  availableAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface InstanceRepository {
  loadInstance(spaceInstanceId: string): Promise<RuntimeInstanceState | null>;
  saveInstance(state: Omit<RuntimeInstanceState, "fencingToken" | "updatedAt">, lease: RuntimeLease): Promise<RuntimeInstanceState>;
}

export interface ProjectRepository {
  loadProject(spaceInstanceId: string): Promise<RuntimeProjectPointer | null>;
  saveProject(project: Omit<RuntimeProjectPointer, "fencingToken" | "updatedAt">, lease: RuntimeLease): Promise<RuntimeProjectPointer>;
  publishProject(input: {
    spaceInstanceId: string;
    expectedReadyRevisionId: string;
    publishedRevisionId: string;
    releaseId: string;
    artifactObjectKey: string;
    artifactHash: string;
  }, lease: RuntimeLease): Promise<RuntimeProjectPointer | null>;
}

export interface TurnRepository {
  getTurn(turnId: string): Promise<RuntimeTurnRecord | null>;
  enqueueTurn(turn: RuntimeTurnEnqueue): Promise<RuntimeTurnRecord>;
  claimNextTurn(spaceInstanceId: string, lease: RuntimeLease): Promise<RuntimeTurnRecord | null>;
  completeTurn(turnId: string, lease: RuntimeLease, status: "completed" | "failed"): Promise<boolean>;
  recoverInterruptedTurns(spaceInstanceId: string, lease: RuntimeLease): Promise<number>;
  listRunnableSpaceInstanceIds(limit?: number): Promise<string[]>;
}

export interface LeaseRepository {
  claimLease(spaceInstanceId: string, ownerId: string, ttlMs: number): Promise<RuntimeLease | null>;
  renewLease(lease: RuntimeLease, ttlMs: number): Promise<RuntimeLease | null>;
  releaseLease(lease: RuntimeLease): Promise<boolean>;
}

export interface OutboxRepository {
  enqueueOutbox(event: Pick<RuntimeOutboxEvent, "eventId" | "spaceInstanceId" | "eventType" | "dedupeKey" | "payload">): Promise<RuntimeOutboxEvent>;
  claimOutbox(ownerId: string, limit?: number): Promise<RuntimeOutboxEvent[]>;
  completeOutbox(eventId: string, ownerId: string): Promise<boolean>;
  retryOutbox(eventId: string, ownerId: string, availableAt: Date): Promise<boolean>;
}

export type SpaceRuntimeControlPlane = InstanceRepository
  & ProjectRepository
  & TurnRepository
  & LeaseRepository
  & OutboxRepository;

export class RuntimeFencingError extends Error {
  readonly code = "SPACE_RUNTIME_FENCED";

  constructor(spaceInstanceId: string) {
    super(`Runtime owner no longer holds the lease for ${spaceInstanceId}`);
    this.name = "RuntimeFencingError";
  }
}
