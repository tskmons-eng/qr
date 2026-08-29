import { useEffect, useRef, useState } from 'react'
import { useOrder } from '../contexts/OrderContext'
import { createCustomerCall } from '../services/customerMenuService'

const CUSTOMER_CALL_COOLDOWN_MS = 30000

export default function useCustomerCall() {
  const { storeId, tableId, table, orderId } = useOrder()
  const [callDisabled, setCallDisabled] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => () => clearTimeout(timerRef.current), [])

  async function requestStaff() {
    if (callDisabled) return
    await createCustomerCall({
      storeId,
      tableId,
      tableName: table?.tableName ?? '',
      orderId,
      type: 'call',
    })
    setCallDisabled(true)
    timerRef.current = setTimeout(() => setCallDisabled(false), CUSTOMER_CALL_COOLDOWN_MS)
  }

  return { callDisabled, requestStaff }
}
