import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import {
  classifyFailureAudit,
  classifyPendingAudit,
  combineLevels,
} from './lib/health-monitor.mjs'

const execFileAsync = promisify(execFile)
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const baseUrl = 'https://qrproduct-3340b.web.app'
const routePaths = ['/', '/login', '/admin', '/staff', '/staff/kitchen', '/order/test-token']

function parseArgs(argv) {
  const options = { deep: false, json: false, minutes: 60 }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--deep') options.deep = true
    else if (arg === '--json') options.json = true
    else if (arg === '--minutes') {
      const value = Number(argv[i + 1])
      if (!Number.isInteger(value) || value < 1 || value > 1440) {
        throw new Error('--minutes requires an integer from 1 to 1440')
      }
      options.minutes = value
      i += 1
    } else if (arg === '--help' || arg === '-h') options.help = true
    else throw new Error(`Unknown argument: ${arg}`)
  }
  return options
}

function safeCommandError(label, result) {
  return {
    label,
    exitCode: result.exitCode,
  }
}

async function runCommand(command, args, { label } = {}) {
  const startedAt = Date.now()
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      cwd: rootDir,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
      windowsHide: true,
    })
    return { ok: true, label, exitCode: 0, durationMs: Date.now() - startedAt, stdout, stderr }
  } catch (error) {
    return {
      ok: false,
      label,
      exitCode: Number(error.code) || 1,
      durationMs: Date.now() - startedAt,
      stdout: error.stdout ?? '',
      stderr: error.stderr ?? '',
    }
  }
}

async function runNpmScript(scriptName) {
  if (process.platform === 'win32') {
    return runCommand(process.env.ComSpec, ['/d', '/s', '/c', 'npm', 'run', scriptName], {
      label: `npm run ${scriptName}`,
    })
  }
  return runCommand('npm', ['run', scriptName], { label: `npm run ${scriptName}` })
}

async function readJsonCommand(scriptPath, args, label) {
  const result = await runCommand(process.execPath, [scriptPath, ...args], { label })
  if (!result.ok) throw new Error(`${label} failed`)
  try {
    return JSON.parse(result.stdout)
  } catch {
    throw new Error(`${label} returned invalid JSON`)
  }
}

async function runLocalChecks(options) {
  const git = await runCommand('git', ['status', '--porcelain=v1', '--branch'], { label: 'git status' })
  const gitLines = git.stdout.split(/\r?\n/).filter(Boolean)
  const dirty = gitLines.slice(1).length > 0
  const check = await runNpmScript('check')
  const build = await runNpmScript('build')
  const performance = build.ok
    ? await runCommand(process.execPath, ['scripts/check-performance-budget.mjs', '--json'], { label: 'performance budget' })
    : { ok: false, label: 'performance budget', exitCode: 1, durationMs: 0, stdout: '', stderr: '' }
  const emulator = options.deep
    ? await runNpmScript('check:order-functions-emulator')
    : null

  const stepResults = [git, check, build, performance, ...(emulator ? [emulator] : [])]
  const failed = stepResults.filter(result => !result.ok)
  const level = failed.length > 0 ? 'FAIL' : dirty ? 'WARN' : 'PASS'

  return {
    level,
    git: { ok: git.ok, dirty },
    check: { ok: check.ok, durationMs: check.durationMs },
    build: { ok: build.ok, durationMs: build.durationMs },
    performance: performance.ok
      ? { ok: true, durationMs: performance.durationMs, ...JSON.parse(performance.stdout) }
      : { ok: false, durationMs: performance.durationMs },
    emulator: emulator ? { ok: emulator.ok, durationMs: emulator.durationMs } : { skipped: true },
    failures: failed.map(result => safeCommandError(result.label, result)),
  }
}

function extractAssets(html) {
  return [...html.matchAll(/(?:src|href)=["'](\/assets\/[^"']+)["']/g)]
    .map(match => match[1])
    .filter((value, index, rows) => rows.indexOf(value) === index)
}

async function fetchWithTimeout(url, options = {}) {
  return fetch(url, {
    ...options,
    headers: { 'user-agent': 'QRSystemHealthMonitor/1.0', ...(options.headers ?? {}) },
    signal: AbortSignal.timeout(12_000),
  })
}

