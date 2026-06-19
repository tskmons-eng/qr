import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const args = new Set(process.argv.slice(2))
const finalMode = args.has('--final')
const runLocal = finalMode || args.has('--run-local')
const enforceClean = finalMode || args.has('--enforce-clean')
const skipAudits = args.has('--skip-audits')
const runAudits = (finalMode || args.has('--with-audits')) && !skipAudits

const projectId = 'qrproduct-3340b'

const roundThreeDocs = [
  '01-customer-session-race.md',
  '02-submit-idempotency-and-retry.md',
  '03-checkout-and-stale-qr-races.md',
  '04-client-recovery-and-offline-ux.md',
  '05-live-failure-monitoring-and-repair.md',
  '06-load-release-gate.md',
  '07-kitchen-served-optimistic-ui.md',
]

const orderCallableFunctions = [
  'startCustomerOrderSessionCommand',
  'submitCustomerOrderItemsCommand',
  'submitStaffOrderItemsCommand',
  'seatStaffOrderSessionCommand',
  'completeCheckoutCommand',
  'markOrderItemServedCommand',
  'markOrderItemsServedCommand',
  'markOrderItemOrderedCommand',
  'cancelOrderItemCommand',
  'moveTableOrderCommand',
  'guideReservationToTableCommand',
]

const requiredScripts = [
  'check',
  'build',
  'check:order-functions-emulator',
  'check:order-rules-lockdown',
  'check:live-observability',
  'check:data-consistency-repair',
  'check:kitchen-display',
  'audit:command-failures',
  'audit:pending-counts',
]

function assertIncludes(label, source, token) {
  assert.ok(source.includes(token), `${label} should include ${token}`)
}

function npmBin() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm'
}

function gitBin() {
  return process.platform === 'win32' ? 'git.exe' : 'git'
}

async function runCommand(command, commandArgs) {
  console.log(`\n> ${[command, ...commandArgs].join(' ')}`)
  const child = execFileAsync(command, commandArgs, {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 20,
  })
  try {
    const { stdout, stderr } = await child
    if (stdout) process.stdout.write(stdout)
    if (stderr) process.stderr.write(stderr)
  } catch (error) {
    if (error.stdout) process.stdout.write(error.stdout)
    if (error.stderr) process.stderr.write(error.stderr)
    throw error
  }
}

async function assertGitClean() {
  const { stdout } = await execFileAsync(gitBin(), ['status', '--porcelain'], { encoding: 'utf8' })
  assert.equal(stdout.trim(), '', 'final release gate requires a clean git status')
}

const [
  packageJsonText,
  firebasercText,
  firebaseJsonText,
  functionsIndex,
  gateDoc,
  readme,
  ...responsibilityDocs
] = await Promise.all([
  readFile('package.json', 'utf8'),
  readFile('.firebaserc', 'utf8'),
  readFile('firebase.json', 'utf8'),
  readFile('functions/index.js', 'utf8'),
  readFile('docs/order-safety-round3/06-load-release-gate.md', 'utf8'),
  readFile('docs/order-safety-round3/README.md', 'utf8'),
  ...roundThreeDocs.map(file => readFile(`docs/order-safety-round3/${file}`, 'utf8')),
])

const packageJson = JSON.parse(packageJsonText)
const firebaserc = JSON.parse(firebasercText)
const firebaseJson = JSON.parse(firebaseJsonText)

for (const scriptName of requiredScripts) {
  assert.ok(packageJson.scripts[scriptName], `package.json should define ${scriptName}`)
}

assert.equal(
  packageJson.scripts['check:order-safety-release-gate'],
  'node scripts/check-order-safety-release-gate.mjs',
  'package.json should wire the order safety release gate check'
)
assertIncludes('npm run check', packageJson.scripts.check, 'check:order-safety-release-gate')

assert.equal(firebaserc.projects.default, projectId, `.firebaserc default project should be ${projectId}`)
assert.equal(firebaseJson.hosting.public, 'dist', 'Hosting should deploy dist')
assert.equal(firebaseJson.firestore.rules, 'firestore.rules', 'Firestore rules path should stay explicit')
assert.equal(firebaseJson.functions.source, 'functions', 'Functions source should stay explicit')

for (const functionName of orderCallableFunctions) {
  assertIncludes('functions/index.js', functionsIndex, `exports.${functionName} = createOrderCommandCallable`)
  assertIncludes('06-load-release-gate.md', gateDoc, `functions:${functionName}`)
}

for (const token of [
  'npm run check:order-safety-release-gate -- --final',
  'npm run check',
  'npm run build',
  'npm run check:order-functions-emulator',
  'npm run audit:command-failures -- --limit 10',
  'npm run audit:pending-counts -- --json',
  'npm run check:order-rules-lockdown',
  `--project ${projectId}`,
  '担当MD単独で本番 deploy しない',
]) {
  assertIncludes('06-load-release-gate.md', gateDoc, token)
}

for (const token of [
  'read-only audit',
  '担当MD単独で本番 deploy しない',
  '06-load-release-gate.md',
]) {
  assertIncludes('round3 README', readme, token)
}

for (let index = 0; index < roundThreeDocs.length; index += 1) {
  const file = roundThreeDocs[index]
  const source = responsibilityDocs[index]
  assertIncludes(file, source, '## 検証コマンド')
  assertIncludes(file, source, '## 完了時の報告')
}

console.log('order safety release gate wiring checks passed')

if (enforceClean) {
  await assertGitClean()
  console.log('git status is clean')
}

if (runLocal) {
  await runCommand(npmBin(), ['run', 'check'])
  await runCommand(npmBin(), ['run', 'check:order-functions-emulator'])
  await runCommand(npmBin(), ['run', 'build'])
}

if (runAudits) {
  await runCommand(npmBin(), ['run', 'audit:command-failures', '--', '--limit', '10'])
  await runCommand(npmBin(), ['run', 'audit:pending-counts', '--', '--json'])
}

if (!finalMode) {
  console.log('final gate command: npm run check:order-safety-release-gate -- --final')
}
