import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function pinnedNodeVersion() {
  try {
    return readFileSync(join(repositoryRoot, '.node-version'), 'utf8').trim()
  } catch {
    return ''
  }
}

function pinnedNodeCandidates(version) {
  if (!version) return []
  const userDirectory = homedir()
  return [
    process.env.PNPM_HOME
      ? join(process.env.PNPM_HOME, 'nodejs', version, 'bin', 'node')
      : undefined,
    join(userDirectory, 'Library', 'pnpm', 'nodejs', version, 'bin', 'node'),
    join(userDirectory, '.local', 'share', 'pnpm', 'nodejs', version, 'bin', 'node'),
    join(userDirectory, '.nvm', 'versions', 'node', `v${version}`, 'bin', 'node'),
    join(
      userDirectory,
      '.fnm',
      'node-versions',
      `v${version}`,
      'installation',
      'bin',
      'node',
    ),
    join(userDirectory, '.local', 'share', 'mise', 'installs', 'node', version, 'bin', 'node'),
  ]
}

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
  const pinnedVersion = pinnedNodeVersion()
  const compatibleNode = [
    process.env.VIBECHAT_NODE_BIN,
    ...pinnedNodeCandidates(pinnedVersion),
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
