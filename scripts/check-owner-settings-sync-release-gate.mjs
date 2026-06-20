import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const args = new Set(process.argv.slice(2))
const finalMode = args.has('--final')
const runLocal = finalMode || args.has('--run-local')
const enforceClean = finalMode || args.has('--enforce-clean')
const enforcePushed = finalMode || args.has('--enforce-pushed')

const projectId = 'qrproduct-3340b'
const docDir = 'docs/owner-settings-sync-round1'
const gateDocPath = `${docDir}/05-integration-release-gate.md`
const readmePath = `${docDir}/README.md`

const responsibilityDocs = [
  '01-owner-allowed-email-sync.md',
  '02-order-category-visual-treatment.md',
  '03-store-name-settings-sync.md',
  '04-owner-admin-email-transfer.md',
]

const requiredScripts = [
  'check:owner-settings-sync-release-gate',
  'check:owner-access',
  'check:owner-dashboard',
  'check:store-admin-assignment',
  'check:settings',
  'check:customer-cart',
  'check',
  'build',
]

const requiredGateCommands = [
  'git diff --check',
  'npm run check:owner-settings-sync-release-gate',
  'npm run check:owner-access',
  'npm run check:owner-dashboard',
  'npm run check:store-admin-assignment',
  'npm run check:settings',
  'npm run check:customer-cart',
  'npm run check',
  'npm run build',
  'npm run check:owner-settings-sync-release-gate -- --final',
]

const localCheckCommands = [
  ['git', ['diff', '--check']],
  ['npm', ['run', 'check:owner-access']],
  ['npm', ['run', 'check:owner-dashboard']],
  ['npm', ['run', 'check:store-admin-assignment']],
  ['npm', ['run', 'check:settings']],
  ['npm', ['run', 'check:customer-cart']],
  ['npm', ['run', 'check']],
  ['npm', ['run', 'build']],
]

function assertIncludes(label, source, token) {
  assert.ok(source.includes(token), `${label} should include ${token}`)
}

function assertNotIncludes(label, source, token) {
  assert.ok(!source.includes(token), `${label} should not include ${token}`)
}

function npmBin() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm'
}

function gitBin() {
  return process.platform === 'win32' ? 'git.exe' : 'git'
}

function commandBin(command) {
  if (command === 'npm') return npmBin()
  if (command === 'git') return gitBin()
  return command
}

async function runCommand(command, commandArgs) {
  const commandPath = commandBin(command)
  console.log(`\n> ${[command, ...commandArgs].join(' ')}`)
  const execCommand = process.platform === 'win32' && commandPath.endsWith('.cmd') ? 'cmd.exe' : commandPath
  const execArgs = execCommand === 'cmd.exe' ? ['/d', '/c', commandPath, ...commandArgs] : commandArgs

  try {
    const { stdout, stderr } = await execFileAsync(execCommand, execArgs, {
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 20,
    })
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
  assert.equal(stdout.trim(), '', 'final owner settings sync release gate requires a clean git status')
}

async function assertGitPushed() {
  const { stdout: upstream } = await execFileAsync(gitBin(), ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], {
    encoding: 'utf8',
  })
  const upstreamName = upstream.trim()
  assert.ok(upstreamName, 'final owner settings sync release gate requires an upstream branch')

  const { stdout } = await execFileAsync(gitBin(), ['rev-list', '--left-right', '--count', `${upstreamName}...HEAD`], {
    encoding: 'utf8',
  })
  const [behindText, aheadText] = stdout.trim().split(/\s+/)
  assert.equal(Number(aheadText), 0, 'final owner settings sync release gate requires local commits to be pushed')
  assert.ok(Number(behindText) >= 0, 'upstream comparison should produce a behind count')
}

function extractCompletionValue(source, field) {
  const prefix = `- ${field}:`
  const lines = source.split(/\r?\n/)
  const startIndex = lines.findIndex(line => line.startsWith(prefix))
  if (startIndex === -1) return ''

  const inlineValue = lines[startIndex].slice(prefix.length).trim()
  if (inlineValue) return inlineValue

  const blockValues = []
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index]
    if (line.startsWith('## ') || /^- [A-Za-z][^:]*:/.test(line)) break
    if (line.trim()) blockValues.push(line.trim())
  }
  return blockValues.join(' ')
}

function assertCompletionReady(file, source) {
  for (const field of ['Result', 'Checks', 'Remaining risk']) {
    const value = extractCompletionValue(source, field)
    assert.ok(value, `${file} Completion Notes should fill ${field}`)
  }
  assertIncludes(file, source, 'Production deploy: not run in this task')
}

const [
  packageJsonText,
  firebasercText,
  firebaseJsonText,
  gateDoc,
  readme,
  ownerAccessService,
  settingsService,
  ownerDashboardService,
  storeContext,
  authSessionService,
  storeIdentity,
  ownerStoreDashboard,
  customerCategoryTabs,
  customerMenuCss,
  rules,
  ...responsibilitySources
] = await Promise.all([
  readFile('package.json', 'utf8'),
  readFile('.firebaserc', 'utf8'),
  readFile('firebase.json', 'utf8'),
  readFile(gateDocPath, 'utf8'),
  readFile(readmePath, 'utf8'),
  readFile('src/services/ownerAccessService.js', 'utf8'),
  readFile('src/services/settingsService.js', 'utf8'),
  readFile('src/services/ownerDashboardService.js', 'utf8'),
  readFile('src/contexts/StoreContext.jsx', 'utf8'),
  readFile('src/services/authSessionService.js', 'utf8'),
  readFile('src/lib/storeIdentity.js', 'utf8'),
  readFile('src/components/owner/OwnerStoreDashboard.jsx', 'utf8'),
  readFile('src/components/order/CustomerCategoryTabs.jsx', 'utf8'),
  readFile('src/styles/customer-menu.css', 'utf8'),
  readFile('firestore.rules', 'utf8'),
  ...responsibilityDocs.map(file => readFile(`${docDir}/${file}`, 'utf8')),
])

