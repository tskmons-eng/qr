import { createOrderCommandRequestId } from '../lib/orderCommands'
import { withOrderCommandFailureLog } from './orderCommandFailureService'
import { callOrderCommandFunction, shouldUseOrderCommandFunctions } from './orderFunctionCommandService'
import {
  completeCheckoutClient,
  seatStaffOrderSessionClient,
  startCustomerOrderSessionClient,
  submitCustomerOrderItemsClient,
  submitStaffOrderItemsClient,
} from './orderClientCommandService'

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
    return shouldUseOrderCommandFunctions()
      ? callOrderCommandFunction('submitCustomerOrderItemsCommand', payload)
      : submitCustomerOrderItemsClient(payload)
  })
}

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
    const payload = { cart, orderId, storeId, tableId, clientRequestId: requestId }
    return shouldUseOrderCommandFunctions()
      ? callOrderCommandFunction('submitStaffOrderItemsCommand', payload)
      : submitStaffOrderItemsClient(payload)
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
