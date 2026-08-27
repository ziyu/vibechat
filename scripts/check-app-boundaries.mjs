import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.mts'])

async function sourceFiles(directory) {
  const entries = await readdir(path.join(root, directory), { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const relative = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      if (['node_modules', '.output', 'dist'].includes(entry.name)) continue
      files.push(...await sourceFiles(relative))
    } else if (sourceExtensions.has(path.extname(entry.name))) {
      files.push(relative)
    }
  }
  return files
}

const activeRoots = [
  'apps/backend/src',
  'apps/admin-app/src',
  'apps/site-app/src',
  'apps/space-runtime/src',
  'apps/web-app/src',
  'packages/api-contracts/src',
  'packages/auth-client/src',
  'packages/i18n/src',
  'packages/matrix-client/src',
  'packages/platform-contracts/src',
  'packages/react-shared/src',
  'packages/ui/src',
  'packages/validators/src',
  'packages/product-client/src',
  'packages/product-core/src',
  'packages/space-app-contracts/src',
  'packages/space-app-components/src',
  'packages/space-app-sdk/src',
]
const files = (await Promise.all(activeRoots.map(sourceFiles))).flat()
const failures = []
const importPattern = /(?:from\s*|import\s*\()\s*['"]([^'"]+)['"]/g
const serverOnlyClientImports = [
  '@libs/database',
  '@libs/payment',
  '@libs/credits',
  '@libs/ai',
  '@libs/storage',
  '@libs/identity',
  '@libs/social',
  '@libs/rooms',
  '@libs/product-state',
  '@libs/affiliate',
  '@libs/permissions',
  '@libs/pricing',
]
const packageDependencyPolicy = {
  '@vibechat/api-contracts': new Set(['@vibechat/space-app-contracts']),
  '@vibechat/auth-client': new Set(),
  '@vibechat/i18n': new Set(),
  '@vibechat/product-core': new Set(),
  '@vibechat/space-app-dependencies': new Set(),
  '@vibechat/space-app-contracts': new Set(),
  '@vibechat/space-app-components': new Set([
    '@vibechat/space-app-dependencies',
    '@vibechat/space-app-sdk',
  ]),
  '@vibechat/space-app-sdk': new Set(['@vibechat/space-app-contracts']),
  '@vibechat/platform-contracts': new Set(),
  '@vibechat/ui': new Set(),
  '@vibechat/validators': new Set([
    '@vibechat/api-contracts',
    '@vibechat/i18n',
  ]),
  '@vibechat/react-shared': new Set([
    '@vibechat/i18n',
    '@vibechat/ui',
    '@vibechat/validators',
  ]),
  '@vibechat/product-client': new Set(['@vibechat/api-contracts']),
  '@vibechat/matrix-client': new Set([
    '@vibechat/api-contracts',
    '@vibechat/product-core',
  ]),
}

function packageNameFor(file) {
  const match = file.match(/^packages\/([^/]+)\//)
  return match ? `@vibechat/${match[1]}` : null
}

for (const file of files) {
  const source = await readFile(path.join(root, file), 'utf8')
  for (const match of source.matchAll(importPattern)) {
    const specifier = match[1]
    if (specifier.includes('/apps/') || specifier.startsWith('apps/')) {
      failures.push(`${file}: app-to-app import is forbidden (${specifier})`)
    }
    const sourcePackage = packageNameFor(file)
    if (sourcePackage) {
      if (specifier.startsWith('@/') || specifier.startsWith('@libs/')) {
        failures.push(`${file}: package imports repository source alias (${specifier})`)
      }
      const dependencyPackage = specifier.match(/^(@vibechat\/[^/]+)/)?.[1]
      if (dependencyPackage
        && dependencyPackage !== sourcePackage
        && !packageDependencyPolicy[sourcePackage].has(dependencyPackage)) {
        failures.push(`${file}: package dependency is not allowed (${sourcePackage} -> ${dependencyPackage})`)
      }
    }
    if (file.startsWith('apps/site-app/') || file.startsWith('apps/web-app/') || file.startsWith('apps/admin-app/')) {
      if (serverOnlyClientImports.some((prefix) => specifier === prefix || specifier.startsWith(`${prefix}/`))) {
        failures.push(`${file}: client host imports server-only module (${specifier})`)
      }
      if (specifier === '@libs/auth' || specifier.startsWith('@libs/auth/')) {
        failures.push(`${file}: client host must use @vibechat/auth-client (${specifier})`)
      }
      if (specifier === '../../config.ts' || specifier === '@config/server') {
        failures.push(`${file}: client host imports server configuration (${specifier})`)
      }
      if (specifier === 'matrix-js-sdk' || specifier.startsWith('matrix-js-sdk/')) {
        failures.push(`${file}: client host must use @vibechat/matrix-client (${specifier})`)
      }
    }
  }
}

if (failures.length > 0) {
  console.error('Application boundary violations:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(`Application boundaries OK (${files.length} active source files checked).`)
