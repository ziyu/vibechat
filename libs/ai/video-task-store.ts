import { db } from '@libs/database';
import { aiGenerationTask } from '@libs/database/schema/ai-generation-task';
import { and, eq, gt } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { VideoGenerationResult, VideoProviderName } from './types';

type LocalVideoTaskStatus = 'processing' | 'succeeded' | 'failed';
export interface VideoTaskRecord {
  id: string;
  userId: string;
  provider: VideoProviderName;
  model: string;
  providerTaskId?: string;
  creditCost: number;
  consumeTransactionId: string;
  status: LocalVideoTaskStatus;
  result?: VideoGenerationResult;
  errorMessage?: string;
  refunded: boolean;
  createdAt: number;
  updatedAt: number;
}

const TASK_TTL_MS = 24 * 60 * 60 * 1000;

function mapTask(row: typeof aiGenerationTask.$inferSelect): VideoTaskRecord {
  return {
    id: row.id,
    userId: row.userId,
    provider: row.provider as VideoProviderName,
    model: row.model,
    providerTaskId: row.providerTaskId || undefined,
    creditCost: Number(row.creditCost),
    consumeTransactionId: row.consumeTransactionId,
    status: row.status as LocalVideoTaskStatus,
    result: row.result as VideoGenerationResult | undefined,
    errorMessage: row.errorMessage || undefined,
    refunded: row.refunded,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  };
}

type VideoTaskReservationInput = Omit<
  VideoTaskRecord,
  'id' | 'status' | 'refunded' | 'createdAt' | 'updatedAt'
> & { id?: string };

export async function reserveVideoTaskRecord(
  input: VideoTaskReservationInput,
): Promise<{ task: VideoTaskRecord; created: boolean }> {
  const now = new Date();
  const id = input.id || `video_${nanoid()}`;
  const [existing] = await db.select().from(aiGenerationTask).where(eq(aiGenerationTask.id, id)).limit(1);
  if (existing) {
    if (existing.userId !== input.userId || existing.kind !== 'video') {
      throw new Error(`AI task id collision: ${id}`);
    }
    return { task: mapTask(existing), created: false };
  }

  try {
    const [created] = await db.insert(aiGenerationTask).values({
      id,
      userId: input.userId,
      kind: 'video',
      provider: input.provider,
      model: input.model,
      providerTaskId: input.providerTaskId,
      consumeTransactionId: input.consumeTransactionId,
      creditCost: String(input.creditCost),
      status: 'processing',
      result: null,
      refunded: false,
      createdAt: now,
      updatedAt: now,
      expiresAt: new Date(now.getTime() + TASK_TTL_MS),
    }).returning();
    return { task: mapTask(created), created: true };
  } catch (error) {
    const [concurrent] = await db.select().from(aiGenerationTask).where(eq(aiGenerationTask.id, id)).limit(1);
    if (concurrent?.userId === input.userId && concurrent.kind === 'video') {
      return { task: mapTask(concurrent), created: false };
    }
    throw error;
  }
}

export async function createVideoTaskRecord(
  input: VideoTaskReservationInput,
): Promise<VideoTaskRecord> {
  return (await reserveVideoTaskRecord(input)).task;
}

export async function getVideoTaskRecord(taskId: string): Promise<VideoTaskRecord | undefined> {
  const [task] = await db.select().from(aiGenerationTask).where(and(
    eq(aiGenerationTask.id, taskId),
    eq(aiGenerationTask.kind, 'video'),
    gt(aiGenerationTask.expiresAt, new Date()),
  )).limit(1);
  return task ? mapTask(task) : undefined;
}

export async function markVideoTaskSucceeded(
  taskId: string,
  result: VideoGenerationResult,
): Promise<VideoTaskRecord | undefined> {
  const [task] = await db.update(aiGenerationTask).set({
    status: 'succeeded',
    result,
    errorMessage: null,
    updatedAt: new Date(),
  }).where(and(eq(aiGenerationTask.id, taskId), eq(aiGenerationTask.kind, 'video'))).returning();
  return task ? mapTask(task) : undefined;
}

export async function attachVideoProviderTask(
  taskId: string,
  providerTaskId: string,
): Promise<VideoTaskRecord | undefined> {
  const [task] = await db.update(aiGenerationTask).set({
    providerTaskId,
    updatedAt: new Date(),
  }).where(and(
    eq(aiGenerationTask.id, taskId),
    eq(aiGenerationTask.kind, 'video'),
    eq(aiGenerationTask.status, 'processing'),
  )).returning();
  return task ? mapTask(task) : undefined;
}

export async function markVideoTaskFailed(
  taskId: string,
  errorMessage: string,
): Promise<VideoTaskRecord | undefined> {
  const [task] = await db.update(aiGenerationTask).set({
    status: 'failed',
    errorMessage,
    updatedAt: new Date(),
  }).where(and(eq(aiGenerationTask.id, taskId), eq(aiGenerationTask.kind, 'video'))).returning();
  return task ? mapTask(task) : undefined;
}

export async function markVideoTaskRefunded(taskId: string): Promise<VideoTaskRecord | undefined> {
  const [task] = await db.update(aiGenerationTask).set({
    refunded: true,
    updatedAt: new Date(),
  }).where(and(eq(aiGenerationTask.id, taskId), eq(aiGenerationTask.kind, 'video'))).returning();
  return task ? mapTask(task) : undefined;
}
