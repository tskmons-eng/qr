import { isCashPayment } from './paymentMethods.js'

export function calcDiscount(base, type, value) {
  const amount = Number(value)
  if (Number.isNaN(amount) || amount <= 0) return 0
  if (type === 'percent') return Math.min(base, Math.floor(base * Math.min(amount, 100) / 100))
  return Math.min(base, amount)
}

export function calcItemDiscount(item, type, value) {
  const quantity = Math.max(1, Number(item.quantity) || 1)
  const lineTotal = Number(item.lineTotal) || 0
  const rawUnitPrice = lineTotal / quantity
  const unitPrice = Math.round(rawUnitPrice)
  const amount = Number(value)

  if (Number.isNaN(amount) || amount <= 0 || !type) {
    return { amount: 0, unitPrice, unitDiscount: 0 }
  }

  const unitDiscount = type === 'percent'
    ? Math.min(rawUnitPrice, Math.floor(rawUnitPrice * Math.min(amount, 100) / 100))
    : Math.min(rawUnitPrice, amount)

  return {
    amount: Math.min(lineTotal, Math.round(unitDiscount * quantity)),
    unitPrice,
    unitDiscount: Math.round(unitDiscount),
  }
}

export function activeItemDiscountsFromRows(itemDiscountRows) {
  return itemDiscountRows
    .filter(row => row.amount > 0)
    .map(({ item, config, amount, unitPrice, unitDiscount }) => ({
      orderItemId: item.id,
      productNameSnapshot: item.productNameSnapshot,
      quantity: item.quantity,
      unitPrice,
      type: config.type,
      value: Number(config.value) || 0,
      unitDiscountAmount: unitDiscount,
      amount,
      note: config.note?.trim() || null,
    }))
}

export function calculateCheckoutTotals({
  items,
  itemDiscounts,
  discountType,
  discountValue,
  taxRate,
  receivedCash,
  paymentMethod = 'cash',
}) {
  const itemDiscountRows = items.map(item => {
    const config = itemDiscounts[item.id] ?? {}
    const { amount, unitPrice, unitDiscount } = calcItemDiscount(item, config.type, config.value)
    return { item, config, amount, unitPrice, unitDiscount }
  })

  const subtotalBeforeItemDiscount = items.reduce((sum, item) => sum + (Number(item.lineTotal) || 0), 0)
  const itemDiscountAmount = itemDiscountRows.reduce((sum, row) => sum + row.amount, 0)
  const subtotal = subtotalBeforeItemDiscount - itemDiscountAmount
  const discountAmount = calcDiscount(subtotal, discountType, discountValue)
  const totalDiscountAmount = itemDiscountAmount + discountAmount
  const total = subtotal - discountAmount
  const taxAmount = taxRate > 0 ? Math.round(total * taxRate / (100 + taxRate)) : 0
  // 現金以外（カード・QR決済）は店の端末で合計ちょうどを受け取るので、お預かりは合計・お釣りは0。
  const isCash = isCashPayment(paymentMethod)
  const received = isCash ? Number(receivedCash) || 0 : total
  const change = received >= total ? received - total : null
  const activeItemDiscounts = activeItemDiscountsFromRows(itemDiscountRows)

  return {
    itemDiscountRows,
    subtotalBeforeItemDiscount,
    itemDiscountAmount,
    subtotal,
    discountAmount,
    totalDiscountAmount,
    total,
    taxAmount,
    received,
    change,
    activeItemDiscounts,
  }
}

// 1人あたりの金額（割り勘）。1円未満は切り上げ。1名以下なら出さない。お客様の画面と同じ計算。
export function calculatePerPerson(total, guestCount) {
  return guestCount > 1 ? Math.ceil(total / guestCount) : null
}

// お預かりのボタン（2026-10-29 レジ 第2章）。「ちょうど」を先に、そのあと合計より多い切りのよい金額を3つまで。
// 合計より少ない金額・同じ金額のボタンは出さない（.claude/rules/ui.md 1章）。
export function buildCashPresets(total) {
  if (!(total > 0)) return []
  const tenThousands = Math.ceil(total / 10000) * 10000
  const candidates = [
    Math.ceil(total / 1000) * 1000,
    Math.ceil(total / 5000) * 5000,
    tenThousands,
    tenThousands + 10000,
  ]
  const others = [...new Set(candidates.filter(amount => amount > total))].slice(0, 3)
  return [{ amount: total, exact: true }, ...others.map(amount => ({ amount, exact: false }))]
}
