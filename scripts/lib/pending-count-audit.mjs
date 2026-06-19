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
} from '../../src/lib/tablePending.js'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

export async function readDefaultProjectId() {
  const firebasercPath = path.join(rootDir, '.firebaserc')
  try {
    const text = await readFile(firebasercPath, 'utf8')
    return JSON.parse(text).projects?.default ?? null
  } catch {
    return null
  }
}

export async function resolveProjectId(projectId) {
  return projectId
    ?? process.env.FIREBASE_PROJECT_ID
    ?? await readDefaultProjectId()
}

export function loadFirebaseAdmin() {
  const requireFromFunctions = createRequire(new URL('../../functions/package.json', import.meta.url))
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

export async function assertReadCredentialsAvailable() {
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

export function initializeFirestore(projectId) {
  const { app, firestore } = loadFirebaseAdmin()
  if (app.getApps().length === 0) app.initializeApp({ projectId })
  return firestore.getFirestore()
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

export function formatCounts(counts) {
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

export function buildAudit({ projectId, storeId, emulatorHost, tables, pendingItems }) {
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

export async function loadPendingCountAudit({ db, projectId, storeId }) {
  const [tables, pendingItems] = await Promise.all([
    loadRows(db, 'tables', storeId),
    loadPendingItems(db, storeId),
  ])

  return buildAudit({
    projectId,
    storeId,
    emulatorHost: process.env.FIRESTORE_EMULATOR_HOST ?? null,
    tables,
    pendingItems,
  })
}

const REPAIRABLE_TABLE_ISSUES = new Set([
  'legacy_pending_total',
  'aggregate_version',
  'aggregate_total',
  'aggregate_drink',
  'aggregate_food',
])

function countFieldChanges(before, after) {
  return Object.entries(after)
    .filter(([field, value]) => before[field] !== value)
    .map(([field, value]) => ({ field, before: before[field] ?? null, after: value }))
}

export function buildPendingCountRepairPlan(audit) {
  return audit.driftedTables.map(row => {
    const repairableIssues = row.issues.filter(issue => REPAIRABLE_TABLE_ISSUES.has(issue))
    if (repairableIssues.length === 0) return null

    const before = {
      pendingCount: row.legacy.total,
      pendingAggregateVersion: row.aggregateVersion ?? null,
      pendingAggregateCount: row.aggregate.total,
      pendingAggregateDrinkCount: row.aggregate.drink,
      pendingAggregateFoodCount: row.aggregate.food,
    }
    const after = {
      pendingCount: row.actual.total,
      pendingAggregateVersion: TABLE_PENDING_AGGREGATE_VERSION,
      pendingAggregateCount: row.actual.total,
      pendingAggregateDrinkCount: row.actual.drink,
      pendingAggregateFoodCount: row.actual.food,
    }
    const changes = countFieldChanges(before, after)
    if (changes.length === 0) return null

    return {
      tableId: row.tableId,
      tableName: row.tableName,
      storeId: row.storeId,
      status: row.status,
      currentOrderId: row.currentOrderId,
      issues: repairableIssues,
      before,
      after,
      changes,
    }
  }).filter(Boolean)
}

export async function applyPendingCountRepairPlan(db, repairPlan, { storeId }) {
  const applied = []

  for (const repair of repairPlan) {
    const tableRef = db.collection('tables').doc(repair.tableId)
    await db.runTransaction(async transaction => {
      const tableSnap = await transaction.get(tableRef)
      if (!tableSnap.exists) throw new Error(`Table ${repair.tableId} was not found during repair.`)
      const table = tableSnap.data()
      if (table.storeId !== storeId) {
        throw new Error(`Table ${repair.tableId} is no longer in store ${storeId}.`)
      }
      transaction.update(tableRef, repair.after)
    })
    applied.push(repair.tableId)
  }

  return applied
}
