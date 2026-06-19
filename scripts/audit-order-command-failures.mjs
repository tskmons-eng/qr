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

function parseArgs(argv) {
  const options = {
    code: null,
    help: false,
    json: false,
    limit: 20,
    projectId: null,
    scanLimit: null,
    storeId: null,
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
  options.scanLimit = options.scanLimit ?? Math.max(options.limit, options.storeId || options.code ? options.limit * 5 : options.limit)
  return options
}

function printHelp() {
  console.log(`Read-only order command failure audit

Usage:
  npm run audit:command-failures
  npm run audit:command-failures -- --store <storeId> --limit 20
  npm run audit:command-failures -- --code permission-denied --json

Options:
  --project <projectId>  Firebase project id. Defaults to FIREBASE_PROJECT_ID or .firebaserc.
  --store <storeId>      Filter recent failures to one store after reading the latest rows.
  --code <errorCode>     Filter recent failures to one command error code.
  --limit <number>       Rows to print. Defaults to 20, max 100.
  --scan-limit <number>  Recent rows to scan before local filtering. Defaults to limit or limit * 5.
  --json                 Print the full audit result as JSON.
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

function normalizeRow(docSnap) {
  const data = docSnap.data()
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
    createdAt: serializeTimestamp(data.createdAt),
  }
}

function matchesFilters(row, options) {
  if (options.storeId && row.storeId !== options.storeId) return false
  if (options.code && row.errorCode !== options.code) return false
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

function printTextReport(audit) {
  console.log('Read-only order command failure audit')
  console.log(`Project: ${audit.projectId}`)
  console.log(`Store filter: ${audit.filters.storeId ?? 'none'}`)
  console.log(`Code filter: ${audit.filters.code ?? 'none'}`)
  console.log(`Source: ${audit.source}`)
  console.log(`Rows: ${audit.rows.length}`)

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
  const audit = {
    projectId,
    source: process.env.FIRESTORE_EMULATOR_HOST ? `emulator:${process.env.FIRESTORE_EMULATOR_HOST}` : 'firestore',
    filters: {
      storeId: options.storeId,
      code: options.code,
      limit: options.limit,
      scanLimit: options.scanLimit,
    },
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
