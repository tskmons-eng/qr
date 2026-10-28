const { commandError } = require('./orderCommandShared')

// 注文を受けるときの確かめ（2026-10-23 注文の流れ 第1章）。
// 画面は止めていても、開いたままの画面・古い画面・外から送られた値では通ってしまうので、サーバーで同じことを確かめる。
// 選ぶものの追加料金は商品に登録された値を使う（画面から送られた値は使わない）。

const UNAVAILABLE_REASONS = {
  soldOut: 'sold-out',
  hidden: 'hidden',
  categoryHidden: 'category-hidden',
  optionChanged: 'option-changed',
  optionRequired: 'option-required',
}

function trimText(value) {
  return String(value ?? '').trim()
}

// 商品の選ぶものを、画面（src/lib/optionModal.js の normalizeOptionChoice）と同じ読み方で読む。
// 選択肢が文字だけの古い形も受け付ける。「必ず選ぶ」は画面と同じく required が true のものだけ。
function normalizeProductOptionGroups(options) {
  return (Array.isArray(options) ? options : []).map(group => ({
    groupName: trimText(group?.groupName),
    required: group?.required === true,
    choices: (Array.isArray(group?.choices) ? group.choices : []).map(choice => (
      typeof choice === 'string'
        ? { label: trimText(choice), extraPrice: 0 }
        : { label: trimText(choice?.label), extraPrice: Math.max(0, Number(choice?.extraPrice) || 0) }
    )).filter(choice => choice.label),
  }))
}

// 送られた選択を商品の選ぶものと照らし、登録された名前と追加料金に置き換える。合わなければ理由を返す。
function resolveOptionSelections(product, optionSelections) {
  const groups = normalizeProductOptionGroups(product?.options)
  const sent = Array.isArray(optionSelections) ? optionSelections : []
  const resolved = []
  const usedGroups = new Set()
  for (const selection of sent) {
    const group = groups.find(item => item.groupName === trimText(selection?.groupName))
    if (!group || usedGroups.has(group.groupName)) return { reason: UNAVAILABLE_REASONS.optionChanged }
    const choice = group.choices.find(item => item.label === trimText(selection?.choice))
    if (!choice) return { reason: UNAVAILABLE_REASONS.optionChanged }
    usedGroups.add(group.groupName)
    resolved.push({ groupName: group.groupName, choice: choice.label, extraPrice: choice.extraPrice })
  }
  if (groups.some(group => group.required && group.choices.length > 0 && !usedGroups.has(group.groupName))) {
    return { reason: UNAVAILABLE_REASONS.optionRequired }
  }
  return { selections: resolved, reason: null }
}

// 注文できない商品か（売り切れ・お客様に出していない・分類を止めている）。分類が見つからない商品は止めない（今までどおり）。
function findProductUnavailableReason(product, category) {
  if (product?.isSoldOut === true) return UNAVAILABLE_REASONS.soldOut
  if (product?.isVisible === false) return UNAVAILABLE_REASONS.hidden
  if (category && category.isActive === false) return UNAVAILABLE_REASONS.categoryHidden
  return null
}

// 注文の品をすべて確かめる。1つでも注文できない品があれば、注文全体を止めて、その品の一覧を画面へ返す。
function verifyOrderItems(items) {
  const unavailableItems = []
  const verified = items.map(item => {
    const product = item.product
    const reason = findProductUnavailableReason(product, product?.category)
    if (reason) {
      unavailableItems.push({ productId: product.id, name: product.name ?? '', reason })
      return null
    }
    const options = resolveOptionSelections(product, item.optionSelections)
    if (options.reason) {
      unavailableItems.push({ productId: product.id, name: product.name ?? '', reason: options.reason })
      return null
    }
    return { ...item, optionSelections: options.selections }
  })
  if (unavailableItems.length > 0) {
    const unique = [...new Map(unavailableItems.map(entry => [`${entry.productId}:${entry.reason}`, entry])).values()]
    throw commandError('items-unavailable', 'Some items can no longer be ordered.', {
      unavailableItems: unique,
    }, { unavailableItems: unique })
  }
  return verified
}

module.exports = {
  UNAVAILABLE_REASONS,
  findProductUnavailableReason,
  normalizeProductOptionGroups,
  resolveOptionSelections,
  verifyOrderItems,
}
