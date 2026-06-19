import {
  assertReadCredentialsAvailable,
  formatCounts,
  initializeFirestore,
  loadPendingCountAudit,
  resolveProjectId,
} from './lib/pending-count-audit.mjs'

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

  const projectId = await resolveProjectId(options.projectId)
  if (!projectId) throw new Error('Firebase project id was not found. Pass --project or set FIREBASE_PROJECT_ID.')

  await assertReadCredentialsAvailable()
  const db = initializeFirestore(projectId)
  const audit = await loadPendingCountAudit({ db, projectId, storeId: options.storeId })

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
