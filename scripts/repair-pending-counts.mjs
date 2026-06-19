import {
  applyPendingCountRepairPlan,
  assertReadCredentialsAvailable,
  buildPendingCountRepairPlan,
  formatCounts,
  initializeFirestore,
  loadPendingCountAudit,
  resolveProjectId,
} from './lib/pending-count-audit.mjs'

function parseArgs(argv) {
  const options = {
    apply: false,
    json: false,
    projectId: null,
    storeId: null,
    help: false,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') {
      options.help = true
    } else if (arg === '--apply') {
      options.apply = true
    } else if (arg === '--json') {
      options.json = true
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
  console.log(`Dry-run first Firestore pending count repair

Usage:
  npm run repair:pending-counts -- --store <storeId>
  npm run repair:pending-counts -- --store <storeId> --json
  npm run repair:pending-counts -- --store <storeId> --apply

Options:
  --project <projectId>  Firebase project id. Defaults to FIREBASE_PROJECT_ID or .firebaserc.
  --store <storeId>      Required. Limits reads and writes to one store.
  --json                 Print repair plan as JSON.
  --apply                Apply the derived pending count repair. Without this flag, no writes happen.

Only derived table fields are repaired:
  tables.pendingCount
  tables.pendingAggregateVersion
  tables.pendingAggregateCount
  tables.pendingAggregateDrinkCount
  tables.pendingAggregateFoodCount
`)
}

function buildResult({ audit, repairPlan, mode, appliedTableIds = [] }) {
  return {
    projectId: audit.projectId,
    storeId: audit.storeId,
    source: audit.source,
    mode,
    summary: {
      tableCount: audit.summary.tableCount,
      pendingItemCount: audit.summary.pendingItemCount,
      driftedTableCount: audit.summary.driftedTableCount,
      itemIssueCount: audit.summary.itemIssueCount,
      repairCandidateCount: repairPlan.length,
      appliedTableCount: appliedTableIds.length,
    },
    repairPlan,
    itemIssues: audit.itemIssues,
    appliedTableIds,
  }
}

function printRepairReport(result) {
  console.log('Pending count repair plan')
  console.log(`Project: ${result.projectId}`)
  console.log(`Store: ${result.storeId}`)
  console.log(`Source: ${result.source}`)
  console.log(`Mode: ${result.mode}`)
  console.log(`Tables: ${result.summary.tableCount}`)
  console.log(`Pending orderItems: ${result.summary.pendingItemCount}`)
  console.log(`Drifted tables: ${result.summary.driftedTableCount}`)
  console.log(`Repair candidates: ${result.summary.repairCandidateCount}`)
  console.log(`Item reference issues: ${result.summary.itemIssueCount}`)

  if (result.repairPlan.length > 0) {
    console.log('\nPlanned table field updates:')
    for (const repair of result.repairPlan.slice(0, 50)) {
      const label = repair.tableName ? `${repair.tableName} (${repair.tableId})` : repair.tableId
      console.log(`- ${label} status=${repair.status ?? 'unknown'} order=${repair.currentOrderId ?? 'none'}`)
      console.log(`  before pendingCount=${repair.before.pendingCount}, aggregate=${formatCounts({
        total: repair.before.pendingAggregateCount,
        drink: repair.before.pendingAggregateDrinkCount,
        food: repair.before.pendingAggregateFoodCount,
      })}, version=${repair.before.pendingAggregateVersion ?? 'none'}`)
      console.log(`  after  pendingCount=${repair.after.pendingCount}, aggregate=${formatCounts({
        total: repair.after.pendingAggregateCount,
        drink: repair.after.pendingAggregateDrinkCount,
        food: repair.after.pendingAggregateFoodCount,
      })}, version=${repair.after.pendingAggregateVersion}`)
      console.log(`  issues=${repair.issues.join(', ')}`)
    }
    if (result.repairPlan.length > 50) {
      console.log(`  ... ${result.repairPlan.length - 50} more repair candidates omitted`)
    }
  }

  if (result.itemIssues.length > 0) {
    console.log('\nReport-only item reference issues:')
    for (const issue of result.itemIssues.slice(0, 50)) {
      console.log(`- ${issue.type} item=${issue.itemId} order=${issue.orderId ?? 'unknown'} table=${issue.tableId ?? 'none'} store=${issue.storeId ?? issue.itemStoreId ?? 'unknown'}`)
    }
    if (result.itemIssues.length > 50) {
      console.log(`  ... ${result.itemIssues.length - 50} more item issues omitted`)
    }
  }

  if (result.mode === 'dry-run') {
    console.log('\nDry-run only. Add --apply to write the planned table field updates.')
  } else {
    console.log(`\nApplied table updates: ${result.summary.appliedTableCount}`)
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    printHelp()
    return
  }
  if (!options.storeId) throw new Error('--store <storeId> is required for repair safety.')

  const projectId = await resolveProjectId(options.projectId)
  if (!projectId) throw new Error('Firebase project id was not found. Pass --project or set FIREBASE_PROJECT_ID.')

  await assertReadCredentialsAvailable()
  const db = initializeFirestore(projectId)
  const audit = await loadPendingCountAudit({ db, projectId, storeId: options.storeId })
  const repairPlan = buildPendingCountRepairPlan(audit)
  let appliedTableIds = []

  if (options.apply && repairPlan.length > 0) {
    if (!options.json) {
      printRepairReport(buildResult({ audit, repairPlan, mode: 'apply-preview' }))
      console.log('\nApplying repair plan...')
    }
    appliedTableIds = await applyPendingCountRepairPlan(db, repairPlan, { storeId: options.storeId })
  }

  const result = buildResult({
    audit,
    repairPlan,
    mode: options.apply ? 'applied' : 'dry-run',
    appliedTableIds,
  })

  if (options.json) {
    console.log(JSON.stringify(result, null, 2))
  } else if (!options.apply) {
    printRepairReport(result)
  } else {
    printRepairReport(result)
  }
}

main().catch(error => {
  console.error(`Pending count repair failed: ${error.message}`)
  process.exitCode = 1
})
