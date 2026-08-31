import { z } from 'zod'

const diagnosticValueSchema = z.union([
  z.string().max(512),
  z.number().finite(),
  z.boolean(),
  z.null(),
])

export const agentSessionActionSchema = z.enum(['none', 'retry', 'rebuild', 'close'])
export const agentBillingStateSchema = z.enum([
  'unbilled',
  'reserved',
  'billable',
  'refund_required',
  'settled',
  'refunded',
  'unknown',
])

export const agentErrorV1Schema = z.object({
  schemaVersion: z.literal('vibechat.agent-error/v1'),
  code: z.string().trim().min(1).max(128).regex(/^[A-Z0-9_]+$/),
  retryable: z.boolean(),
  sessionAction: agentSessionActionSchema,
  billingState: agentBillingStateSchema,
  diagnostics: z.record(z.string().trim().min(1).max(64), diagnosticValueSchema)
    .superRefine((value, context) => {
      if (JSON.stringify(value).length > 4_096) {
        context.addIssue({
          code: 'custom',
          message: 'Agent diagnostics must not exceed 4096 serialized characters',
        })
      }
    }),
}).strict()

export type AgentErrorV1 = z.infer<typeof agentErrorV1Schema>
