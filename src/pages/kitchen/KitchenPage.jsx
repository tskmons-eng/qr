import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import StaffBottomNav from '../../components/StaffBottomNav'
import KitchenEmptyState from '../../components/staff/KitchenEmptyState'
import KitchenHeader from '../../components/staff/KitchenHeader'
import KitchenSoundPanel from '../../components/staff/KitchenSoundPanel'
import KitchenTableGrid from '../../components/staff/KitchenTableGrid'
import { useStaffMember } from '../../contexts/StaffMemberContext'
import { useStore } from '../../contexts/StoreContext'
import { loadKitchenSoundPrefs, playSound } from '../../lib/sounds'
import {
  buildKitchenTableGroups,
  filterKitchenItemsByGroup,
  findNewKitchenItems,
  KITCHEN_FILTERS,
} from '../../lib/kitchenDisplay'
import {
  cancelKitchenItem,
  markKitchenItemsServed,
  markKitchenItemServed,
  subscribeKitchenTables,
  subscribePendingKitchenItems,
} from '../../services/kitchenService'

export default function KitchenPage() {
  const { storeId, loading: storeLoading } = useStore()
  const { activeStaff } = useStaffMember()
  const navigate = useNavigate()
  const [tables, setTables] = useState([])
  const [pendingItems, setPendingItems] = useState([])
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [showSoundSettings, setShowSoundSettings] = useState(false)
  const [filterGroup, setFilterGroup] = useState('all')
  const prevItemIdsRef = useRef(null)

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

  async function cancelItem(item, table) {
    if (!confirm(`「${item.productNameSnapshot} x${item.quantity}」を削除しますか？\n注文ミス用のキャンセルとして履歴に残します。`)) return
    await cancelKitchenItem({ item, table, activeStaff })
  }

  const filteredPendingItems = useMemo(
    () => filterKitchenItemsByGroup(pendingItems, filterGroup),
    [filterGroup, pendingItems]
  )
  const tableGroups = useMemo(
    () => buildKitchenTableGroups({ tables, pendingItems, filterGroup }),
    [filterGroup, pendingItems, tables]
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
      {showSoundSettings && <KitchenSoundPanel onClose={() => setShowSoundSettings(false)} />}

      {tableGroups.length === 0 ? (
        <KitchenEmptyState />
      ) : (
        <KitchenTableGrid
          groups={tableGroups}
          nowMs={nowMs}
          onCancelItem={cancelItem}
          onMarkAllServed={markKitchenItemsServed}
          onMarkServed={markKitchenItemServed}
        />
      )}
      <StaffBottomNav current="kitchen" />
    </div>
  )
}
