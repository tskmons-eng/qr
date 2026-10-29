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
  'checkout-items-stale': '注文明細が更新されました。会計内容を確認してからもう一度確定してください。',
  'checkout-total-mismatch': '合計が注文の品と合いません。画面を読み込み直して、もう一度確定してください。',
  'checkout-received-short': 'お預かりが合計より少ないです。金額を確かめてください。',
  'check-not-found': '会計が見つかりません。画面を読み込み直してください。',
  'check-not-completed': 'この会計はもう取り消し・打ち直しされています。画面を読み込み直してください。',
  'register-closed': 'この日はもう締めてあるので、会計を直せません。',
  'closing-already-exists': '今日はもう締めてあります。',
  'closing-date-changed': '日付が変わりました。画面を読み込み直してから締めてください。',
  'void-reason-required': '取り消す理由を選んでください。',
  'item-not-found': '対象の商品が見つかりません。画面を更新してください。',
  'item-table-mismatch': '商品と席の状態が一致しません。画面を更新してください。',
  'permission-denied': '操作権限がありません。スタッフ権限を確認してください。',
  'staff-not-selected': 'スタッフを選んでから操作してください。画面を読み込み直して、スタッフを選び直してください。',
  'invalid-cancel-passcode': 'パスコードが違います',
  'invalid-cancel-passcode-format': 'パスコードは数字4〜8桁で入力してください。',
  'cancel-passcode-not-set': '取消パスコードが未設定です。メニュー管理の権限がある人に取り消してもらうか、店舗設定でパスコードを決めてください。',
  'cancel-passcode-locked': 'パスコードを続けて間違えたため、10分間取り消せません。メニュー管理の権限がある人に取り消してもらってください。',
  'store-not-found': '店舗が見つかりません。店舗コードを確認してください。',
  'invalid-staff-code': 'パスが違います',
  'invalid-staff-code-format': 'パスは4桁の数字にしてください',
  'staff-code-locked': '5回続けて間違えたため、このスタッフは10分間入れません',
  'staff-code-required': '4桁のパスを入力してください',
  'staff-code-not-set': 'このスタッフはパスが未設定です。店長に設定してもらってください',
  'staff-code-unchanged': '新パスは旧パスと違う数字にしてください',
  'staff-member-not-found': 'スタッフが見つかりません。一覧を読み込み直してください',
  'invite-not-found': 'この招待リンクは使えません。運営者に招待を出し直してもらってください',
  'invite-used': 'この招待はもう使われています。運営者に招待を出し直してもらってください',
  'invite-expired': 'この招待は期限が切れています。運営者に招待を出し直してもらってください',
  'invite-email-required': 'Google でログインしてから、もう一度お試しください',
  'email-already-assigned': 'このアカウントは、すでに別の店の店長です。別の Google アカウントでログインしてください',
  'store-code-unavailable': '店舗コードを決められませんでした。もう一度お試しください',
  'items-unavailable': '売り切れなどで注文できない品がありました。カートを確かめてください。',
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
  staffLogin: '入れませんでした。通信を確かめて、もう一度お試しください',
  storeInvite: '招待を確かめられませんでした。通信を確かめて、もう一度お試しください',
  storeCreate: '店舗を作れませんでした。もう一度お試しください',
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
  'checkout-items-stale',
  'checkout-total-mismatch',
  'checkout-received-short',
  'check-not-found',
  'check-not-completed',
  'register-closed',
  'closing-already-exists',
  'closing-date-changed',
  'void-reason-required',
  'item-not-found',
  'item-table-mismatch',
  'permission-denied',
  'staff-not-selected',
  'invalid-cancel-passcode',
  'invalid-cancel-passcode-format',
  'cancel-passcode-not-set',
  'cancel-passcode-locked',
  'store-not-found',
  'invalid-staff-code',
  'invalid-staff-code-format',
  'staff-code-locked',
  'staff-code-required',
  'staff-code-not-set',
  'staff-code-unchanged',
  'staff-member-not-found',
  'invite-not-found',
  'invite-used',
  'invite-expired',
  'invite-email-required',
  'email-already-assigned',
  'items-unavailable',
])

export function getOrderCommandErrorCode(error) {
  return error?.code || error?.cause?.code || 'unknown'
}

// パスコードの打ち間違いやロック、売り切れになった品は操作の結果で、システムの失敗ではない（失敗ログに残さない）。
const EXPECTED_OPERATOR_ERROR_CODES = new Set([
  'items-unavailable',
  'invalid-cancel-passcode',
  'invalid-cancel-passcode-format',
  'cancel-passcode-locked',
  'invalid-staff-code',
  'invalid-staff-code-format',
  'staff-code-locked',
  'staff-code-required',
  'staff-code-unchanged',
  // 締め（2026-10-30）：締めた日の会計・二重の締め・理由なしの取り消しは、操作の結果
  'register-closed',
  'closing-already-exists',
  'closing-date-changed',
  'void-reason-required',
  'check-not-completed',
])

export function isExpectedOperatorError(error) {
  return EXPECTED_OPERATOR_ERROR_CODES.has(getOrderCommandErrorCode(error))
}

export function formatOrderCommandError(error, { context = 'general' } = {}) {
  const code = getOrderCommandErrorCode(error)
  return {
    code,
    message: COMMAND_ERROR_MESSAGES[code] || CONTEXT_FALLBACK_MESSAGES[context] || CONTEXT_FALLBACK_MESSAGES.general,
    retryable: !NON_RETRYABLE_CODES.has(code),
  }
}

const UNAVAILABLE_REASON_LABELS = {
  'sold-out': '売り切れ',
  hidden: '今は注文できません',
  'category-hidden': '今は注文できません',
  'option-changed': '選ぶものが変わりました',
  'option-required': '選ぶものが選ばれていません',
}

// 注文を止めた品（サーバーが items-unavailable で返した一覧）。カートから外す商品と、知らせる文言を作る（2026-10-23 注文の流れ 第1章）。
export function describeUnavailableItems(error) {
  if (getOrderCommandErrorCode(error) !== 'items-unavailable') return null
  const entries = Array.isArray(error?.details?.unavailableItems) ? error.details.unavailableItems : []
  const productIds = [...new Set(entries.map(entry => entry?.productId).filter(Boolean))]
  const lines = entries.map(entry => `${entry?.name || '商品'}（${UNAVAILABLE_REASON_LABELS[entry?.reason] ?? '今は注文できません'}）`)
  const message = lines.length > 0
    ? `注文できない品がありました：${[...new Set(lines)].join('、')}。カートから外しました。ほかの品は、もう一度送れます。`
    : COMMAND_ERROR_MESSAGES['items-unavailable']
  return { productIds, message }
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
