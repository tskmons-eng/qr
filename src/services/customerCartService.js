import { submitCustomerOrderItems } from './orderCommandService'

export function submitCustomerCartOrder({ items, orderId, storeId, tableId, clientRequestId }) {
  return submitCustomerOrderItems({ items, orderId, storeId, tableId, clientRequestId })
}
