import { createAuthClient } from "better-auth/react"
import {
  adminClient,
  emailOTPClient,
  genericOAuthClient,
  phoneNumberClient,
} from "better-auth/client/plugins"

export type VibeAuthClientOptions = {
  baseURL?: string
}

function createPlugins() {
  return [
    genericOAuthClient(),
    adminClient(),
    emailOTPClient(),
    phoneNumberClient(),
  ]
}

export function createVibeAuthClient(options: VibeAuthClientOptions = {}) {
  return createAuthClient({
    ...(options.baseURL ? { baseURL: options.baseURL } : {}),
    plugins: createPlugins(),
  })
}

export const authClientReact = createVibeAuthClient()
