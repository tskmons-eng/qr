import { createOrderCommandRequestId } from '../lib/orderCommands'
import { withOrderCommandFailureLog } from './orderCommandFailureService'
import {
  callOrderCommandFunction,
  callRegionalOrderSubmitFunction,
  shouldUseOrderCommandFunctions,
} from './orderFunctionCommandService'
import {
  completeCheckoutClient,
  seatStaffOrderSessionClient,
  startCustomerOrderSessionClient,
  submitCustomerOrderItemsClient,
  submitStaffOrderItemsClient,
} from './orderClientCommandService'

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

export async function startCustomerOrderSession({ guestAutoAdd, guestCount, storeId, tableId }) {
  return withOrderCommandFailureLog({
    commandType: 'start_customer_order_session',
    actorType: 'customer',
    storeId,
    tableId,
  }, () => {
    const payload = { guestAutoAdd, guestCount, storeId, tableId }
    return shouldUseOrderCommandFunctions()
      ? callOrderCommandFunction('startCustomerOrderSessionCommand', payload)
      : startCustomerOrderSessionClient(payload)
  })
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
    const payload = { items, orderId, storeId, tableId, clientRequestId: requestId }
    if (!shouldUseOrderCommandFunctions()) return submitCustomerOrderItemsClient(payload)
    const functionPayload = { ...payload, items: compactOrderSubmitItems(items) }
    return callRegionalOrderSubmitFunction(
      'submitCustomerOrderItemsCommandAsia',
      'submitCustomerOrderItemsCommand',
      functionPayload,
    )
  })
}

export async function submitStaffOrderItems({ activeStaff, cart, orderId, storeId, tableId, clientRequestId }) {
  const requestId = clientRequestId || createOrderCommandRequestId('staff-order')
  return withOrderCommandFailureLog({
    commandType: 'staff_submit_items',
    actorType: 'staff',
    storeId,
    tableId,
    orderId,
    clientRequestId: requestId,
  }, () => {
    const payload = { activeStaff, cart, orderId, storeId, tableId, clientRequestId: requestId }
    if (!shouldUseOrderCommandFunctions()) return submitStaffOrderItemsClient(payload)
    const functionPayload = { ...payload, cart: compactOrderSubmitItems(cart) }
    return callRegionalOrderSubmitFunction(
      'submitStaffOrderItemsCommandAsia',
      'submitStaffOrderItemsCommand',
      functionPayload,
    )
  })
}

export async function seatStaffOrderSession({ table, tableId, seatCount, activeStaff }) {
  return withOrderCommandFailureLog({
    commandType: 'seat_staff_order_session',
    actorType: 'staff',
    storeId: table?.storeId,
    tableId,
  }, () => {
    return shouldUseOrderCommandFunctions()
      ? callOrderCommandFunction('seatStaffOrderSessionCommand', { tableId, seatCount, activeStaff })
      : seatStaffOrderSessionClient({ table, tableId, seatCount, activeStaff })
  })
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
  checkoutDiscountAmount,
  totalDiscountAmount,
  discountNote,
  total,
  received,
  change,
  activeStaff,
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
      checkoutDiscountAmount,
      totalDiscountAmount,
      discountNote,
      total,
      received,
      change,
      activeStaff,
    }
    return shouldUseOrderCommandFunctions()
      ? callOrderCommandFunction('completeCheckoutCommand', payload)
      : completeCheckoutClient(payload)
  })
}
