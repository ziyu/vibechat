export async function enqueueMatrixSessionRevocation(authSessionId: string) {
  const { createDefaultIdentityService } = await import("@libs/identity");
  await createDefaultIdentityService().revokeSession(authSessionId);
}

export async function drainMatrixSessionRevocations() {
  const { createDefaultMatrixDeviceRevocationWorker } = await import("@libs/identity");
  return createDefaultMatrixDeviceRevocationWorker().drain();
}
