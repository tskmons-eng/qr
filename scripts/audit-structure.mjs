import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const srcDir = path.join(root, 'src')
const maxReportedFiles = 15
const largeFileLineLimit = 300

async function collectFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = await Promise.all(entries.map(async entry => {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) return collectFiles(fullPath)
    if (!/\.(jsx?|css)$/.test(entry.name)) return []
    return [fullPath]
  }))
  return files.flat()
}

const files = await collectFiles(srcDir)
const rows = await Promise.all(files.map(async file => {
  const text = await readFile(file, 'utf8')
  return {
    lines: text.split(/\r?\n/).length,
    path: path.relative(root, file).replaceAll(path.sep, '/'),
  }
}))

rows.sort((a, b) => b.lines - a.lines)

console.log('Largest source files:')
for (const row of rows.slice(0, maxReportedFiles)) {
  console.log(`${String(row.lines).padStart(5)}  ${row.path}`)
}

const oversized = rows.filter(row => row.lines > largeFileLineLimit)
if (oversized.length > 0) {
  console.log(`\nRefactor candidates over ${largeFileLineLimit} lines: ${oversized.length}`)
}
