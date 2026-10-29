import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import {
  buildTableOrderUrl,
  DEFAULT_PUBLIC_ORDER_BASE_URL,
  generateTableQrToken,
  getPublicOrderBaseUrl,
  normalizeTableName,
  TABLE_STATUS_LABELS,
  describeTableUse,
} from '../src/lib/adminTable.js'
import { MAX_BULK_TABLES, buildBulkTableNames, planTableSortOrders, sortTables } from '../src/lib/tableOrder.js'

assert.equal(normalizeTableName('  A1  '), 'A1')
assert.equal(buildTableOrderUrl('https://example.com', 'abc'), 'https://example.com/order/abc')
assert.equal(buildTableOrderUrl('https://example.com/', 'abc'), 'https://example.com/order/abc')
assert.equal(getPublicOrderBaseUrl(), DEFAULT_PUBLIC_ORDER_BASE_URL)
assert.equal(TABLE_STATUS_LABELS.vacant, '空席')
assert.equal(TABLE_STATUS_LABELS.checkout_pending, '会計待ち')

const token = generateTableQrToken(bytes => {
  bytes.forEach((_, index) => {
    bytes[index] = index
  })
})

assert.equal(token, '000102030405060708090a0b0c0d0e0f')
assert.equal(token.length, 32)

// 2026-10-23 席設計：並び順。並び順が無い店は今までどおり作った順。並び順がある席が先。
const at = seconds => ({ seconds })
assert.deepEqual(sortTables([{ id: 'b', createdAt: at(2) }, { id: 'a', createdAt: at(1) }]).map(t => t.id), ['a', 'b'])
assert.deepEqual(sortTables([
  { id: 'old', createdAt: at(1) },
  { id: 'second', sortOrder: 1, createdAt: at(5) },
  { id: 'first', sortOrder: 0, createdAt: at(9) },
]).map(t => t.id), ['first', 'second', 'old'])
// まとめて作った席（作った時が同じ）は名前の数字の順。
assert.deepEqual(sortTables([
  { id: 't10', tableName: 'テーブル10', createdAt: at(1) },
  { id: 't2', tableName: 'テーブル2', createdAt: at(1) },
]).map(t => t.id), ['t2', 't10'])
// 席を足すとき：並び順の無い席には今の見え方のまま 0,1,… を付け、新しい席はその下。
assert.deepEqual(planTableSortOrders([{ id: 'b', createdAt: at(2) }, { id: 'a', createdAt: at(1) }], 2), {
  existingUpdates: [{ id: 'a', sortOrder: 0 }, { id: 'b', sortOrder: 1 }], newSortOrders: [2, 3],
})
assert.deepEqual(planTableSortOrders([], 3), { existingUpdates: [], newSortOrders: [0, 1, 2] })
assert.deepEqual(planTableSortOrders([{ id: 'a', sortOrder: 3 }, { id: 'b', sortOrder: 7 }], 1), { existingUpdates: [], newSortOrders: [8] })

// 番号でまとめて追加：同じ名前は飛ばす。上限と番号の向きを確かめる。
assert.deepEqual(buildBulkTableNames({ prefix: 'テーブル', from: '1', to: '3', existingNames: ['テーブル2'] }), {
  names: ['テーブル1', 'テーブル3'], skipped: ['テーブル2'], error: '',
})
assert.equal(buildBulkTableNames({ prefix: '', from: '5', to: '3' }).error, 'おわりの番号は、はじめの番号以上にしてください')
assert.equal(buildBulkTableNames({ prefix: 'T', from: '1', to: String(MAX_BULK_TABLES + 1) }).error, `一度に作れるのは${MAX_BULK_TABLES}席までです`)
assert.deepEqual(buildBulkTableNames({ prefix: '', from: '1', to: '2' }).names, ['1', '2'])
assert.equal(buildBulkTableNames({ prefix: 'T', from: '', to: '8' }).error, '番号を入れてください', '空の番号を0番にしない')

assert.deepEqual(describeTableUse({ status: 'vacant', currentOrderId: null }), { label: '空き', vacant: true })
assert.deepEqual(describeTableUse({ status: 'occupied', guestCount: 2, currentOrderId: 'o' }), { label: '2名・食事中', vacant: false })
assert.deepEqual(describeTableUse({ status: 'checkout_pending', currentOrderId: 'o' }), { label: '会計待ち', vacant: false })

// 2026-10-28 QR 第1章：席の一覧は店の人だけ。お客様はQRの入口（tableEntries）から1件ずつ読む。
const rulesSource = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8')
const tablesRule = rulesSource.slice(rulesSource.indexOf('match /tables/{tableId}'), rulesSource.indexOf('match /tableEntries/{qrToken}'))
assert.match(tablesRule, /allow get: if true;/)
assert.match(tablesRule, /allow list: if canAccess\(resource\.data\.storeId\);/)
assert.doesNotMatch(tablesRule, /allow read: if true;/, '席の一覧を誰でも読めるようにしない')
const entryRule = rulesSource.slice(rulesSource.indexOf('match /tableEntries/{qrToken}'), rulesSource.indexOf('// 席グループ'))
assert.match(entryRule, /allow get: if true;/)
assert.match(entryRule, /allow list, update: if false;/)
assert.doesNotMatch(entryRule, /allow create:[^;]*getAfter/, 'まとめて追加で読み込みの上限に当たらないように')
const entryService = readFileSync(new URL('../src/services/customerEntryService.js', import.meta.url), 'utf8')
assert.match(entryService, /doc\(db, 'tableEntries', qrToken\)/)
assert.match(entryService, /table\.qrToken === qrToken && table\.storeId === entry\.storeId/, '作り直した古いQR・別の店を指す入口では入れない')
assert.match(entryService, /error\?\.code === 'unavailable'\) retryTimer = setTimeout\(readEntry, 3000\)\s*else followLegacyQuery\(\)/, '電波が悪いときは読み直し、入口が読めないときは前の探し方で入れる')
const adminTableService = readFileSync(new URL('../src/services/adminTableService.js', import.meta.url), 'utf8')
assert.match(adminTableService, /setTableEntry\(batch, \{ qrToken, storeId, tableId: tableRef\.id \}\)/, '席を作るときに入口も作る')
assert.match(adminTableService, /batch\.delete\(doc\(db, 'tableEntries', table\.qrToken\)\)/, 'QRを作り直す・席を消すときに古い入口を消す')

console.log('admin table checks passed')
