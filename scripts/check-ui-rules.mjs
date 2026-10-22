import assert from 'node:assert/strict'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

// 画面のルールのうち、機械で判定できるものを確かめる（.claude/rules/ui.md 4章。ユーザー様 2026-10-22）。
// 今あるコードの違反は scripts/ui-rules-baseline.json に数で記録し、新しいファイルは0件、今あるファイルは増やさない。
// つまり新しく作る画面・触った画面にだけ効く。直して減ったら `npm run check:ui-rules -- --update-baseline` で基準を下げる。
const ROOT = process.cwd()
const BASELINE_PATH = 'scripts/ui-rules-baseline.json'
const UI_DIRS = ['src/pages', 'src/components', 'src/hooks', 'src/styles']
// 共通の色の値を決める場所。ここだけは色を直接書いてよい。
const COLOR_ALLOWED_FILES = new Set(['src/styles/tokens.css'])

const RULES = [
  {
    key: 'inline-style',
    label: 'style={...} の直書き（見た目は CSS のクラスで）',
    extensions: ['.jsx', '.js'],
    pattern: /\bstyle=\{/g,
  },
  {
    key: 'browser-dialog',
    label: 'ブラウザ標準の alert / prompt / confirm（既存のモーダル・トグルを使う）',
    extensions: ['.jsx', '.js'],
    // 自分で定義した confirm() などの関数名や、onConfirm(…) は数えない。
    pattern: /(?<![\w.$]|function\s)(?:window\.)?(?:alert|prompt|confirm)\(/g,
  },
  {
    key: 'hard-coded-color',
    label: '色の直書き（src/styles/tokens.css の共通の値を使う）',
    extensions: ['.css', '.jsx', '.js'],
    pattern: /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(/g,
    skip: file => COLOR_ALLOWED_FILES.has(file),
    // JS・JSX は文字列の中の色だけを数える（id や URL の # を拾わない）。
    jsPattern: /['"`]#[0-9a-fA-F]{3,8}['"`]|['"`](?:rgba?|hsla?)\(/g,
  },
]

function listFiles(dir) {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap(entry => {
    const path = `${dir}/${entry.name}`
    return entry.isDirectory() ? listFiles(path) : [path]
  })
}

function stripComments(source, file) {
  if (file.endsWith('.css')) return source.replace(/\/\*[\s\S]*?\*\//g, '')
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
}

export function countUiRuleViolations() {
  const counts = {}
  for (const file of UI_DIRS.flatMap(listFiles).sort()) {
    const source = stripComments(readFileSync(join(ROOT, file), 'utf8'), file)
    for (const rule of RULES) {
      if (!rule.extensions.some(extension => file.endsWith(extension))) continue
      if (rule.skip?.(file)) continue
      const pattern = !file.endsWith('.css') && rule.jsPattern ? rule.jsPattern : rule.pattern
      const count = source.match(pattern)?.length ?? 0
      if (count > 0) counts[`${rule.key} ${file}`] = count
    }
  }
  return counts
}

// 判定そのものが正しく数えるかを、小さな例で確かめる。
const dialog = RULES.find(rule => rule.key === 'browser-dialog').pattern
assert.equal('if (!confirm("x")) return; alert("y"); window.prompt("z")'.match(dialog).length, 3)
assert.equal('async function confirm() {}; onConfirm(); modal.confirm(); handleConfirm()'.match(dialog), null)
const color = RULES.find(rule => rule.key === 'hard-coded-color')
assert.equal('a{color:#fff;background:rgba(0,0,0,.1)}'.match(color.pattern).length, 2)
assert.equal('const id = "#section"; const c = "#ffffff"'.match(color.jsPattern).length, 1)

const current = countUiRuleViolations()
if (process.argv.includes('--update-baseline')) {
  writeFileSync(join(ROOT, BASELINE_PATH), `${JSON.stringify(current, null, 2)}\n`)
  console.log(`ui rules baseline updated (${Object.keys(current).length} entries)`)
  process.exit(0)
}

const baseline = JSON.parse(readFileSync(join(ROOT, BASELINE_PATH), 'utf8'))
const failures = []
const improved = []
for (const [key, count] of Object.entries(current)) {
  const allowed = baseline[key] ?? 0
  if (count > allowed) failures.push(`${key}: ${allowed} → ${count}`)
}
for (const [key, allowed] of Object.entries(baseline)) {
  if ((current[key] ?? 0) < allowed) improved.push(key)
}

if (failures.length > 0) {
  const labels = Object.fromEntries(RULES.map(rule => [rule.key, rule.label]))
  console.error('画面のルール違反が増えました（新しいファイルは0件、今あるファイルは増やさない）：')
  for (const failure of failures) console.error(`- ${failure}　${labels[failure.split(' ')[0]]}`)
  process.exit(1)
}
if (improved.length > 0) {
  console.log(`ui rules: ${improved.length} 件減りました。npm run check:ui-rules -- --update-baseline で基準を下げてください。`)
}
console.log(`ui rules checks passed (${relative(ROOT, join(ROOT, BASELINE_PATH))} の既存分 ${Object.keys(baseline).length} 件を除く)`)
