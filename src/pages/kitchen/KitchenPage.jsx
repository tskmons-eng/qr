import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import StaffBottomNav from '../../components/StaffBottomNav'
import OrderCommandErrorNotice from '../../components/OrderCommandErrorNotice'
import KitchenEmptyState from '../../components/staff/KitchenEmptyState'
import KitchenHeader from '../../components/staff/KitchenHeader'
import KitchenSoundPanel from '../../components/staff/KitchenSoundPanel'
import KitchenTableGrid from '../../components/staff/KitchenTableGrid'
import TodayReservationNoticeList from '../../components/staff/TodayReservationNoticeList'
import { useStaffMember } from '../../contexts/StaffMemberContext'
import { useStore } from '../../contexts/StoreContext'
import { formatOrderCommandError, logOrderCommandError } from '../../lib/orderCommandErrors'
import { getTokyoDateString } from '../../lib/reservationDisplay'
import { loadKitchenSoundPrefs, playSound } from '../../lib/sounds'
import {
  addOptimisticHiddenKitchenItemIds,
  buildKitchenTableGroups,
  filterOptimisticHiddenKitchenItems,
  filterKitchenItemsByGroup,
  findNewKitchenItems,
  KITCHEN_FILTERS,
  pruneOptimisticHiddenKitchenItemIds,
  removeOptimisticHiddenKitchenItemIds,
} from '../../lib/kitchenDisplay'
import {
  cancelKitchenItem,
  markKitchenItemsServed,
  markKitchenItemServed,
  subscribeKitchenTables,
  subscribePendingKitchenItems,
} from '../../services/kitchenService'
import { subscribeTodayReservations } from '../../services/reservationService'
import { loadStoreConfig } from '../../services/settingsService'

