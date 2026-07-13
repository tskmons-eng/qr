import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { gzipSync } from 'node:zlib'

const rootDir = process.cwd()
const distDir = path.join(rootDir, 'dist')
const MAX_INITIAL_JS_GZIP = 300 * 1024
const MAX_INITIAL_CSS_GZIP = 30 * 1024
const BANNED_INITIAL_CHUNKS = [
  /jspdf/i,
  /heic/i,
  /image-compression/i,
  /html2canvas/i,
  /canvg/i,
]

function parseArgs(argv) {
  const options = { json: false }
  for (const arg of argv) {
    if (arg === '--json') options.json = true
    else if (arg === '--help' || arg === '-h') options.help = true
    else throw new Error(`Unknown argument: ${arg}`)
  }
  return options
}

function assetPathFromUrl(url) {
  return path.join(distDir, url.replace(/^\//, '').replaceAll('/', path.sep))
}

function extractStaticImports(source) {
  const imports = new Set()
  const declarationPattern = /(?:^|[;\n])\s*(?:import|export)(?!\s*\()(?:(?![;\n]).)*?\bfrom\s*["']([^"']+)["']/g
  const sideEffectPattern = /(?:^|[;\n])\s*import\s*["']([^"']+)["']/g
  for (const match of source.matchAll(declarationPattern)) imports.add(match[1])
  for (const match of source.matchAll(sideEffectPattern)) imports.add(match[1])
  return [...imports]
}

async function collectInitialModuleGraph(entryUrl) {
  const queue = [entryUrl]
  const visited = new Set()

  while (queue.length > 0) {
    const currentUrl = queue.shift()
    if (visited.has(currentUrl)) continue
    visited.add(currentUrl)
    const currentPath = assetPathFromUrl(currentUrl)
    const source = await readFile(currentPath, 'utf8')
    const currentDir = path.posix.dirname(currentUrl)
    for (const imported of extractStaticImports(source)) {
      if (!imported.startsWith('.')) continue
      const importedUrl = path.posix.normalize(path.posix.join(currentDir, imported))
      if (importedUrl.endsWith('.js')) queue.push(importedUrl)
    }
  }

  return [...visited].sort()
}

async function gzipSize(fileUrl) {
  const bytes = await readFile(assetPathFromUrl(fileUrl))
  return gzipSync(bytes, { level: 9 }).byteLength
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    console.log('Usage: npm run check:performance-budget -- [--json]')
    return
  }

  const html = await readFile(path.join(distDir, 'index.html'), 'utf8')
  const entryMatch = html.match(/<script[^>]+type=["']module["'][^>]+src=["']([^"']+\.js)["']/)
  if (!entryMatch) throw new Error('dist/index.html module entry was not found. Run npm run build first.')
  const stylesheetUrls = [...html.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+\.css)["']/g)]
    .map(match => match[1])
  const initialJs = await collectInitialModuleGraph(entryMatch[1])
  const initialJsRows = await Promise.all(initialJs.map(async url => ({ url, gzipBytes: await gzipSize(url) })))
  const initialCssRows = await Promise.all(stylesheetUrls.map(async url => ({ url, gzipBytes: await gzipSize(url) })))
  const initialJsGzipBytes = initialJsRows.reduce((sum, row) => sum + row.gzipBytes, 0)
  const initialCssGzipBytes = initialCssRows.reduce((sum, row) => sum + row.gzipBytes, 0)
  const bannedInitialChunks = initialJs.filter(url => BANNED_INITIAL_CHUNKS.some(pattern => pattern.test(url)))
  const result = {
    status: initialJsGzipBytes <= MAX_INITIAL_JS_GZIP
      && initialCssGzipBytes <= MAX_INITIAL_CSS_GZIP
      && bannedInitialChunks.length === 0
      ? 'PASS'
      : 'FAIL',
    budgets: {
      maxInitialJsGzipBytes: MAX_INITIAL_JS_GZIP,
      maxInitialCssGzipBytes: MAX_INITIAL_CSS_GZIP,
    },
    actual: {
      initialJsGzipBytes,
      initialCssGzipBytes,
      initialJs: initialJsRows,
      initialCss: initialCssRows,
      bannedInitialChunks,
    },
  }

  if (options.json) console.log(JSON.stringify(result, null, 2))
  else {
    console.log(`Performance budget: ${result.status}`)
    console.log(`Initial JS gzip: ${initialJsGzipBytes} / ${MAX_INITIAL_JS_GZIP} bytes`)
    console.log(`Initial CSS gzip: ${initialCssGzipBytes} / ${MAX_INITIAL_CSS_GZIP} bytes`)
    console.log(`Initial JS files: ${initialJs.join(', ')}`)
    console.log(`Forbidden initial chunks: ${bannedInitialChunks.join(', ') || 'none'}`)
  }

  if (result.status !== 'PASS') process.exitCode = 1
}

main().catch(error => {
  console.error(`Performance budget check failed: ${error.message}`)
  process.exitCode = 1
})
