import { createFileRoute } from '@tanstack/react-router'
import { spaceAppBrowserSource } from '@vibechat/space-app-sdk/browser-source'

export const Route = createFileRoute('/v1/space-app-sdk')({
  server: {
    handlers: {
      GET: () => new Response(spaceAppBrowserSource, {
        headers: {
          'access-control-allow-origin': '*',
          'cache-control': 'public, max-age=300',
          'content-type': 'text/javascript; charset=utf-8',
          'cross-origin-resource-policy': 'cross-origin',
        },
      }),
    },
  },
})
