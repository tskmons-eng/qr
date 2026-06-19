import { createRequire } from 'node:module'
import { access, readFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function parsePositiveInteger(value, fallback, max) {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) return fallback
  return Math.min(max, Math.round(number))
}

function parseRequiredPositiveInteger(value, flag, max) {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) throw new Error(`${flag} requires a positive number`)
  return Math.min(max, Math.round(number))
}

function parseArgs(argv) {
  const options = {
    clientRequestId: null,
    code: null,
    help: false,
    json: false,
    limit: 20,
    minutes: null,
    orderId: null,
    projectId: null,
    scanLimit: null,
    storeId: null,
    tableId: null,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') {
      options.help = true
    } else if (arg === '--json') {
      options.json = true
    } else if (arg === '--project') {
      options.projectId = argv[i + 1]
      i += 1
    } else if (arg === '--store') {
      options.storeId = argv[i + 1]
      i += 1
    } else if (arg === '--code') {
      options.code = argv[i + 1]
      i += 1
    } else if (arg === '--table') {
      options.tableId = argv[i + 1]
      i += 1
    } else if (arg === '--order') {
      options.orderId = argv[i + 1]
      i += 1
    } else if (arg === '--client-request-id' || arg === '--request') {
      options.clientRequestId = argv[i + 1]
      i += 1
    } else if (arg === '--minutes') {
      options.minutes = parseRequiredPositiveInteger(argv[i + 1], '--minutes', 24 * 60)
      i += 1
    } else if (arg === '--limit') {
      options.limit = parsePositiveInteger(argv[i + 1], options.limit, 100)
      i += 1
    } else if (arg === '--scan-limit') {
      options.scanLimit = parsePositiveInteger(argv[i + 1], 100, 500)
      i += 1
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }

  if (options.projectId === '') throw new Error('--project requires a value')
  if (options.storeId === '') throw new Error('--store requires a value')
  if (options.code === '') throw new Error('--code requires a value')
  if (options.tableId === '') throw new Error('--table requires a value')
  if (options.orderId === '') throw new Error('--order requires a value')
  if (options.clientRequestId === '') throw new Error('--client-request-id requires a value')

  const hasLocalFilters = Boolean(
    options.storeId ||
    options.code ||
    options.tableId ||
    options.orderId ||
    options.clientRequestId ||
    options.minutes
  )
  options.scanLimit = options.scanLimit ?? Math.max(options.limit, hasLocalFilters ? Math.max(options.limit * 5, 100) : options.limit)
  options.sinceMs = options.minutes ? Date.now() - (options.minutes * 60 * 1000) : null
  return options
}

function printHelp() {
  console.log(`Read-only order command failure audit

Usage:
  npm run audit:command-failures
  npm run audit:command-failures -- --minutes 15 --limit 20
  npm run audit:command-failures -- --minutes 60 --store <storeId> --limit 50
  npm run audit:command-failures -- --store <storeId> --limit 20
  npm run audit:command-failures -- --client-request-id <clientRequestId> --json
  npm run audit:command-failures -- --code permission-denied --json

Options:
  --project <projectId>          Firebase project id. Defaults to FIREBASE_PROJECT_ID or .firebaserc.
  --minutes <number>             Filter failures to the last N minutes. Use 15 or 60 during incidents.
  --store <storeId>              Filter recent failures to one store after reading the latest rows.
  --table <tableId>              Filter by tableId or targetTableId.
  --order <orderId>              Filter by orderId.
  --client-request-id <id>       Filter by clientRequestId. Alias: --request.
  --code <errorCode>             Filter recent failures to one command error code.
  --limit <number>               Rows to print. Defaults to 20, max 100.
  --scan-limit <number>          Recent rows to scan before local filtering. Defaults to limit or limit * 5, at least 100 when filtered.
  --json                         Print the full audit result as JSON.
`)
}

async function readDefaultProjectId() {
  const firebasercPath = path.join(rootDir, '.firebaserc')
  try {
    const text = await readFile(firebasercPath, 'utf8')
    return JSON.parse(text).projects?.default ?? null
  } catch {
    return null
  }
}

function loadFirebaseAdmin() {
  const requireFromFunctions = createRequire(new URL('../functions/package.json', import.meta.url))
  try {
    return {
      app: requireFromFunctions('firebase-admin/app'),
      firestore: requireFromFunctions('firebase-admin/firestore'),
    }
  } catch (error) {
    throw new Error(`firebase-admin could not be loaded from functions dependencies: ${error.message}`)
  }
}

