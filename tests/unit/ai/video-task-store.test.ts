import { existsSync, rmSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const databasePath = `/tmp/vibechat-ai-task-${process.pid}-${Date.now()}.sqlite`;
let database: typeof import('@libs/database');
let taskStore: typeof import('@libs/ai/video-task-store');

beforeAll(async () => {
  process.env.DB_DIALECT = 'sqlite';
  process.env.SQLITE_DB_PATH = databasePath;
  vi.resetModules();
  database = await import('@libs/database');
  const { migrate } = await import('drizzle-orm/better-sqlite3/migrator');
  migrate(database.db as never, { migrationsFolder: 'libs/database/drizzle-sqlite' });
  await database.db.insert(database.user).values({
    id: 'video-task-user',
    name: 'Video Task User',
    email: 'video-task@example.com',
    emailVerified: true,
  });
  taskStore = await import('@libs/ai/video-task-store');
});

afterAll(() => {
  database.sqliteInstance?.close();
  for (const suffix of ['', '-shm', '-wal']) {
    const path = `${databasePath}${suffix}`;
    if (existsSync(path)) rmSync(path, { force: true });
  }
  delete process.env.SQLITE_DB_PATH;
  delete process.env.DB_DIALECT;
});

describe('Persistent video task store on SQLite', () => {
  it('survives module reload and keeps terminal state', async () => {
    const created = await taskStore.createVideoTaskRecord({
      id: 'video:durable-task',
      userId: 'video-task-user',
      provider: 'aliyun',
      model: 'wan2.6-t2v',
      providerTaskId: 'aliyun-task-1',
      creditCost: 20,
      consumeTransactionId: 'ai-video:video:durable-task',
    });
    expect(created).toMatchObject({ id: 'video:durable-task', status: 'processing', refunded: false });

    vi.resetModules();
    const reloadedStore = await import('@libs/ai/video-task-store');
    const reloaded = await reloadedStore.getVideoTaskRecord(created.id);
    expect(reloaded).toMatchObject({
      id: created.id,
      userId: 'video-task-user',
      providerTaskId: 'aliyun-task-1',
      status: 'processing',
    });

    await reloadedStore.markVideoTaskSucceeded(created.id, {
      videoUrl: 'https://cdn.example.com/generated.mp4',
      provider: 'aliyun',
      model: 'wan2.6-t2v',
    });
    const terminal = await reloadedStore.getVideoTaskRecord(created.id);
    expect(terminal).toMatchObject({
      status: 'succeeded',
      result: { videoUrl: 'https://cdn.example.com/generated.mp4' },
    });
  });

  it('returns the same task for an idempotent create retry', async () => {
    const input = {
      id: 'video:idempotent-task',
      userId: 'video-task-user',
      provider: 'volcengine' as const,
      model: 'doubao-seedance-1-5-pro-251215',
      providerTaskId: 'volc-task-1',
      creditCost: 35,
      consumeTransactionId: 'ai-video:video:idempotent-task',
    };
    const first = await taskStore.createVideoTaskRecord(input);
    const repeated = await taskStore.createVideoTaskRecord(input);
    expect(repeated).toEqual(first);

    const rows = await database.db.select().from(database.aiGenerationTask);
    expect(rows.filter((row) => row.id === input.id)).toHaveLength(1);
  });
});
