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

const activeRoots = ['apps/backend/src', 'apps/site-app/src', 'apps/web-app/src']
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
]

for (const file of files) {
  const source = await readFile(path.join(root, file), 'utf8')
  for (const match of source.matchAll(importPattern)) {
    const specifier = match[1]
    if (specifier.includes('/apps/') || specifier.startsWith('apps/')) {
      failures.push(`${file}: app-to-app import is forbidden (${specifier})`)
    }
    if (file.startsWith('apps/site-app/') || file.startsWith('apps/web-app/')) {
      if (serverOnlyClientImports.some((prefix) => specifier === prefix || specifier.startsWith(`${prefix}/`))) {
        failures.push(`${file}: client host imports server-only module (${specifier})`)
      }
      if (specifier === '@libs/auth' || specifier === '@libs/auth/auth') {
        failures.push(`${file}: client host must import only the Better Auth client entry`)
      }
      if (specifier === '../../config.ts' || specifier === '@config/server') {
        failures.push(`${file}: client host imports server configuration (${specifier})`)
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
