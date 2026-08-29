import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import GuestCountSelector from '../../components/order/GuestCountSelector'
import { useOrder } from '../../contexts/OrderContext'
import { applyCustomerOrderStartToTable, stepGuestCount } from '../../lib/customerEntry'
import { formatOrderCommandError, logOrderCommandError } from '../../lib/orderCommandErrors'
import { createCustomerOrderSession } from '../../services/customerEntryService'

export default function GuestCountPage() {
  const { table, tableId, storeId, setOrderId, setTable, storeConfig, storeConfigLoading } = useOrder()
  const [count, setCount] = useState(2)
  const [commandError, setCommandError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const guestAutoAdd = storeConfig?.guestAutoAdd ?? {}
  const showAutoAddButton = Boolean(
    guestAutoAdd.enabled &&
    guestAutoAdd.productId &&
    guestAutoAdd.showGuestCountButton !== false
  )

  async function handleStart() {
    if (storeConfigLoading || loading) return
    setLoading(true)
    setCommandError('')
    try {
      const orderId = await createCustomerOrderSession({ storeId, tableId, guestCount: count, guestAutoAdd })
      setOrderId(orderId)
      setTable(currentTable => applyCustomerOrderStartToTable(currentTable, count, orderId))
      navigate('../menu', { replace: true })
    } catch (error) {
      const formatted = formatOrderCommandError(error, { context: 'customerStart' })
      setCommandError(formatted.message)
      logOrderCommandError({
        operation: 'customer_start_order',
        error,
        metadata: { storeId, tableId, guestCount: count },
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <GuestCountSelector
      count={count}
      errorMessage={commandError}
      loading={loading}
      ready={!storeConfigLoading}
      tableName={table.tableName}
      autoAddNote={showAutoAddButton ? `${guestAutoAdd.productNameSnapshot || '設定メニュー'}を${count}名分追加します` : ''}
      onChange={delta => setCount(currentCount => stepGuestCount(currentCount, delta))}
      onStart={handleStart}
    />
  )
}
