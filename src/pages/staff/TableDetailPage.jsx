import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useStore } from '../../contexts/StoreContext'
import { useStaffMember } from '../../contexts/StaffMemberContext'
import StaffBottomNav from '../../components/StaffBottomNav'
import TableActionBar from '../../components/staff/TableActionBar'
import TableCancelModal from '../../components/staff/TableCancelModal'
import TableDetailHeader from '../../components/staff/TableDetailHeader'
import TableMoveModal from '../../components/staff/TableMoveModal'
import TableOrderSection from '../../components/staff/TableOrderSection'
import TableOrderSummary from '../../components/staff/TableOrderSummary'
import TableSeatingPanel from '../../components/staff/TableSeatingPanel'
import { hasStaffPermission } from '../../lib/staffPermissions'
import { calculateTableOrderTotal, splitTableOrderItems, stepGuestInputValue } from '../../lib/staffTableDetail'
import {
  cancelOrderItem,
  loadVacantTables,
  markOrderItemOrdered,
  markOrderItemServed,
  moveTableOrder,
  seatGuestsAtTable,
  subscribeStaffTable,
  subscribeStaffTableOrderItems,
  updateTableGuestCount,
} from '../../services/staffTableService'
import { loadStoreConfig } from '../../services/settingsService'

export default function TableDetailPage() {
  const { tableId } = useParams()
  const navigate = useNavigate()
  const { storeId } = useStore()
  const { activeStaff } = useStaffMember()
  const [table, setTable] = useState(null)
  const [items, setItems] = useState([])
  const [storeConfig, setStoreConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(id)
  }, [])

  // キャンセルモーダル
  const [cancelTarget, setCancelTarget] = useState(null)
  const [passcode, setPasscode] = useState('')
  const [passcodeError, setPasscodeError] = useState('')
  const [cancelling, setCancelling] = useState(false)

  // 着席
  const [seatCount, setSeatCount] = useState(2)
  const [seating, setSeating] = useState(false)

  // 人数調整
  const [editingGuests, setEditingGuests] = useState(false)
  const [guestInput, setGuestInput] = useState('')

  // 席移動モーダル
  const [showMoveModal, setShowMoveModal] = useState(false)
  const [vacantTables, setVacantTables] = useState([])
  const [moving, setMoving] = useState(false)

  useEffect(() => {
    const unsub = subscribeStaffTable(tableId, nextTable => {
      setTable(nextTable)
      setLoading(false)
    })
    return unsub
  }, [tableId])

  useEffect(() => {
    if (!table?.currentOrderId) { setItems([]); return }
    return subscribeStaffTableOrderItems(table.currentOrderId, setItems)
  }, [table?.currentOrderId])

  useEffect(() => {
    if (!storeId) return
    loadStoreConfig(storeId).then(setStoreConfig)
  }, [storeId])

  async function markServed(item) {
    await markOrderItemServed({ tableId, itemId: item.id })
  }

  async function markOrdered(item) {
    await markOrderItemOrdered({ tableId, itemId: item.id })
  }

  function openCancel(item) {
    setCancelTarget(item)
    setPasscode('')
    setPasscodeError('')
  }

  async function handleCancel() {
    if (!cancelTarget || cancelling) return
    setCancelling(true)
    setPasscodeError('')
    try {
      const result = await cancelOrderItem({ table, tableId, item: cancelTarget, passcode, activeStaff })
      if (result.reason === 'invalid-passcode') {
        setPasscodeError('パスコードが違います')
        setCancelling(false)
        return
      }
      setCancelTarget(null)
    } catch {
      setPasscodeError('エラーが発生しました')
    } finally {
      setCancelling(false)
    }
  }

  // 着席
  async function handleSeat() {
    if (seating) return
    setSeating(true)
    try {
      await seatGuestsAtTable({ table, tableId, seatCount, activeStaff })
    } catch {
      alert('エラーが発生しました')
    } finally {
      setSeating(false)
    }
  }

  // 人数変更
  function startEditGuests() {
    setGuestInput(String(table.guestCount ?? 0))
    setEditingGuests(true)
  }

  function stepGuestInput(delta) {
    setGuestInput(value => stepGuestInputValue(value, delta))
  }

  async function saveGuests() {
    const n = parseInt(guestInput, 10)
    if (isNaN(n) || n < 0) { setEditingGuests(false); return }
    await updateTableGuestCount({ table, tableId, guestCount: n, activeStaff })
    setEditingGuests(false)
  }

  // 席移動
  async function openMoveModal() {
    setVacantTables(await loadVacantTables({ storeId, currentTableId: tableId }))
    setShowMoveModal(true)
  }

  async function handleMove(targetTable) {
    if (moving) return
    setMoving(true)
    try {
      await moveTableOrder({ sourceTable: table, sourceTableId: tableId, targetTable, activeStaff })
      navigate(`/staff/table/${targetTable.id}`, { replace: true })
    } catch {
      alert('移動に失敗しました')
      setMoving(false)
    }
  }

  if (loading) return <div className="staff-table-loading">読み込み中...</div>
  if (!table) return <div className="staff-table-not-found">席が見つかりません</div>

  const { orderedItems, servedItems } = splitTableOrderItems(items)
  const total = calculateTableOrderTotal(items)
  const hasOrder = !!table.currentOrderId
  const guestCount = table.guestCount ?? 0
  const servedWorkflowEnabled = storeConfig?.servedWorkflowEnabled !== false
  const cancelPasscodeRequired = !hasStaffPermission(activeStaff, 'manageMenu', { useKitchen: true, closeRegister: false, manageMenu: false })

  return (
    <div className="staff-table-page">
      <TableCancelModal
        item={cancelTarget}
        passcodeRequired={cancelPasscodeRequired}
        passcode={passcode}
        passcodeError={passcodeError}
        cancelling={cancelling}
        onPasscodeChange={setPasscode}
        onConfirm={handleCancel}
        onClose={() => setCancelTarget(null)}
      />
      <TableMoveModal
        open={showMoveModal}
        vacantTables={vacantTables}
        moving={moving}
        onMove={handleMove}
        onClose={() => setShowMoveModal(false)}
      />
      <TableDetailHeader
        tableName={table.tableName}
        hasOrder={hasOrder}
        guestCount={guestCount}
        startedAtSeconds={table.startedAt?.seconds}
        nowMs={now}
        editingGuests={editingGuests}
        guestInput={guestInput}
        onBack={() => navigate('/staff')}
        onStartEditGuests={startEditGuests}
        onGuestInputChange={setGuestInput}
        onGuestStep={stepGuestInput}
        onSaveGuests={saveGuests}
        onCancelEditGuests={() => setEditingGuests(false)}
      />

      {!hasOrder ? (
        <TableSeatingPanel
          seatCount={seatCount}
          seating={seating}
          onSeatCountChange={setSeatCount}
          onSeat={handleSeat}
        />
      ) : (
        <>
          <TableOrderSection
            title={servedWorkflowEnabled ? '準備中' : '注文'}
            items={servedWorkflowEnabled ? orderedItems : items}
            served={false}
            servedWorkflowEnabled={servedWorkflowEnabled}
            onMarkServed={markServed}
            onMarkOrdered={markOrdered}
            onCancel={openCancel}
          />
          {servedWorkflowEnabled && (
            <TableOrderSection
              title="提供済み"
              items={servedItems}
              served
              servedWorkflowEnabled={servedWorkflowEnabled}
              onMarkServed={markServed}
              onMarkOrdered={markOrdered}
              onCancel={openCancel}
            />
          )}
          <TableOrderSummary total={total} guestCount={guestCount} />
        </>
      )}

      <TableActionBar
        hasOrder={hasOrder}
        onEditGuests={startEditGuests}
        onMove={openMoveModal}
        onAddOrder={() => navigate(`/staff/table/${tableId}/add-order`, { state: { orderId: table.currentOrderId, storeId: table.storeId, guestCount: table.guestCount } })}
      />
      <StaffBottomNav
        current="seat"
        tableId={tableId}
        orderId={table.currentOrderId}
        storeId={table.storeId}
        guestCount={table.guestCount}
        pendingCount={orderedItems.length}
      />
    </div>
  )
}
