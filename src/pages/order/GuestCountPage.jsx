import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import GuestCountSelector from '../../components/order/GuestCountSelector'
import { useOrder } from '../../contexts/OrderContext'
import { applyCustomerOrderStartToTable, stepGuestCount } from '../../lib/customerEntry'
import { createCustomerOrderSession } from '../../services/customerEntryService'

export default function GuestCountPage() {
  const { table, tableId, storeId, setOrderId, setTable, storeConfig } = useOrder()
  const [count, setCount] = useState(2)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const guestAutoAdd = storeConfig?.guestAutoAdd ?? {}
  const showAutoAddButton = Boolean(
    guestAutoAdd.enabled &&
    guestAutoAdd.productId &&
    guestAutoAdd.showGuestCountButton !== false
  )

  async function handleStart() {
    setLoading(true)
    try {
      const orderId = await createCustomerOrderSession({ storeId, tableId, guestCount: count, guestAutoAdd })
      setOrderId(orderId)
      setTable(currentTable => applyCustomerOrderStartToTable(currentTable, count, orderId))
      navigate('../menu', { replace: true })
    } catch {
      alert('エラーが発生しました。もう一度試してください。')
    } finally {
      setLoading(false)
    }
  }

  return (
    <GuestCountSelector
      count={count}
      loading={loading}
      tableName={table.tableName}
      autoAddLabel={showAutoAddButton ? `${guestAutoAdd.productNameSnapshot || '設定メニュー'}を${count}名分追加して始める` : ''}
      onChange={delta => setCount(currentCount => stepGuestCount(currentCount, delta))}
      onStart={handleStart}
    />
  )
}
