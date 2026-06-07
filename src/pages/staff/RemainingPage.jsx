import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import StaffBottomNav from '../../components/StaffBottomNav'
import RemainingHeader from '../../components/staff/RemainingHeader'
import RemainingOrderList from '../../components/staff/RemainingOrderList'
import { splitTableOrderItems } from '../../lib/staffTableDetail'
import {
  markOrderItemServed,
  subscribeStaffTable,
  subscribeStaffTableOrderItems,
} from '../../services/staffTableService'
import { loadStoreConfig } from '../../services/settingsService'

export default function RemainingPage() {
  const { tableId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [table, setTable] = useState(null)
  const [items, setItems] = useState([])
  const [storeConfig, setStoreConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const activeOrderId = location.state?.orderId ?? table?.currentOrderId ?? null
  const activeStoreId = location.state?.storeId ?? table?.storeId ?? null

  useEffect(() => {
    const unsub = subscribeStaffTable(tableId, nextTable => {
      setTable(nextTable)
      setLoading(false)
    })
    return unsub
  }, [tableId])

  useEffect(() => {
    if (!activeOrderId) {
      setItems([])
      return undefined
    }
    return subscribeStaffTableOrderItems(activeOrderId, setItems)
  }, [activeOrderId])

  useEffect(() => {
    if (!activeStoreId) return
    loadStoreConfig(activeStoreId).then(setStoreConfig)
  }, [activeStoreId])

  async function markServed(item) {
    if (item.itemStatus !== 'ordered') return
    await markOrderItemServed({ tableId, itemId: item.id })
  }

  const { orderedItems: remainingItems, servedItems } = splitTableOrderItems(items)
  const servedWorkflowEnabled = storeConfig?.servedWorkflowEnabled !== false

  if (loading) return <div className="staff-remaining-loading">読み込み中...</div>

  return (
    <div className="staff-remaining-page">
      <RemainingHeader
        remainingCount={remainingItems.length}
        servedCount={servedItems.length}
        tableName={table?.tableName ?? '席'}
        onBack={() => navigate(`/staff/table/${tableId}`)}
      />
      <RemainingOrderList
        title="まだ残っているもの"
        items={remainingItems}
        emptyText="残っている注文はありません"
        servedWorkflowEnabled={servedWorkflowEnabled}
        onMarkServed={markServed}
      />
      {servedWorkflowEnabled && servedItems.length > 0 && (
        <RemainingOrderList
          title="提供済み"
          items={servedItems}
          served
        />
      )}
      <StaffBottomNav
        current="remaining"
        tableId={tableId}
        orderId={activeOrderId}
        storeId={activeStoreId}
        guestCount={table?.guestCount}
        pendingCount={remainingItems.length}
      />
    </div>
  )
}