async function fileExists(filePath) {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

function defaultCredentialPaths() {
  return [
    process.env.APPDATA
      ? path.join(process.env.APPDATA, 'gcloud', 'application_default_credentials.json')
      : null,
    path.join(os.homedir(), '.config', 'gcloud', 'application_default_credentials.json'),
  ].filter(Boolean)
}

async function assertReadCredentialsAvailable() {
  if (process.env.FIRESTORE_EMULATOR_HOST) return

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    if (await fileExists(process.env.GOOGLE_APPLICATION_CREDENTIALS)) return
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS is set, but the file was not found.')
  }

  for (const credentialPath of defaultCredentialPaths()) {
    if (await fileExists(credentialPath)) return
  }

  throw new Error(
    'Firestore read credentials were not found. Set FIRESTORE_EMULATOR_HOST for emulator reads, or configure GOOGLE_APPLICATION_CREDENTIALS / gcloud application-default credentials.'
  )
}

function serializeTimestamp(value) {
  if (!value) return null
  if (typeof value.toDate === 'function') return value.toDate().toISOString()
  if (value instanceof Date) return value.toISOString()
  return String(value)
}

function timestampToMillis(value) {
  if (!value) return null
  if (typeof value.toMillis === 'function') return value.toMillis()
  if (typeof value.toDate === 'function') return value.toDate().getTime()
  if (value instanceof Date) return value.getTime()
  const parsed = Date.parse(String(value))
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeRow(docSnap) {
  const data = docSnap.data()
  const createdAt = serializeTimestamp(data.createdAt)
  return {
    id: docSnap.id,
    commandType: data.commandType ?? 'unknown_order_command',
    actorType: data.actorType ?? 'unknown',
    storeId: data.storeId ?? null,
    tableId: data.tableId ?? null,
    targetTableId: data.targetTableId ?? null,
    orderId: data.orderId ?? null,
    itemId: data.itemId ?? null,
    clientRequestId: data.clientRequestId ?? null,
    errorCode: data.errorCode ?? 'unknown',
    errorName: data.errorName ?? 'Error',
    errorMessage: data.errorMessage ?? '',
    orderCommandVersion: data.orderCommandVersion ?? null,
    createdAt,
    createdAtMs: timestampToMillis(data.createdAt),
  }
}

function matchesFilters(row, options) {
  if (options.storeId && row.storeId !== options.storeId) return false
  if (options.code && row.errorCode !== options.code) return false
  if (options.tableId && row.tableId !== options.tableId && row.targetTableId !== options.tableId) return false
  if (options.orderId && row.orderId !== options.orderId) return false
  if (options.clientRequestId && row.clientRequestId !== options.clientRequestId) return false
  if (options.sinceMs && (!row.createdAtMs || row.createdAtMs < options.sinceMs)) return false
  return true
}

async function loadRecentFailures(db, options) {
  const snap = await db.collection('orderCommandFailures')
    .orderBy('createdAt', 'desc')
    .limit(options.scanLimit)
    .get()

  return snap.docs
    .map(normalizeRow)
    .filter(row => matchesFilters(row, options))
    .slice(0, options.limit)
}

function countRowsBy(rows, fieldName) {
  const counts = {}
  for (const row of rows) {
    const key = row[fieldName] ?? 'none'
    counts[key] = (counts[key] ?? 0) + 1
  }
  return counts
}

function largestCount(counts) {
  let largest = null
  for (const [key, count] of Object.entries(counts)) {
    if (!largest || count > largest.count) largest = { key, count }
  }
  return largest
}

function formatCounts(counts) {
  const entries = Object.entries(counts)
  if (entries.length === 0) return 'none'
  return entries.map(([key, count]) => `${key}:${count}`).join(', ')
}

function buildDiagnosisSignals(rows) {
  if (rows.length === 0) {
    return ['no_failure_log_in_window']
  }

  const signals = []
  const byErrorCode = countRowsBy(rows, 'errorCode')
  const byCommandType = countRowsBy(rows, 'commandType')
  const permissionFailures = rows.filter(row => (
    row.errorCode === 'permission-denied' ||
    row.errorCode === 'unauthenticated' ||
    row.errorCode === 'failed-precondition'
  ))
  const topError = largestCount(byErrorCode)
  const topCommand = largestCount(byCommandType)

  if (permissionFailures.length > 0) {
    signals.push('rules_or_permission_error_seen')
  }
  if (topError && topError.count >= 3) {
    signals.push(`functions_constant_error_possible:${topError.key}`)
  }
  if (topCommand && topCommand.count >= 3) {
    signals.push(`command_cluster:${topCommand.key}`)
  }
  if (rows.some(row => row.clientRequestId)) {
    signals.push('clientRequestId_trace_available')
  }

  return signals.length > 0 ? signals : ['isolated_or_mixed_failures']
}

function buildSummary(rows) {
  return {
    total: rows.length,
    byErrorCode: countRowsBy(rows, 'errorCode'),
    byCommandType: countRowsBy(rows, 'commandType'),
    byStoreId: countRowsBy(rows, 'storeId'),
    byActorType: countRowsBy(rows, 'actorType'),
    diagnosisSignals: buildDiagnosisSignals(rows),
  }
}

function printTextReport(audit) {
  console.log('Read-only order command failure audit')
  console.log(`Project: ${audit.projectId}`)
  console.log(`Window: ${audit.window.minutes ? `last ${audit.window.minutes} minutes since ${audit.window.since}` : 'latest scanned rows'}`)
  console.log(`Store filter: ${audit.filters.storeId ?? 'none'}`)
  console.log(`Table filter: ${audit.filters.tableId ?? 'none'}`)
  console.log(`Order filter: ${audit.filters.orderId ?? 'none'}`)
  console.log(`Client request filter: ${audit.filters.clientRequestId ?? 'none'}`)
  console.log(`Code filter: ${audit.filters.code ?? 'none'}`)
  console.log(`Source: ${audit.source}`)
  console.log(`Rows: ${audit.rows.length}`)
  console.log(`Error codes: ${formatCounts(audit.summary.byErrorCode)}`)
  console.log(`Commands: ${formatCounts(audit.summary.byCommandType)}`)
  console.log(`Stores: ${formatCounts(audit.summary.byStoreId)}`)
  console.log(`Diagnosis signals: ${audit.summary.diagnosisSignals.join(', ')}`)

  if (audit.rows.length === 0) {
    console.log('\nNo recent order command failures found for the selected filters.')
    return
  }

  console.log('\nRecent failures:')
  for (const row of audit.rows) {
    console.log(`- ${row.createdAt ?? 'unknown-time'} ${row.commandType} ${row.errorCode}`)
    console.log(`  actor=${row.actorType} store=${row.storeId ?? 'none'} table=${row.tableId ?? 'none'} target=${row.targetTableId ?? 'none'} order=${row.orderId ?? 'none'} item=${row.itemId ?? 'none'}`)
    console.log(`  request=${row.clientRequestId ?? 'none'} message=${row.errorMessage}`)
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    printHelp()
    return
  }

  const projectId = options.projectId
    ?? process.env.FIREBASE_PROJECT_ID
    ?? await readDefaultProjectId()
  if (!projectId) throw new Error('Firebase project id was not found. Pass --project or set FIREBASE_PROJECT_ID.')

  await assertReadCredentialsAvailable()

  const { app, firestore } = loadFirebaseAdmin()
  if (app.getApps().length === 0) app.initializeApp({ projectId })
  const db = firestore.getFirestore()
  const rows = await loadRecentFailures(db, options)
  const summary = buildSummary(rows)
  const audit = {
    projectId,
    source: process.env.FIRESTORE_EMULATOR_HOST ? `emulator:${process.env.FIRESTORE_EMULATOR_HOST}` : 'firestore',
    window: {
      minutes: options.minutes,
      since: options.sinceMs ? new Date(options.sinceMs).toISOString() : null,
    },
    filters: {
      storeId: options.storeId,
      tableId: options.tableId,
      orderId: options.orderId,
      clientRequestId: options.clientRequestId,
      code: options.code,
      limit: options.limit,
      scanLimit: options.scanLimit,
    },
    summary,
    rows,
  }

  if (options.json) {
    console.log(JSON.stringify(audit, null, 2))
  } else {
    printTextReport(audit)
  }
}

main().catch(error => {
  console.error(`Order command failure audit failed: ${error.message}`)
  process.exitCode = 1
})
