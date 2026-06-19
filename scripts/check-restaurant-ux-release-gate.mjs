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
const docDir = 'docs/restaurant-ux-round4'
const gateDocPath = `${docDir}/07-integration-release-gate.md`
const readmePath = `${docDir}/README.md`

const responsibilityDocs = [
  '01-kitchen-served-undo-density.md',
  '02-staff-order-checkout-scroll-layout.md',
  '03-customer-cart-checkout-history-navigation.md',
  '04-admin-category-ios-zoom.md',
  '05-guest-auto-add-entry-visibility.md',
  '06-customer-menu-row-tap-add-setting.md',
]

const requiredScripts = [
  'check:restaurant-ux-release-gate',
  'check:kitchen-display',
  'check:staff-menu',
  'check:staff-table-detail',
  'check:checkout',
  'check:customer-cart',
  'check:customer-order-status',
  'check:customer-entry',
  'check:settings',
  'check:admin-category',
  'check:option-modal',
  'check:order-command-ui',
  'check:order-functions-emulator',
  'check',
  'build',
]

const requiredGateCommands = [
  'git diff --check',
  'npm run check:restaurant-ux-release-gate',
  'npm run check:kitchen-display',
  'npm run check:staff-menu',
  'npm run check:staff-table-detail',
  'npm run check:checkout',
  'npm run check:customer-cart',
  'npm run check:customer-order-status',
  'npm run check:customer-entry',
  'npm run check:settings',
  'npm run check:admin-category',
  'npm run check:option-modal',
  'npm run check:order-command-ui',
  'npm run check:order-functions-emulator',
  'npm run check',
  'npm run build',
]

const localCheckCommands = [
  ['git', ['diff', '--check']],
  ['npm', ['run', 'check:kitchen-display']],
  ['npm', ['run', 'check:staff-menu']],
  ['npm', ['run', 'check:staff-table-detail']],
  ['npm', ['run', 'check:checkout']],
  ['npm', ['run', 'check:customer-cart']],
  ['npm', ['run', 'check:customer-order-status']],
  ['npm', ['run', 'check:customer-entry']],
  ['npm', ['run', 'check:settings']],
  ['npm', ['run', 'check:admin-category']],
  ['npm', ['run', 'check:option-modal']],
  ['npm', ['run', 'check:order-command-ui']],
  ['npm', ['run', 'check:order-functions-emulator']],
  ['npm', ['run', 'check']],
  ['npm', ['run', 'build']],
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
  assert.equal(stdout.trim(), '', 'final restaurant UX release gate requires a clean git status')
}

async function assertGitPushed() {
  const { stdout: upstream } = await execFileAsync(gitBin(), ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], {
    encoding: 'utf8',
  })
  const upstreamName = upstream.trim()
  assert.ok(upstreamName, 'final restaurant UX release gate requires an upstream branch')

  const { stdout } = await execFileAsync(gitBin(), ['rev-list', '--left-right', '--count', `${upstreamName}...HEAD`], {
    encoding: 'utf8',
  })
  const [behindText, aheadText] = stdout.trim().split(/\s+/)
  const ahead = Number(aheadText)
  assert.equal(ahead, 0, 'final restaurant UX release gate requires local commits to be pushed')
  assert.ok(Number(behindText) >= 0, 'upstream comparison should produce a behind count')
}

function extractCompletionValue(source, field) {
  const prefix = `- ${field}:`
  const lines = source.split(/\r?\n/)
  const startIndex = lines.findIndex(entry => entry.startsWith(prefix))
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
  ...responsibilitySources
] = await Promise.all([
  readFile('package.json', 'utf8'),
  readFile('.firebaserc', 'utf8'),
  readFile('firebase.json', 'utf8'),
  readFile(gateDocPath, 'utf8'),
  readFile(readmePath, 'utf8'),
  ...responsibilityDocs.map(file => readFile(`${docDir}/${file}`, 'utf8')),
])

const packageJson = JSON.parse(packageJsonText)
const firebaserc = JSON.parse(firebasercText)
const firebaseJson = JSON.parse(firebaseJsonText)

for (const scriptName of requiredScripts) {
  assert.ok(packageJson.scripts[scriptName], `package.json should define ${scriptName}`)
}

assert.equal(
  packageJson.scripts['check:restaurant-ux-release-gate'],
  'node scripts/check-restaurant-ux-release-gate.mjs',
  'package.json should wire the restaurant UX release gate check'
)
assertIncludes('npm run check', packageJson.scripts.check, 'check:restaurant-ux-release-gate')

assert.equal(firebaserc.projects.default, projectId, `.firebaserc default project should be ${projectId}`)
assert.equal(firebaseJson.hosting.public, 'dist', 'Hosting should deploy dist')
assert.equal(firebaseJson.firestore.rules, 'firestore.rules', 'Firestore rules path should stay explicit')
assert.equal(firebaseJson.functions.source, 'functions', 'Functions source should stay explicit')

for (const command of requiredGateCommands) {
  assertIncludes(gateDocPath, gateDoc, command)
}

for (const token of [
  'live HTML asset hash',
  '主要ルートHTTP 200',
  `project が \`${projectId}\``,
  'Functions 差分がある場合は対象Functionsを明示する',
  '注文 command に触れた場合は `functions:log` と `audit:command-failures` を確認する',
  'npm run check:restaurant-ux-release-gate -- --final',
]) {
  assertIncludes(gateDocPath, gateDoc, token)
}

for (const token of [
  '07 以外は Firebase deploy をしない',
  '最終deployは `07-integration-release-gate.md`',
  '実装結果、未解決リスク、deploy未実施であることを担当MDへ追記する',
]) {
  assertIncludes(readmePath, readme, token)
}

for (let index = 0; index < responsibilityDocs.length; index += 1) {
  const file = responsibilityDocs[index]
  const source = responsibilitySources[index]
  assertIncludes(file, source, '## Completion Notes')
  assertIncludes(file, source, 'Production deploy: not run in this task')
  if (finalMode) assertCompletionReady(file, source)
}

console.log('restaurant UX release gate wiring checks passed')

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
  console.log('final gate command: npm run check:restaurant-ux-release-gate -- --final')
}
