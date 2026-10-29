import { trySignInCustomer } from './customerAccessService'
import { submitCustomerOrderItems } from './orderCommandService'

export async function submitCustomerCartOrder({ items, orderId, storeId, tableId, clientRequestId }) {
  await trySignInCustomer()
  return submitCustomerOrderItems({ items, orderId, storeId, tableId, clientRequestId })
}
