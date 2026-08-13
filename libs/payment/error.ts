interface PaymentErrorLike {
  name?: unknown
  status?: unknown
  statusCode?: unknown
  code?: unknown
}

/** Safe structured fields for payment logs; excludes request bodies, headers and provider payloads. */
export function summarizePaymentError(error: unknown) {
  const value = error && typeof error === 'object' ? error as PaymentErrorLike : null
  const status = typeof value?.status === 'number' ? value.status
    : typeof value?.statusCode === 'number' ? value.statusCode : undefined
  return {
    name: typeof value?.name === 'string' ? value.name : 'Error',
    status,
    code: typeof value?.code === 'string' ? value.code : undefined,
  }
}
