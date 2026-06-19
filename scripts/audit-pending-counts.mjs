import { createRequire } from 'node:module'
import { access, readFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  TABLE_PENDING_AGGREGATE_VERSION,
  countPendingItemsByTable,
  createPendingCounts,
  readLegacyTablePending,
  readTablePendingAggregate,
} from '../src/lib/tablePending.js'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function parseArgs(argv) {
  const options = {
    failOnDrift: false,
    json: false,
    projectId: null,
    storeId: null,
    help: false,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') {
      options.help = true
    } else if (arg === '--json') {
      options.json = true
    } else if (arg === '--fail-on-drift') {
      options.failOnDrift = true
    } else if (arg === '--project') {
      options.projectId = argv[i + 1]
      i += 1
    } else if (arg === '--store') {
      options.storeId = argv[i + 1]
      i += 1
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }

  if (options.projectId === '') throw new Error('--project requires a value')
  if (options.storeId === '') throw new Error('--store requires a value')
  return options
}

function printHelp() {
  console.log(`Read-only Firestore pending count audit

Usage:
  npm run audit:pending-counts
  npm run audit:pending-counts -- --store <storeId>
  npm run audit:pending-counts -- --project <projectId> --json

Options:
  --project <projectId>  Firebase project id. Defaults to FIREBASE_PROJECT_ID or .firebaserc.
  --store <storeId>      Limit tables and orderItems to one store.
  --json                 Print the full audit result as JSON.
  --fail-on-drift        Exit with code 1 when drift is found.
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

async function loadRows(db, collectionName, storeId) {
  let ref = db.collection(collectionName)
  if (storeId) ref = ref.where('storeId', '==', storeId)
  const snap = await ref.get()
  return snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
}

async function loadPendingItems(db, storeId) {
  let ref = db.collection('orderItems').where('itemStatus', '==', 'ordered')
  if (storeId) ref = ref.where('storeId', '==', storeId)
  const snap = await ref.get()
  return snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
}

function hasAggregateFields(table) {
  return table?.pendingAggregateVersion != null
    || table?.pendingAggregateCount != null
    || table?.pendingAggregateDrinkCount != null
    || table?.pendingAggregateFoodCount != null
}

function countHasValues(counts) {
  return counts.total !== 0 || counts.drink !== 0 || counts.food !== 0
}

function formatCounts(counts) {
  return `total=${counts.total}, drink=${counts.drink}, food=${counts.food}`
}

function buildItemReferenceIssues({ pendingItems, tablesById }) {
  return pendingItems.reduce((issues, item) => {
    if (!item.tableId) {
      issues.push({
        type: 'item_missing_table',
        itemId: item.id,
        orderId: item.orderId ?? null,
        storeId: item.storeId ?? null,
      })
      return issues
    }

    const table = tablesById.get(item.tableId)
    if (!table) {
      issues.push({
        type: 'item_table_not_found',
        itemId: item.id,
        orderId: item.orderId ?? null,
        storeId: item.storeId ?? null,
        tableId: item.tableId,
      })
      return issues
    }

    if (item.storeId && table.storeId && item.storeId !== table.storeId) {
      issues.push({
        type: 'item_store_mismatch',
        itemId: item.id,
        orderId: item.orderId ?? null,
        itemStoreId: item.storeId,
        tableId: item.tableId,
        tableStoreId: table.storeId,
      })
    }

    return issues
  }, [])
}

function buildTableAuditRows({ tables, pendingByTable }) {
  return tables.map(table => {
    const actual = pendingByTable[table.id] ?? createPendingCounts()
    const legacy = readLegacyTablePending(table)
    const aggregate = readTablePendingAggregate(table)
    const issues = []

    if (legacy.total !== actual.total) issues.push('legacy_pending_total')

    const shouldCheckAggregate = table.pendingAggregateVersion === TABLE_PENDING_AGGREGATE_VERSION
      || hasAggregateFields(table)
      || countHasValues(actual)

    if (shouldCheckAggregate) {
      if (table.pendingAggregateVersion !== TABLE_PENDING_AGGREGATE_VERSION) {
        issues.push('aggregate_version')
      }
      if (aggregate.total !== actual.total) issues.push('aggregate_total')
      if (aggregate.drink !== actual.drink) issues.push('aggregate_drink')
      if (aggregate.food !== actual.food) issues.push('aggregate_food')
    }

    if ((table.status ?? 'vacant') === 'vacant' && actual.total > 0) {
      issues.push('vacant_table_with_pending_items')
    }

    return {
      tableId: table.id,
      tableName: table.tableName ?? '',
      storeId: table.storeId ?? null,
      status: table.status ?? null,
      currentOrderId: table.currentOrderId ?? null,
      actual,
      legacy,
      aggregate,
      aggregateVersion: table.pendingAggregateVersion ?? null,
      issues,
    }
  }).filter(row => row.issues.length > 0)
}

function buildAudit({ projectId, storeId, emulatorHost, tables, pendingItems }) {
  const tablesById = new Map(tables.map(table => [table.id, table]))
  const pendingByTable = countPendingItemsByTable(pendingItems)
  const itemIssues = buildItemReferenceIssues({ pendingItems, tablesById })
  const driftedTables = buildTableAuditRows({ tables, pendingByTable })

  return {
    projectId,
    storeId: storeId ?? 'all',
    source: emulatorHost ? `emulator:${emulatorHost}` : 'firestore',
    summary: {
      tableCount: tables.length,
      pendingItemCount: pendingItems.length,
      driftedTableCount: driftedTables.length,
      itemIssueCount: itemIssues.length,
    },
    driftedTables,
    itemIssues,
  }
}

function printTextReport(audit) {
  console.log('Read-only pending count audit')
  console.log(`Project: ${audit.projectId}`)
  console.log(`Store: ${audit.storeId}`)
  console.log(`Source: ${audit.source}`)
  console.log(`Tables: ${audit.summary.tableCount}`)
  console.log(`Pending orderItems: ${audit.summary.pendingItemCount}`)
  console.log(`Drifted tables: ${audit.summary.driftedTableCount}`)
  console.log(`Item reference issues: ${audit.summary.itemIssueCount}`)

  if (audit.driftedTables.length > 0) {
    console.log('\nDrifted table details:')
    for (const row of audit.driftedTables.slice(0, 50)) {
      const label = row.tableName ? `${row.tableName} (${row.tableId})` : row.tableId
      console.log(`- ${label} store=${row.storeId ?? 'unknown'} status=${row.status ?? 'unknown'}`)
      console.log(`  actual ${formatCounts(row.actual)}`)
      console.log(`  pendingCount=${row.legacy.total}`)
      console.log(`  aggregate ${formatCounts(row.aggregate)} version=${row.aggregateVersion ?? 'none'}`)
      console.log(`  issues=${row.issues.join(', ')}`)
    }
    if (audit.driftedTables.length > 50) {
      console.log(`  ... ${audit.driftedTables.length - 50} more drifted tables omitted`)
    }
  }

  if (audit.itemIssues.length > 0) {
    console.log('\nItem reference issues:')
    for (const issue of audit.itemIssues.slice(0, 50)) {
      console.log(`- ${issue.type} item=${issue.itemId} order=${issue.orderId ?? 'unknown'} table=${issue.tableId ?? 'none'} store=${issue.storeId ?? issue.itemStoreId ?? 'unknown'}`)
    }
    if (audit.itemIssues.length > 50) {
      console.log(`  ... ${audit.itemIssues.length - 50} more item issues omitted`)
    }
  }

  if (audit.summary.driftedTableCount === 0 && audit.summary.itemIssueCount === 0) {
    console.log('\nNo pending count drift found.')
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

  const [tables, pendingItems] = await Promise.all([
    loadRows(db, 'tables', options.storeId),
    loadPendingItems(db, options.storeId),
  ])

  const audit = buildAudit({
    projectId,
    storeId: options.storeId,
    emulatorHost: process.env.FIRESTORE_EMULATOR_HOST ?? null,
    tables,
    pendingItems,
  })

  if (options.json) {
    console.log(JSON.stringify(audit, null, 2))
  } else {
    printTextReport(audit)
  }

  if (options.failOnDrift && (audit.summary.driftedTableCount > 0 || audit.summary.itemIssueCount > 0)) {
    process.exitCode = 1
  }
}

main().catch(error => {
  console.error(`Pending count audit failed: ${error.message}`)
  process.exitCode = 1
})
