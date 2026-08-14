import { db } from '@libs/database';
import { aiGenerationTask } from '@libs/database/schema/ai-generation-task';
import { and, eq, gt } from 'drizzle-orm';
import type { ImageGenerationResult, ImageProviderName } from './types';

export interface ImageTaskRecord {
  id: string;
  userId: string;
  provider: ImageProviderName;
  model: string;
  creditCost: number;
  consumeTransactionId: string;
  status: 'processing' | 'succeeded' | 'failed';
  result?: ImageGenerationResult;
  errorMessage?: string;
  refunded: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TASK_TTL_MS = 24 * 60 * 60 * 1000;

function mapTask(row: typeof aiGenerationTask.$inferSelect): ImageTaskRecord {
  return {
    id: row.id,
    userId: row.userId,
    provider: row.provider as ImageProviderName,
    model: row.model,
    creditCost: Number(row.creditCost),
    consumeTransactionId: row.consumeTransactionId,
    status: row.status as ImageTaskRecord['status'],
    result: row.result as ImageGenerationResult | undefined,
    errorMessage: row.errorMessage || undefined,
    refunded: row.refunded,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function getImageTaskRecord(taskId: string): Promise<ImageTaskRecord | undefined> {
  const [task] = await db.select().from(aiGenerationTask).where(and(
    eq(aiGenerationTask.id, taskId),
    eq(aiGenerationTask.kind, 'image'),
    gt(aiGenerationTask.expiresAt, new Date()),
  )).limit(1);
  return task ? mapTask(task) : undefined;
}

export async function createImageTaskRecord(input: {
  id: string;
  userId: string;
  provider: ImageProviderName;
  model: string;
  creditCost: number;
  consumeTransactionId: string;
}): Promise<ImageTaskRecord> {
  const existing = await getImageTaskRecord(input.id);
  if (existing) {
    if (existing.userId !== input.userId) throw new Error(`AI task id collision: ${input.id}`);
    return existing;
  }
  const now = new Date();
  try {
    const [created] = await db.insert(aiGenerationTask).values({
      id: input.id,
      userId: input.userId,
      kind: 'image',
      provider: input.provider,
      model: input.model,
      consumeTransactionId: input.consumeTransactionId,
      creditCost: String(input.creditCost),
      status: 'processing',
      refunded: false,
      createdAt: now,
      updatedAt: now,
      expiresAt: new Date(now.getTime() + TASK_TTL_MS),
    }).returning();
    return mapTask(created);
  } catch (error) {
    const concurrent = await getImageTaskRecord(input.id);
    if (concurrent?.userId === input.userId) return concurrent;
    throw error;
  }
}

export async function markImageTaskSucceeded(taskId: string, result: ImageGenerationResult) {
  const [task] = await db.update(aiGenerationTask).set({ status: 'succeeded', result, errorMessage: null, updatedAt: new Date() })
    .where(and(eq(aiGenerationTask.id, taskId), eq(aiGenerationTask.kind, 'image'))).returning();
  return task ? mapTask(task) : undefined;
}

export async function markImageTaskFailed(taskId: string, errorMessage: string, refunded: boolean) {
  const [task] = await db.update(aiGenerationTask).set({ status: 'failed', errorMessage, refunded, updatedAt: new Date() })
    .where(and(eq(aiGenerationTask.id, taskId), eq(aiGenerationTask.kind, 'image'))).returning();
  return task ? mapTask(task) : undefined;
}
