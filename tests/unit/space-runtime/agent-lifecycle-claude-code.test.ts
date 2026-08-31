import type {
  ProjectTurnResult,
  SpaceAgentTurnInput,
} from '../../../apps/space-runtime/src/adapters/contract'
import {
  createClaudeCodeAgentAdapter,
} from '../../../apps/space-runtime/src/adapters/claude-code/adapter'
import { runAgentLifecycleContractSuite } from './agent-lifecycle-contract'

const identity = {
  adapterKey: 'claude-code',
  adapterVersion: '0.2.7',
}

runAgentLifecycleContractSuite(
  'Claude Code Agent Adapter',
  (options) => createClaudeCodeAgentAdapter({
    restoreMode: options?.restoreMode,
    projectTurnRunner: deterministicClaudeCodeRunner,
    isAvailable: () => true,
  }),
  identity,
)

async function deterministicClaudeCodeRunner(
  input: SpaceAgentTurnInput,
  signal: AbortSignal,
): Promise<ProjectTurnResult> {
  await waitForTurnBoundary(signal)
  if (input.request.includes('[fake:revision]')) {
    await input.onProgress?.({
      type: 'activity',
      label: 'edit',
      status: 'completed',
      path: 'src/claude-code-note.ts',
    })
    return {
      kind: 'revision',
      files: {
        ...input.files,
        'src/claude-code-note.ts': `export const note = ${JSON.stringify(input.request)};\n`,
      },
      summary: 'Claude Code created a deterministic revision.',
      usage: { inputTokens: 8, outputTokens: 5, totalTokens: 13 },
    }
  }
  await input.onProgress?.({
    type: 'agent_delta',
    text: `Claude Code received: ${input.request}`,
  })
  return {
    kind: 'chat',
    message: `Claude Code received: ${input.request}`,
    usage: { inputTokens: 8, outputTokens: 5, totalTokens: 13 },
  }
}

function waitForTurnBoundary(signal: AbortSignal) {
  signal.throwIfAborted()
  return new Promise<void>((resolve, reject) => {
    const immediate = setImmediate(() => {
      signal.removeEventListener('abort', abort)
      resolve()
    })
    const abort = () => {
      clearImmediate(immediate)
      reject(signal.reason instanceof Error
        ? signal.reason
        : new Error('Claude Code test Turn cancelled'))
    }
    signal.addEventListener('abort', abort, { once: true })
  })
}
