import { submitStaffOrderItems } from './orderCommandService'

export function submitStaffMenuOrder({ cart, orderId, storeId, tableId, clientRequestId }) {
  return submitStaffOrderItems({ cart, orderId, storeId, tableId, clientRequestId })
}
