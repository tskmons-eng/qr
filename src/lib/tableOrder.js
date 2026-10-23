import { normalizeTableName } from './adminTable.js'

// 席の並び順（2026-10-23 席設計）。席一覧・席移動・予約など、席が並ぶ画面はすべてこの順にする。
// 並び順（sortOrder）が無い席は、今までどおり作った順。並べ替えたことがない店は今と同じに見える。
export const MAX_BULK_TABLES = 50

function createdSeconds(table) {
  return table.createdAt?.seconds ?? 0
}

export function compareTables(a, b) {
  const aHas = Number.isFinite(a.sortOrder)
  const bHas = Number.isFinite(b.sortOrder)
  if (aHas && bHas && a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
  if (aHas !== bHas) return aHas ? -1 : 1
  const createdDiff = createdSeconds(a) - createdSeconds(b)
  if (createdDiff !== 0) return createdDiff
  // 同じ時に作った席（まとめて追加）や作った時が分からない席は、名前の数字の順（テーブル2 → テーブル10）。
  return String(a.tableName ?? '').localeCompare(String(b.tableName ?? ''), 'ja', { numeric: true })
}

export function sortTables(tables) {
  return [...tables].sort(compareTables)
}

// 席を足すときの並び順。新しい席はいつも一番下。
// 並び順がまだ無い席があれば、今の見え方（作った順）のまま先に 0, 1, 2… を付ける（同じ書き込みの中で）。
// こうすると、まとめて作った席（作った時が同じ）も入れた順に並ぶ。
export function planTableSortOrders(tables, addCount) {
  const sorted = sortTables(tables)
  const newSortOrders = start => Array.from({ length: addCount }, (_, index) => start + index)
  if (sorted.every(table => Number.isFinite(table.sortOrder))) {
    const max = sorted.reduce((value, table) => Math.max(value, table.sortOrder), -1)
    return { existingUpdates: [], newSortOrders: newSortOrders(max + 1) }
  }
  return {
    existingUpdates: sorted
      .map((table, index) => ({ id: table.id, sortOrder: index }))
      .filter((update, index) => sorted[index].sortOrder !== update.sortOrder),
    newSortOrders: newSortOrders(sorted.length),
  }
}

// 「番号でまとめて追加」：頭の文字＋番号で名前を作る。同じ名前の席がもうあるものは飛ばす。
export function buildBulkTableNames({ prefix, from, to, existingNames = [] }) {
  if (String(from ?? '').trim() === '' || String(to ?? '').trim() === '') {
    return { names: [], skipped: [], error: '番号を入れてください' }
  }
  const start = Number(from)
  const end = Number(to)
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < 0) {
    return { names: [], skipped: [], error: '番号は0以上の数字で入れてください' }
  }
  if (end < start) return { names: [], skipped: [], error: 'おわりの番号は、はじめの番号以上にしてください' }
  if (end - start + 1 > MAX_BULK_TABLES) {
    return { names: [], skipped: [], error: `一度に作れるのは${MAX_BULK_TABLES}席までです` }
  }
  const existing = new Set(existingNames.map(name => normalizeTableName(String(name ?? ''))))
  const names = []
  const skipped = []
  for (let number = start; number <= end; number += 1) {
    const name = normalizeTableName(`${prefix ?? ''}${number}`)
    if (existing.has(name)) skipped.push(name)
    else names.push(name)
  }
  return { names, skipped, error: '' }
}
