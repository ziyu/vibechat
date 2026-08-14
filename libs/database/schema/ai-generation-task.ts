import { getDialect } from '../shared/dialect';
import * as pgSchema from './pg/ai-generation-task';
import * as sqliteSchema from './sqlite/ai-generation-task';

export type { AiGenerationTask, NewAiGenerationTask } from './pg/ai-generation-task';

const implementation = (
  (getDialect() === 'sqlite' || getDialect() === 'd1') ? sqliteSchema : pgSchema
) as typeof pgSchema;

export const aiGenerationTask = implementation.aiGenerationTask;
