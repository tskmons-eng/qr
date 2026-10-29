// 支払い方法（2026-10-29 レジ 第2章）。会計の画面・売上の明細・CSV で同じ名前を使う。
// 値の並びは functions/checkoutCalculations.js の PAYMENT_METHODS と同じ（scripts/check-checkout-calculations.mjs で確かめている）。
export const PAYMENT_METHOD_OPTIONS = [
  { value: 'cash', label: '現金' },
  { value: 'card', label: 'カード' },
  { value: 'qr', label: 'QR決済' },
]

// 支払い方法の無い古い会計は現金。
export function paymentMethodLabel(method) {
  if (!method || method === '現金') return '現金'
  return PAYMENT_METHOD_OPTIONS.find(option => option.value === method)?.label ?? String(method)
}

export function isCashPayment(method) {
  return !method || method === 'cash'
}
