import type { z } from 'zod'

export type ContractSchema<T> = z.ZodType<T>
