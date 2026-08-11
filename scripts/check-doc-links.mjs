import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, extname, join, normalize, relative, resolve } from 'node:path'

const root = process.cwd()
const ignoredDirectories = new Set([
  '.git',
  '.next',
  '.output',
  '.turbo',
  'dist',
  'node_modules',
  'playwright-report',
  'test-results',
])

const sourceExtensions = new Set(['.md', '.mdx'])
const linkPattern = /!?\[[^\]]*\]\(([^)]+)\)/g
const errors = []

const stableTypeRules = [
  ['docs/stable/designs/', /(?:文档类型：设计|Document type:\s*Design)/i],
  ['docs/stable/runbooks/', /文档类型：Runbook/i],
  ['docs/stable/references/', /文档类型：参考资料/i],
  ['docs/stable/release-notes/', /文档类型：发布说明/i],
  ['docs/stable/plans/', /文档类型：计划/i],
]

function isArchived(path) {
  return path.startsWith(`docs${process.platform === 'win32' ? '\\' : '/'}archive`)
}

function collect(directory) {
  const files = []

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue

    const absolutePath = join(directory, entry.name)
    const repoPath = relative(root, absolutePath)

    if (entry.isDirectory()) {
      if (!isArchived(repoPath)) files.push(...collect(absolutePath))
      continue
    }

    if (sourceExtensions.has(extname(entry.name))) files.push(absolutePath)
  }

  return files
}

function localTarget(rawTarget) {
  let target = rawTarget.trim()
  if (target.startsWith('<') && target.endsWith('>')) target = target.slice(1, -1)
  target = target.split(/\s+["']/)[0]

  if (
    target === '' ||
    target.startsWith('#') ||
    target.startsWith('/') ||
    target.startsWith('//') ||
    /^[a-z][a-z\d+.-]*:/i.test(target)
  ) {
    return null
  }

  const withoutFragment = target.split('#')[0].split('?')[0]
  if (!withoutFragment) return null

  try {
    return decodeURIComponent(withoutFragment)
  } catch {
    return withoutFragment
  }
}

for (const file of collect(root)) {
  const content = readFileSync(file, 'utf8')
  const repoPath = relative(root, file).replaceAll('\\', '/')
  let match

  if (repoPath.startsWith('docs/stable/') && !repoPath.endsWith('/README.md')) {
    if (!/(?:生命周期：长期稳定|Lifecycle:\s*Stable)/i.test(content)) {
      errors.push(`${repoPath}: missing stable lifecycle metadata`)
    }

    const typeRule = stableTypeRules.find(([prefix]) => repoPath.startsWith(prefix))
    if (!typeRule) {
      errors.push(`${repoPath}: file is not inside a recognized stable document type`)
    } else if (!typeRule[1].test(content)) {
      errors.push(`${repoPath}: document type does not match its stable directory`)
    }
  }

  while ((match = linkPattern.exec(content)) !== null) {
    const target = localTarget(match[1])
    if (!target) continue

    const absoluteTarget = normalize(resolve(dirname(file), target))
    if (!absoluteTarget.startsWith(root) || !existsSync(absoluteTarget)) {
      const line = content.slice(0, match.index).split('\n').length
      errors.push(`${relative(root, file)}:${line} -> ${match[1]}`)
      continue
    }

    if (statSync(absoluteTarget).isDirectory() && !existsSync(join(absoluteTarget, 'README.md'))) {
      const line = content.slice(0, match.index).split('\n').length
      errors.push(`${relative(root, file)}:${line} -> ${match[1]} (directory has no README.md)`)
    }
  }
}

if (errors.length > 0) {
  console.error('Documentation checks failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log('Documentation checks passed (archive excluded).')
