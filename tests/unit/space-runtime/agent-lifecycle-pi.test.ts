import type {
  ProjectTurnResult,
  SpaceAgentTurnInput,
} from '../../../apps/space-runtime/src/adapters/contract'
import { createPiAgentAdapter } from '../../../apps/space-runtime/src/adapters/pi/adapter'
import { runAgentLifecycleContractSuite } from './agent-lifecycle-contract'

const identity = {
  adapterKey: 'pi',
  adapterVersion: '0.2.7',
}

runAgentLifecycleContractSuite(
  'Pi Agent Adapter',
  (options) => createPiAgentAdapter({
    restoreMode: options?.restoreMode,
    projectTurnRunner: deterministicPiRunner,
  }),
  identity,
)

async function deterministicPiRunner(
  input: SpaceAgentTurnInput,
  signal: AbortSignal,
): Promise<ProjectTurnResult> {
  await waitForTurnBoundary(signal)
  if (input.request.includes('[fake:revision]')) {
    await input.onProgress?.({
      type: 'activity',
      label: 'edit',
      status: 'completed',
      path: 'src/pi-agent-note.ts',
    })
    return {
      kind: 'revision',
      files: {
        ...input.files,
        'src/pi-agent-note.ts': `export const note = ${JSON.stringify(input.request)};\n`,
      },
      summary: 'Pi created a deterministic revision.',
      usage: { inputTokens: 8, outputTokens: 5, totalTokens: 13 },
    }
  }
  await input.onProgress?.({
    type: 'agent_delta',
    text: `Pi received: ${input.request}`,
  })
  return {
    kind: 'chat',
    message: `Pi received: ${input.request}`,
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
        : new Error('Pi test Turn cancelled'))
    }
    signal.addEventListener('abort', abort, { once: true })
  })
}