async function runHttpSmoke() {
  try {
    const routeRows = await Promise.all(routePaths.map(async routePath => {
      const response = await fetchWithTimeout(`${baseUrl}${routePath}`)
      const html = await response.text()
      return {
        path: routePath,
        status: response.status,
        htmlShell: response.ok && html.includes('id="root"'),
        cacheControl: response.headers.get('cache-control'),
        assets: routePath === '/' ? extractAssets(html) : [],
      }
    }))
    const assets = routeRows.flatMap(row => row.assets)
    const assetRows = await Promise.all(assets.map(async assetPath => {
      const response = await fetchWithTimeout(`${baseUrl}${assetPath}`, { method: 'HEAD' })
      return {
        path: assetPath,
        status: response.status,
        cacheControl: response.headers.get('cache-control'),
      }
    }))
    const ok = routeRows.every(row => row.status === 200 && row.htmlShell)
      && assetRows.length > 0
      && assetRows.every(row => row.status === 200)
    return { level: ok ? 'PASS' : 'FAIL', routes: routeRows.map(({ assets: _assets, ...row }) => row), assets: assetRows }
  } catch {
    return { level: 'FAIL', routes: [], assets: [], error: 'production_http_smoke_failed' }
  }
}

async function runProductionChecks(options, baseline) {
  const http = await runHttpSmoke()
  let failures
  let pending

  try {
    const audit = await readJsonCommand(
      'scripts/audit-order-command-failures.mjs',
      ['--minutes', String(options.minutes), '--limit', '100', '--json'],
      'order command failure audit'
    )
    failures = classifyFailureAudit(audit)
  } catch {
    failures = { level: 'FAIL', reasons: ['order_command_failure_audit_unavailable'], safe: null }
  }

  try {
    const audit = await readJsonCommand('scripts/audit-pending-counts.mjs', ['--json'], 'pending count audit')
    pending = classifyPendingAudit(audit, baseline)
  } catch {
    pending = { level: 'FAIL', reasons: ['pending_count_audit_unavailable'], safe: null }
  }

  return {
    level: combineLevels([http.level, failures.level, pending.level]),
    http,
    orderFailures: failures,
    pending,
  }
}

function printTextReport(report) {
  console.log(`QR system health monitor: ${report.status}`)
  console.log(`Generated: ${report.generatedAt}`)
  console.log(`Mode: ${report.mode}`)
  console.log(`Local: ${report.local.level} (git=${report.local.git.dirty ? 'dirty' : 'clean'}, check=${report.local.check.ok ? 'pass' : 'fail'}, build=${report.local.build.ok ? 'pass' : 'fail'}, performance=${report.local.performance.ok ? 'pass' : 'fail'})`)
  if (!report.local.emulator.skipped) console.log(`Emulator: ${report.local.emulator.ok ? 'pass' : 'fail'}`)
  console.log(`Production HTTP: ${report.production.http.level}`)
  console.log(`Order failures: ${report.production.orderFailures.level} (${report.production.orderFailures.safe?.total ?? 'unavailable'} rows)`)
  console.log(`Pending consistency: ${report.production.pending.level} (drift=${report.production.pending.safe?.driftedTableCount ?? 'unavailable'}, itemIssues=${report.production.pending.safe?.itemIssueCount ?? 'unavailable'})`)
  for (const failure of report.local.failures) {
    console.log(`Local failure: ${failure.label} exit=${failure.exitCode}`)
  }
  console.log('No files, Firebase data, Git state, or deployments were changed by this monitor.')
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    console.log(`Read-only QR system health monitor

Usage:
  npm run monitor:health
  npm run monitor:health -- --minutes 15 --json
  npm run monitor:health:deep
`)
    return
  }

  const baseline = JSON.parse(await readFile(path.join(rootDir, 'scripts', 'monitor-health-baseline.json'), 'utf8'))
  const [local, production] = await Promise.all([
    runLocalChecks(options),
    runProductionChecks(options, baseline),
  ])
  const status = combineLevels([local.level, production.level])
  const report = {
    version: 1,
    generatedAt: new Date().toISOString(),
    status,
    mode: options.deep ? 'deep' : 'standard',
    minutes: options.minutes,
    local,
    production,
  }

  if (options.json) console.log(JSON.stringify(report, null, 2))
  else printTextReport(report)
  if (status === 'WARN' || status === 'FAIL') process.exitCode = 1
}

main().catch(error => {
  console.error(`Health monitor failed: ${error.message}`)
  process.exitCode = 1
})
