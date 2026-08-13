interface ProviderErrorLike {
  name?: unknown
  statusCode?: unknown
  code?: unknown
}

/** Safe structured fields for logs; deliberately excludes provider payloads and request bodies. */
export function summarizeAIError(error: unknown) {
  const value = error && typeof error === 'object' ? error as ProviderErrorLike : null
  return {
    name: typeof value?.name === 'string' ? value.name : 'Error',
    statusCode: typeof value?.statusCode === 'number' ? value.statusCode : undefined,
    code: typeof value?.code === 'string' ? value.code : undefined,
  }
}
