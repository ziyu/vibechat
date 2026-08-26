export function assertAppId(appId: string) {
  if (!/^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/.test(appId)) {
    throw new TypeError(
      'appId must contain 1-48 lowercase letters, numbers, or hyphens',
    )
  }
}
