const { commandError } = require('./orderCommandShared')

// 会計の合計をサーバーで計算し直す（2026-10-29 レジ 第1章）。
// 画面（src/lib/checkoutCalculations.js）と同じ計算。画面の数字と違えば断り、記録はここで計算した数字で残す。
// 両方が同じ答えを出すことは scripts/check-checkout-calculations.mjs で確かめている。
const PAYMENT_METHODS = ['cash', 'card', 'qr']

function calcDiscount(base, type, value) {
  const amount = Number(value)
  if (Number.isNaN(amount) || amount <= 0) return 0
  if (type === 'percent') return Math.min(base, Math.floor(base * Math.min(amount, 100) / 100))
  return Math.min(base, amount)
}

function calcItemDiscount(item, type, value) {
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

function calculateIncludedTax(total, taxRate) {
  if (taxRate <= 0) return 0
  return Math.round(total * taxRate / (100 + taxRate))
}

// 店の設定の税率を、画面（src/lib/settingsConfig.js の normalizeTaxRate）と同じ読み方で読む。
function normalizeTaxRate(value) {
  if (value === null || value === undefined || value === '') return 10
  const taxRate = Number(value)
  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) return 10
  return taxRate
}

function normalizePaymentMethod(value) {
  if (value === undefined || value === null || value === '') return 'cash'
  if (!PAYMENT_METHODS.includes(value)) throw commandError('invalid-argument', 'Unknown payment method.')
  return value
}

// 画面から届いた値引きの指定（種類と値）だけを使い、品の値段は記録から読む。
// 会計の値引きの種類が届かない古い画面は、金額の値引きとして扱う（今まで送っていた金額と同じ結果になる）。
function recalculateCheckout({ items, data, taxRate }) {
  const itemDiscountInputs = new Map((Array.isArray(data.activeItemDiscounts) ? data.activeItemDiscounts : [])
    .map(discount => [String(discount?.orderItemId ?? ''), discount]))
  const itemDiscounts = items.map(item => {
    const input = itemDiscountInputs.get(item.id)
    const { amount, unitPrice, unitDiscount } = calcItemDiscount(item, input?.type, input?.value)
    if (amount <= 0) return null
    const note = String(input?.note ?? '').trim()
    return {
      orderItemId: item.id,
      productNameSnapshot: item.productNameSnapshot ?? null,
      quantity: item.quantity,
      unitPrice,
      type: input.type,
      value: Number(input.value) || 0,
      unitDiscountAmount: unitDiscount,
      amount,
      note: note || null,
    }
  }).filter(Boolean)

  const subtotalBeforeItemDiscount = items.reduce((sum, item) => sum + (Number(item.lineTotal) || 0), 0)
  const itemDiscountAmount = itemDiscounts.reduce((sum, row) => sum + row.amount, 0)
  const subtotal = subtotalBeforeItemDiscount - itemDiscountAmount
  const legacyDiscount = data.checkoutDiscountType === undefined
  const discountType = legacyDiscount ? 'amount' : data.checkoutDiscountType
  const discountValue = legacyDiscount ? data.checkoutDiscountAmount : data.checkoutDiscountValue
  const checkoutDiscountAmount = calcDiscount(subtotal, discountType, discountValue)
  const total = subtotal - checkoutDiscountAmount
  const paymentMethod = normalizePaymentMethod(data.paymentMethod)
  const received = paymentMethod === 'cash' ? Number(data.received) || 0 : total

  const result = {
    subtotalBeforeItemDiscount,
    itemDiscountAmount,
    activeItemDiscounts: itemDiscounts,
    subtotal,
    checkoutDiscountAmount,
    totalDiscountAmount: itemDiscountAmount + checkoutDiscountAmount,
    total,
    taxRate,
    taxAmount: calculateIncludedTax(total, taxRate),
    paymentMethod,
    received,
    change: received - total,
  }
  const mismatched = ['itemDiscountAmount', 'subtotal', 'checkoutDiscountAmount', 'total', 'change']
    .filter(key => data[key] !== undefined && data[key] !== null && Math.round(Number(data[key])) !== result[key])
  if (mismatched.length > 0) {
    throw commandError('checkout-total-mismatch', 'Checkout total does not match the order items.', {
      mismatched,
      serverTotal: total,
      clientTotal: Number(data.total),
    })
  }
  if (received < total) throw commandError('checkout-received-short', 'Received cash is less than the total.')
  return result
}

module.exports = {
  PAYMENT_METHODS,
  calcDiscount,
  calcItemDiscount,
  calculateIncludedTax,
  normalizeTaxRate,
  recalculateCheckout,
}
