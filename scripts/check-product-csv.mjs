import assert from 'node:assert/strict'
import { categoryKey, decodeCsvBytes, parseCsv, planProductImport, SAMPLE_CSV } from '../src/lib/productCsv.js'

// 商品のまとめて登録（CSV）の読み取り。
assert.deepEqual(parseCsv('a,"b,c","d""e"\r\n\r\nf,"g\nh",i'), [['a', 'b,c', 'd"e'], ['f', 'g\nh', 'i']])
assert.deepEqual(parseCsv('分類\t商品名\t値段\n'), [['分類', '商品名', '値段']])

// UTF-8（先頭の印あり）も Shift_JIS も読める。
assert.equal(decodeCsvBytes(new TextEncoder().encode('\uFEFF分類').buffer), '分類')
assert.equal(decodeCsvBytes(new Uint8Array([0x95, 0xaa, 0x97, 0xde]).buffer), '分類')

const categories = [{ id: 'beer', name: 'ビール' }]
const products = [{ id: 'p1', categoryId: 'beer', name: '生ビール（中）' }]

const sample = planProductImport({ text: SAMPLE_CSV, products, categories })
assert.equal(sample.error, '')
assert.deepEqual(sample.rows.map(row => [row.line, row.status]), [[2, 'skip'], [3, 'add'], [4, 'add']])
assert.deepEqual(sample.newCategoryNames, ['焼き鳥'])
assert.equal(sample.rows[1].categoryId, 'beer')
assert.equal(sample.rows[2].isNewCategory, true)

// 見出しの並びが違っても見出しで読む。値段の「¥」「,」「円」・全角数字は外す。
const reordered = planProductImport({ text: '商品名,価格,カテゴリー\nハイボール,"¥1,200",酒\nレモンサワー,５００円,酒\n', products, categories })
assert.deepEqual(reordered.rows.map(row => [row.categoryName, row.name, row.price, row.status]), [
  ['酒', 'ハイボール', 1200, 'add'],
  ['酒', 'レモンサワー', 500, 'add'],
])
assert.deepEqual(reordered.newCategoryNames, ['酒'])

// 見出しが無ければ 分類・商品名・値段 の順。空・数字でない値段は「直す」、ファイルの中の2回目は飛ばす。
const noHeader = planProductImport({ text: 'ビール,黒ビール,600\nビール,黒ビール,600\nビール,,500\n,枝豆,300\n焼き鳥,ねぎま,時価\n', products, categories })
assert.deepEqual(noHeader.rows.map(row => [row.line, row.status, row.message]), [
  [1, 'add', ''],
  [2, 'skip', 'ファイルの中で2回目です'],
  [3, 'error', '商品名が空です'],
  [4, 'error', '分類が空です'],
  [5, 'error', '値段は数字で入れてください'],
])
assert.deepEqual(noHeader.newCategoryNames, [])

assert.ok(planProductImport({ text: '\n\n', products, categories }).error)
assert.ok(planProductImport({ text: '分類,商品名,値段\n', products, categories }).error)
assert.ok(planProductImport({ text: 'a,b,1\n'.repeat(301), products, categories }).error)

// 全角・半角の違う同じ分類名は、新しい分類1つにまとめ、どの行も同じ分類に入る。
const widths = planProductImport({ text: 'ｻﾜｰ,レモン,500\nサワー,ライム,500\n', products, categories })
assert.deepEqual(widths.newCategoryNames, ['ｻﾜｰ'])
assert.equal(categoryKey(widths.rows[0].categoryName), categoryKey(widths.rows[1].categoryName))

// 値段の「1,200」を「"」で囲まずに書くと列が割れる。「1円」で登録せず「直す」にする。
const split = planProductImport({ text: '酒,ボトル,1,200\n酒,グラス,"1,200"\n', products, categories })
assert.deepEqual(split.rows.map(row => [row.status, row.price]), [['error', 1], ['add', 1200]])

console.log('product csv checks passed')
