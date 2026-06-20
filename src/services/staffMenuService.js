import { submitStaffOrderItems } from './orderCommandService'

export function submitStaffMenuOrder({ activeStaff, cart, orderId, storeId, tableId, clientRequestId }) {
  return submitStaffOrderItems({ activeStaff, cart, orderId, storeId, tableId, clientRequestId })
}
