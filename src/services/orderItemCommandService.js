import { getOrderCommandErrorCode } from '../lib/orderCommandErrors'
import { withOrderCommandFailureLog } from './orderCommandFailureService'
import { callOrderCommandFunction } from './orderFunctionCommandService'

// 提供済み・未提供に戻す・取消は必ずサーバー（Functions）を通す。ブラウザから直接書く予備は 2026-10-22 に廃止（整理 第4章）。
// 操作したスタッフはサーバーが端末の記録から決めるので、画面からは送らない。

function normalizeItemTargets(items) {
  return Array.isArray(items) ? items.filter(item => item?.id) : []
}

export function markOrderItemServedCommand({ tableId, itemId }) {
  return withOrderCommandFailureLog({
    commandType: 'mark_item_served',
    actorType: 'staff',
    tableId,
    itemId,
  }, () => callOrderCommandFunction('markOrderItemServedCommand', { tableId, itemId }))
}

export function markOrderItemsServedCommand(items) {
  const targets = normalizeItemTargets(items)
  return withOrderCommandFailureLog({
    commandType: 'mark_items_served',
    actorType: 'staff',
    tableId: targets[0]?.tableId,
    itemId: targets[0]?.id,
  }, () => callOrderCommandFunction('markOrderItemsServedCommand', { items: targets }))
}

export function markOrderItemOrderedCommand({ tableId, itemId }) {
  return withOrderCommandFailureLog({
    commandType: 'mark_item_ordered',
    actorType: 'staff',
    tableId,
    itemId,
  }, () => callOrderCommandFunction('markOrderItemOrderedCommand', { tableId, itemId }))
}

export function cancelOrderItemCommand({ itemId, tableId, tableName, source, passcode }) {
  return withOrderCommandFailureLog({
    commandType: 'cancel_order_item',
    actorType: 'staff',
    tableId,
    itemId,
  }, () => callOrderCommandFunction('cancelOrderItemCommand', {
    itemId,
    tableId,
    tableName,
    source,
    ...(passcode ? { passcode } : {}),
  }))
}

// 席詳細と厨房で共通の取消。パスコードが違うときだけは例外にせず、画面で入力し直せるように返す。
export async function cancelOrderItemWithPasscode(params) {
  try {
    await cancelOrderItemCommand(params)
    return { ok: true }
  } catch (error) {
    if (getOrderCommandErrorCode(error) === 'invalid-cancel-passcode') {
      return { ok: false, reason: 'invalid-passcode' }
    }
    throw error
  }
}
