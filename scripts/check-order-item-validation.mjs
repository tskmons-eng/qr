import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { describeUnavailableItems, formatOrderCommandError, isExpectedOperatorError } from '../src/lib/orderCommandErrors.js'

// 2026-10-23 注文の流れ 第1章：注文を受けるときのサーバーの確かめと、画面の知らせ。
const require = createRequire(import.meta.url)
const { findProductUnavailableReason, normalizeProductOptionGroups, resolveOptionSelections, verifyOrderItems } = require('../functions/orderItemValidation.js')

// 選ぶものは画面と同じ読み方（文字だけの古い形も受け付ける）。「必ず選ぶ」は required が true のものだけ。
assert.deepEqual(normalizeProductOptionGroups([{ groupName: ' 味 ', choices: ['塩', { label: 'タレ', extraPrice: '50' }] }]), [
  { groupName: '味', required: false, choices: [{ label: '塩', extraPrice: 0 }, { label: 'タレ', extraPrice: 50 }] },
])

const product = {
  id: 'p1',
  name: 'つくね',
  options: [
    { groupName: '味', required: true, choices: [{ label: '塩', extraPrice: 0 }, { label: 'タレ', extraPrice: 50 }] },
    { groupName: '量', choices: ['普通', '大盛'] },
  ],
}
// 追加料金は商品の値に置き換える（画面のマイナス値は使わない）。
assert.deepEqual(resolveOptionSelections(product, [{ groupName: '味', choice: 'タレ', extraPrice: -500 }]), {
  selections: [{ groupName: '味', choice: 'タレ', extraPrice: 50 }], reason: null,
})
assert.equal(resolveOptionSelections(product, []).reason, 'option-required')
assert.equal(resolveOptionSelections(product, [{ groupName: '味', choice: '激辛' }]).reason, 'option-changed')
assert.equal(resolveOptionSelections(product, [{ groupName: '辛さ', choice: '塩' }]).reason, 'option-changed')
assert.equal(resolveOptionSelections({ id: 'p2' }, [{ groupName: '味', choice: '塩' }]).reason, 'option-changed', '選ぶものの無い商品に選択が来たら止める')
assert.equal(resolveOptionSelections({ id: 'p2' }, []).reason, null)

assert.equal(findProductUnavailableReason({ isSoldOut: true }), 'sold-out')
assert.equal(findProductUnavailableReason({ isVisible: false }), 'hidden')
assert.equal(findProductUnavailableReason({}, { isActive: false }), 'category-hidden')
assert.equal(findProductUnavailableReason({}, null), null, '分類が見つからない商品は今までどおり止めない')

// 1つでも注文できない品があれば注文全体を止め、その品の一覧を画面へ返す。
assert.throws(() => verifyOrderItems([
  { product: { id: 'ok', name: 'A' }, quantity: 1, optionSelections: [] },
  { product: { id: 'x', name: 'B', isSoldOut: true }, quantity: 1, optionSelections: [] },
]), error => error.code === 'items-unavailable' && error.publicDetails.unavailableItems[0].productId === 'x')

// 画面：止めた品をカートから外し、何が注文できなかったかを知らせる。失敗の記録には残さない。
const error = { code: 'items-unavailable', details: { code: 'items-unavailable', unavailableItems: [{ productId: 'x', name: 'ハイボール', reason: 'sold-out' }] } }
assert.deepEqual(describeUnavailableItems(error).productIds, ['x'])
assert.match(describeUnavailableItems(error).message, /ハイボール（売り切れ）/)
assert.equal(describeUnavailableItems({ code: 'internal' }), null)
assert.equal(formatOrderCommandError(error).retryable, false)
assert.equal(isExpectedOperatorError(error), true)

console.log('order item validation checks passed')
