import { createOrderCommandRequestId } from '../lib/orderCommands'
import { withOrderCommandFailureLog } from './orderCommandFailureService'
import {
  callOrderCommandFunction,
  callRegionalOrderSubmitFunction,
} from './orderFunctionCommandService'

// 注文・会計は必ずサーバー（Functions）を通す。ブラウザから直接書く開発用の予備は 2026-10-22 に廃止（整理 第4章）。

function compactOrderSubmitItems(items) {
  if (!Array.isArray(items)) return items
  return items.map(item => {
    if (!item) return item
    const productId = item?.product?.id ?? item?.productId
    const product = Object.fromEntries([
      ['id', productId],
      ['categoryGroup', item?.product?.categoryGroup],
    ].filter(([, value]) => value !== undefined))
    const compactItem = {
      product,
      optionSelections: Array.isArray(item?.optionSelections)
        ? item.optionSelections.map(option => {
          if (!option || typeof option !== 'object') return option
          return Object.fromEntries(
            ['groupName', 'choice', 'extraPrice']
              .filter(key => option[key] !== undefined)
              .map(key => [key, option[key]]),
          )
        })
        : [],
    }
    if (item?.quantity !== undefined) compactItem.quantity = item.quantity
    return compactItem
  })
}

// 人数分の自動追加はサーバーが店舗設定から読むので、画面からは送らない。
export async function startCustomerOrderSession({ guestCount, storeId, tableId }) {
  return withOrderCommandFailureLog({
    commandType: 'start_customer_order_session',
    actorType: 'customer',
    storeId,
    tableId,
  }, () => callOrderCommandFunction('startCustomerOrderSessionCommand', { guestCount, storeId, tableId }))
}

export async function submitCustomerOrderItems({ items, orderId, storeId, tableId, clientRequestId }) {
  const requestId = clientRequestId || createOrderCommandRequestId('customer-order')
  return withOrderCommandFailureLog({
    commandType: 'customer_submit_items',
    actorType: 'customer',
    storeId,
    tableId,
    orderId,
    clientRequestId: requestId,
  }, () => {
    const functionPayload = { items: compactOrderSubmitItems(items), orderId, storeId, tableId, clientRequestId: requestId }
    return callRegionalOrderSubmitFunction(
      'submitCustomerOrderItemsCommandAsia',
      'submitCustomerOrderItemsCommand',
      functionPayload,
    )
  })
}

// 操作したスタッフはサーバーが端末の記録から決める（画面からは送らない）。
export async function submitStaffOrderItems({ cart, orderId, storeId, tableId, clientRequestId }) {
  const requestId = clientRequestId || createOrderCommandRequestId('staff-order')
  return withOrderCommandFailureLog({
    commandType: 'staff_submit_items',
    actorType: 'staff',
    storeId,
    tableId,
    orderId,
    clientRequestId: requestId,
  }, () => {
    const functionPayload = { cart: compactOrderSubmitItems(cart), orderId, storeId, tableId, clientRequestId: requestId }
    return callRegionalOrderSubmitFunction(
      'submitStaffOrderItemsCommandAsia',
      'submitStaffOrderItemsCommand',
      functionPayload,
    )
  })
}

export async function seatStaffOrderSession({ table, tableId, seatCount }) {
  return withOrderCommandFailureLog({
    commandType: 'seat_staff_order_session',
    actorType: 'staff',
    storeId: table?.storeId,
    tableId,
  }, () => callOrderCommandFunction('seatStaffOrderSessionCommand', { tableId, seatCount }))
}

export async function completeCheckoutCommand({
  storeId,
  tableId,
  orderId,
  guestCount,
  subtotalBeforeItemDiscount,
  itemDiscountAmount,
  activeItemDiscounts,
  checkoutItemIds,
  orderItemsRevision,
  subtotal,
  checkoutDiscountType,
  checkoutDiscountValue,
  checkoutDiscountAmount,
  totalDiscountAmount,
  discountNote,
  total,
  paymentMethod,
  received,
  change,
}) {
  return withOrderCommandFailureLog({
    commandType: 'complete_checkout',
    actorType: 'staff',
    storeId,
    tableId,
    orderId,
  }, () => {
    const payload = {
      storeId,
      tableId,
      orderId,
      guestCount,
      subtotalBeforeItemDiscount,
      itemDiscountAmount,
      activeItemDiscounts,
      checkoutItemIds,
      orderItemsRevision,
      subtotal,
      checkoutDiscountType: checkoutDiscountType ?? null,
      checkoutDiscountValue: checkoutDiscountValue ?? null,
      checkoutDiscountAmount,
      totalDiscountAmount,
      discountNote,
      total,
      paymentMethod: paymentMethod ?? 'cash',
      received,
      change,
    }
    return callOrderCommandFunction('completeCheckoutCommand', payload)
  })
}