export default function KitchenPage() {
  const { storeId, loading: storeLoading } = useStore()
  const { activeStaff } = useStaffMember()
  const navigate = useNavigate()
  const [tables, setTables] = useState([])
  const [pendingItems, setPendingItems] = useState([])
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [showSoundSettings, setShowSoundSettings] = useState(false)
  const [filterGroup, setFilterGroup] = useState('all')
  const [storeConfig, setStoreConfig] = useState(null)
  const [todayReservations, setTodayReservations] = useState([])
  const [commandError, setCommandError] = useState('')
  const [optimisticHiddenItemIds, setOptimisticHiddenItemIds] = useState(() => new Set())
  const prevItemIdsRef = useRef(null)
  const servedWorkflowEnabled = storeConfig?.servedWorkflowEnabled !== false
  const today = getTokyoDateString()

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 30000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!storeId) return undefined
    return subscribeKitchenTables(storeId, setTables)
  }, [storeId])

  useEffect(() => {
    if (!storeId) return undefined
    return subscribeTodayReservations(storeId, today, setTodayReservations)
  }, [storeId, today])

  useEffect(() => {
    if (!storeId) return
    loadStoreConfig(storeId).then(setStoreConfig)
  }, [storeId])

  useEffect(() => {
    if (!storeId) return undefined
    return subscribePendingKitchenItems(storeId, items => {
      const notifyItems = findNewKitchenItems(items, prevItemIdsRef.current, filterGroup)
      if (notifyItems.length > 0) {
        const { soundId, volume } = loadKitchenSoundPrefs()
        playSound(soundId, volume)
      }
      prevItemIdsRef.current = new Set(items.map(item => item.id))
      setPendingItems(items)
    })
  }, [filterGroup, storeId])

  useEffect(() => {
    setOptimisticHiddenItemIds(currentIds => pruneOptimisticHiddenKitchenItemIds(currentIds, pendingItems))
  }, [pendingItems])

  async function cancelItem(item, table) {
    if (!confirm(`「${item.productNameSnapshot} x${item.quantity}」を削除しますか？\n注文ミス用のキャンセルとして履歴に残します。`)) return
    setCommandError('')
    try {
      await cancelKitchenItem({ item, table, activeStaff })
    } catch (error) {
      const formatted = formatOrderCommandError(error, { context: 'kitchenAction' })
      setCommandError(formatted.message)
      logOrderCommandError({
        operation: 'kitchen_cancel_item',
        error,
        metadata: { storeId, tableId: item.tableId, itemId: item.id },
      })
    }
  }

  async function handleMarkServed(item) {
    const itemIds = [item.id]
    setCommandError('')
    setOptimisticHiddenItemIds(currentIds => addOptimisticHiddenKitchenItemIds(currentIds, itemIds))
    try {
      await markKitchenItemServed(item)
    } catch (error) {
      setOptimisticHiddenItemIds(currentIds => removeOptimisticHiddenKitchenItemIds(currentIds, itemIds))
      const formatted = formatOrderCommandError(error, { context: 'kitchenAction' })
      setCommandError(formatted.message)
      logOrderCommandError({
        operation: 'kitchen_mark_served',
        error,
        metadata: { storeId, tableId: item.tableId, itemId: item.id },
      })
    }
  }

  async function handleMarkAllServed(items) {
    const itemIds = items.map(item => item.id).filter(Boolean)
    setCommandError('')
    setOptimisticHiddenItemIds(currentIds => addOptimisticHiddenKitchenItemIds(currentIds, itemIds))
    try {
      await markKitchenItemsServed(items)
    } catch (error) {
      setOptimisticHiddenItemIds(currentIds => removeOptimisticHiddenKitchenItemIds(currentIds, itemIds))
      const formatted = formatOrderCommandError(error, { context: 'kitchenAction' })
      setCommandError(formatted.message)
      logOrderCommandError({
        operation: 'kitchen_mark_all_served',
        error,
        metadata: { storeId, itemCount: items.length },
      })
    }
  }

  const visiblePendingItems = useMemo(
    () => filterOptimisticHiddenKitchenItems(pendingItems, optimisticHiddenItemIds),
    [optimisticHiddenItemIds, pendingItems]
  )
  const filteredPendingItems = useMemo(
    () => filterKitchenItemsByGroup(visiblePendingItems, filterGroup),
    [filterGroup, visiblePendingItems]
  )
  const tableGroups = useMemo(
    () => buildKitchenTableGroups({ tables, pendingItems: visiblePendingItems, filterGroup }),
    [filterGroup, tables, visiblePendingItems]
  )

  if (storeLoading) return <div className="staff-kitchen-loading">読み込み中...</div>

  return (
    <div className="staff-kitchen-page">
      <KitchenHeader
        currentTime={new Date(nowMs).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
        filterGroup={filterGroup}
        filters={KITCHEN_FILTERS}
        pendingCount={filteredPendingItems.length}
        onBack={() => navigate('/staff')}
        onFilterChange={setFilterGroup}
        onToggleSound={() => setShowSoundSettings(value => !value)}
      />
      <OrderCommandErrorNotice message={commandError} />
      {showSoundSettings && <KitchenSoundPanel onClose={() => setShowSoundSettings(false)} />}
      {!servedWorkflowEnabled && (
        <div className="staff-kitchen-notice">
          提供済み管理がOFFのため、提供済み操作と何分待ち表示は出ません。
        </div>
      )}
      <TodayReservationNoticeList
        reservations={todayReservations}
        tables={tables}
        tone="kitchen"
      />

      {tableGroups.length === 0 ? (
        <KitchenEmptyState />
      ) : (
        <KitchenTableGrid
          groups={tableGroups}
          reservations={todayReservations}
          nowMs={nowMs}
          servedWorkflowEnabled={servedWorkflowEnabled}
          onCancelItem={cancelItem}
          onMarkAllServed={handleMarkAllServed}
          onMarkServed={handleMarkServed}
        />
      )}
      <StaffBottomNav current="kitchen" />
    </div>
  )
}
