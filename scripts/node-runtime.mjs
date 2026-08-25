import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname } from 'node:path'

export function isSupportedNode(nodePath) {
  if (!nodePath || !existsSync(nodePath)) return false
  const result = spawnSync(nodePath, ['-p', 'process.versions.node'], {
    encoding: 'utf8',
  })
  if (result.status !== 0) return false
  const major = Number.parseInt(result.stdout.trim().split('.')[0] || '', 10)
  return major >= 22 && major < 26
}

export function resolveCompatibleNode() {
  const compatibleNode = [
    process.env.VIBECHAT_NODE_BIN,
    process.execPath,
    '/opt/homebrew/opt/node@24/bin/node',
    '/usr/local/opt/node@24/bin/node',
    '/opt/homebrew/opt/node@22/bin/node',
    '/usr/local/opt/node@22/bin/node',
  ].find(isSupportedNode)

  if (!compatibleNode) {
    throw new Error(
      `VibeChat requires Node >=22 <26; current version is ${process.versions.node}. Install Node 22 or 24, or set VIBECHAT_NODE_BIN.`,
    )
  }
  return compatibleNode
}

export function environmentForNode(nodePath, environment = process.env) {
  return {
    ...environment,
    PATH: `${dirname(nodePath)}:${environment.PATH || ''}`,
  }
}