const packageJson = JSON.parse(packageJsonText)
const firebaserc = JSON.parse(firebasercText)
const firebaseJson = JSON.parse(firebaseJsonText)

for (const scriptName of requiredScripts) {
  assert.ok(packageJson.scripts[scriptName], `package.json should define ${scriptName}`)
}

assert.equal(
  packageJson.scripts['check:owner-settings-sync-release-gate'],
  'node scripts/check-owner-settings-sync-release-gate.mjs',
  'package.json should wire the owner settings sync release gate check',
)
assertIncludes('npm run check', packageJson.scripts.check, 'check:owner-settings-sync-release-gate')

assert.equal(firebaserc.projects.default, projectId, `.firebaserc default project should be ${projectId}`)
assert.equal(firebaseJson.hosting.public, 'dist', 'Hosting should deploy dist')
assert.equal(firebaseJson.firestore.rules, 'firestore.rules', 'Firestore rules path should stay explicit')
assert.equal(firebaseJson.functions.source, 'functions', 'Functions source should stay explicit')

for (const command of requiredGateCommands) {
  assertIncludes(gateDocPath, gateDoc, command)
}

for (const token of [
  'allowedEmails` と `storeAdminEmails` の責務が分かれたまま',
  'Hosting deploy',
  'Functions はdeployしない',
  'Firestore rules / indexes / storage はdeployしない',
  'live HTML asset hash',
  '主要ルートHTTP 200',
  `project が \`${projectId}\``,
]) {
  assertIncludes(gateDocPath, gateDoc, token)
}

for (const token of [
  '各担当MD単体では Firebase deploy をしない',
  'deploy可否は05でまとめて判断する',
]) {
  assertIncludes(readmePath, readme, token)
}

for (let index = 0; index < responsibilityDocs.length; index += 1) {
  const file = responsibilityDocs[index]
  const source = responsibilitySources[index]
  assertIncludes(file, source, '## Completion Notes')
  assertCompletionReady(file, source)
}

assertIncludes('ownerAccessService', ownerAccessService, "collection(db, 'allowedEmails')")
assertIncludes('ownerAccessService', ownerAccessService, 'subscribeAllowedEmailEntries')
assertIncludes('ownerAccessService', ownerAccessService, 'addedBy')
assertIncludes('settingsService', settingsService, 'subscribeAllowedEmailEntries')
assertIncludes('settingsService', settingsService, 'saveAllowedEmail')
assertIncludes('settingsService', settingsService, 'deleteAllowedEmail')
assertNotIncludes('settingsService', settingsService, "doc(db, 'allowedEmails'")

assertIncludes('ownerDashboardService', ownerDashboardService, "doc(db, 'storeAdminEmails', normalizedEmail)")
assertIncludes('ownerDashboardService', ownerDashboardService, 'writeBatch')
assertIncludes('ownerDashboardService', ownerDashboardService, "batch.update(doc(db, 'stores', storeId)")
assertNotIncludes('ownerDashboardService', ownerDashboardService, "doc(db, 'stores', normalizedEmail)")
assertIncludes('StoreContext', storeContext, "doc(db, 'storeAdminEmails', normalizedEmail)")
assertIncludes('authSessionService', authSessionService, "doc(db, 'storeAdminEmails', normalizedEmail)")

assertIncludes('storeIdentity', storeIdentity, 'STORE_NAME_MAX_LENGTH')
assertIncludes('settingsService', settingsService, "updateDoc(doc(db, 'stores', storeId)")
assertIncludes('ownerDashboardService', ownerDashboardService, 'export async function updateStoreName')
assertIncludes('OwnerStoreDashboard', ownerStoreDashboard, 'owner-store-name-edit')
assertIncludes('OwnerStoreDashboard', ownerStoreDashboard, '<th>名義メール</th>')
assertIncludes('OwnerStoreDashboard', ownerStoreDashboard, '店舗ID・履歴はそのまま')

assertIncludes('CustomerCategoryTabs', customerCategoryTabs, 'CATEGORY_GROUP_DESCRIPTIONS')
assertIncludes('CustomerCategoryTabs', customerCategoryTabs, 'customer-category-tabs__marker')
assertNotIncludes('CustomerCategoryTabs', customerCategoryTabs, 'CATEGORY_GROUP_LABELS')
assertIncludes('customer-menu.css', customerMenuCss, '.customer-category-tabs__button--drink')
assertIncludes('customer-menu.css', customerMenuCss, '.customer-category-tabs__button--food')
assertIncludes('customer-menu.css', customerMenuCss, '.customer-category-tabs__marker--drink')
assertIncludes('customer-menu.css', customerMenuCss, '.customer-category-tabs__marker--food')

assertIncludes('firestore.rules', rules, 'match /allowedEmails/{email}')
assertIncludes('firestore.rules', rules, 'match /storeAdminEmails/{email}')
assertIncludes('firestore.rules', rules, 'allow write: if isSuper();')

console.log('owner settings sync release gate wiring checks passed')

if (enforceClean) {
  await assertGitClean()
  console.log('git status is clean')
}

if (enforcePushed) {
  await assertGitPushed()
  console.log('local commits are pushed')
}

if (runLocal) {
  for (const [command, commandArgs] of localCheckCommands) {
    await runCommand(command, commandArgs)
  }
}

if (!finalMode) {
  console.log('final gate command: npm run check:owner-settings-sync-release-gate -- --final')
}
