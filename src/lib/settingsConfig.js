export const CUSTOMER_SETTING_TOGGLES = [
  { key: 'showServedStatus', label: '提供済み表示', description: 'お客様の注文確認画面に「提供済み」ラベルを表示する' },
  { key: 'showItemPrice', label: '商品ごとの金額表示', description: 'お客様の注文確認画面に各商品の金額を表示する' },
  { key: 'allowAdditionalOrders', label: '追加注文ボタン表示', description: 'お客様の注文確認画面に「追加注文する」ボタンを表示する' },
]

export const WORKFLOW_SETTING_TOGGLES = [
  { key: 'notificationsEnabled', label: '通知', description: 'スタッフ端末への呼び出し・会計通知を店舗全体で有効にする' },
  { key: 'servedWorkflowEnabled', label: '提供済み管理', description: 'オフにすると提供済み操作とキッチンの何分待ち表示が出なくなります' },
]

export const GUEST_AUTO_ADD_DEFAULTS = {
  enabled: false,
  productId: '',
  productNameSnapshot: '',
  showGuestCountButton: true,
}

export const STORE_CONFIG_DEFAULTS = {
  showServedStatus: true,
  showItemPrice: true,
  allowAdditionalOrders: true,
  notificationsEnabled: true,
  servedWorkflowEnabled: true,
  guestAutoAdd: GUEST_AUTO_ADD_DEFAULTS,
  taxRate: 10,
}

export const TAX_PRESETS = [0, 8, 10]

export function normalizeGuestAutoAdd(config = {}) {
  return {
    ...GUEST_AUTO_ADD_DEFAULTS,
    ...(config && typeof config === 'object' ? config : {}),
  }
}

export function normalizeStoreConfig(data = {}) {
  return {
    ...STORE_CONFIG_DEFAULTS,
    ...data,
    guestAutoAdd: normalizeGuestAutoAdd(data.guestAutoAdd),
  }
}

export function normalizeAllowedEmail(email) {
  return email.trim().toLowerCase()
}

export function validateAllowedEmail(email, allowedEmails) {
  if (!email.includes('@')) return '正しいメールアドレスを入力してください'
  if (allowedEmails.includes(email)) return 'すでに追加されています'
  return ''
}

export function calculateIncludedTax(total, taxRate) {
  if (taxRate <= 0) return 0
  return Math.round(total * taxRate / (100 + taxRate))
}
