const COMMAND_ERROR_MESSAGES = {
  'empty-order': '注文内容が空です。商品を選び直してください。',
  'table-not-found': '席が見つかりません。QRコードか席を確認してください。',
  'source-table-not-found': '移動元の席が見つかりません。席一覧から確認してください。',
  'target-table-not-found': '移動先の席が見つかりません。席一覧から確認してください。',
  'table-scope-mismatch': 'この席は現在の店舗と一致しません。スタッフに確認してください。',
  'table-not-vacant': 'この席はすでに使用中です。最新の席状態を確認してください。',
  'target-table-not-vacant': '移動先の席がすでに埋まっています。別の空席を選んでください。',
  'source-order-mismatch': '移動元の席の注文状態が更新されました。席詳細を確認してください。',
  'table-order-mismatch': '席と注文の状態が更新されています。画面を戻って確認してください。',
  'order-not-found': '注文が見つかりません。画面を戻って確認してください。',
  'order-scope-mismatch': '席と注文の状態が一致しません。画面を更新して確認してください。',
  'order-not-open': 'この注文は受付中ではありません。席の状態を確認してください。',
  'order-already-checked-out': 'この注文はすでに会計済みです。',
  'checkout-already-exists': 'この注文の会計はすでに作成されています。',
  'item-not-found': '対象の商品が見つかりません。画面を更新してください。',
  'item-table-mismatch': '商品と席の状態が一致しません。画面を更新してください。',
  'permission-denied': '操作権限がありません。スタッフ権限を確認してください。',
  aborted: '同時操作がありました。もう一度お試しください。',
  unavailable: '通信が不安定です。少し待ってからもう一度お試しください。',
  'deadline-exceeded': '通信に時間がかかっています。もう一度お試しください。',
  internal: '処理を完了できませんでした。もう一度お試しください。',
  'resource-exhausted': '処理が混み合っています。少し待ってからもう一度お試しください。',
}

const CONTEXT_FALLBACK_MESSAGES = {
  customerStart: '注文を開始できませんでした。もう一度お試しください。',
  customerSubmit: '注文を送信できませんでした。もう一度お試しください。',
  staffSubmit: '注文追加に失敗しました。もう一度お試しください。',
  staffSeat: '着席処理に失敗しました。席の状態を確認してください。',
  tableMove: '席移動に失敗しました。移動先の状態を確認してください。',
  checkout: '会計を完了できませんでした。席と注文の状態を確認してください。',
  itemAction: '注文状態を更新できませんでした。画面を更新して確認してください。',
  kitchenAction: 'キッチン操作に失敗しました。注文状態を確認してください。',
  general: '処理に失敗しました。もう一度お試しください。',
}

const NON_RETRYABLE_CODES = new Set([
  'empty-order',
  'table-not-found',
  'source-table-not-found',
  'target-table-not-found',
  'table-scope-mismatch',
  'table-not-vacant',
  'target-table-not-vacant',
  'source-order-mismatch',
  'table-order-mismatch',
  'order-not-found',
  'order-scope-mismatch',
  'order-not-open',
  'order-already-checked-out',
  'checkout-already-exists',
  'item-not-found',
  'item-table-mismatch',
  'permission-denied',
])

export function getOrderCommandErrorCode(error) {
  return error?.code || error?.cause?.code || 'unknown'
}

export function formatOrderCommandError(error, { context = 'general' } = {}) {
  const code = getOrderCommandErrorCode(error)
  return {
    code,
    message: COMMAND_ERROR_MESSAGES[code] || CONTEXT_FALLBACK_MESSAGES[context] || CONTEXT_FALLBACK_MESSAGES.general,
    retryable: !NON_RETRYABLE_CODES.has(code),
  }
}

export function logOrderCommandError({ operation, error, metadata = {} }) {
  const formatted = formatOrderCommandError(error)
  console.warn('[order-command-failure]', {
    operation,
    code: formatted.code,
    message: error?.message ?? '',
    metadata,
  })
}
