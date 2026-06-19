import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useStore } from '../../contexts/StoreContext'
import { useStaffMember } from '../../contexts/StaffMemberContext'
import StaffBottomNav from '../../components/StaffBottomNav'
import OrderCommandErrorNotice from '../../components/OrderCommandErrorNotice'
import TableActionBar from '../../components/staff/TableActionBar'
import TableCancelModal from '../../components/staff/TableCancelModal'
import TableDetailHeader from '../../components/staff/TableDetailHeader'
import TableMoveModal from '../../components/staff/TableMoveModal'
import TableOrderSection from '../../components/staff/TableOrderSection'
import TableOrderSummary from '../../components/staff/TableOrderSummary'
import TableSeatingPanel from '../../components/staff/TableSeatingPanel'
import { formatOrderCommandError, logOrderCommandError } from '../../lib/orderCommandErrors'
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
  const [actionError, setActionError] = useState('')

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
  const [seatError, setSeatError] = useState('')

  // 人数調整
  const [editingGuests, setEditingGuests] = useState(false)
  const [guestInput, setGuestInput] = useState('')

  // 席移動モーダル
  const [showMoveModal, setShowMoveModal] = useState(false)
  const [vacantTables, setVacantTables] = useState([])
  const [moving, setMoving] = useState(false)
  const [moveError, setMoveError] = useState('')

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
    setActionError('')
    try {
      await markOrderItemServed({ tableId, itemId: item.id })
    } catch (error) {
      const formatted = formatOrderCommandError(error, { context: 'itemAction' })
      setActionError(formatted.message)
      logOrderCommandError({
        operation: 'staff_table_mark_served',
        error,
        metadata: { tableId, itemId: item.id },
      })
    }
  }

  async function markOrdered(item) {
    setActionError('')
    try {
      await markOrderItemOrdered({ tableId, itemId: item.id })
    } catch (error) {
      const formatted = formatOrderCommandError(error, { context: 'itemAction' })
      setActionError(formatted.message)
      logOrderCommandError({
        operation: 'staff_table_mark_ordered',
        error,
        metadata: { tableId, itemId: item.id },
      })
    }
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
    } catch (error) {
      const formatted = formatOrderCommandError(error, { context: 'itemAction' })
      setPasscodeError(formatted.message)
      logOrderCommandError({
        operation: 'staff_table_cancel_item',
        error,
        metadata: { tableId, itemId: cancelTarget.id },
      })
    } finally {
      setCancelling(false)
    }
  }

  // 着席
  async function handleSeat() {
    if (seating) return
    setSeating(true)
    setSeatError('')
    try {
      await seatGuestsAtTable({ table, tableId, seatCount, activeStaff })
    } catch (error) {
      const formatted = formatOrderCommandError(error, { context: 'staffSeat' })
      setSeatError(formatted.message)
      logOrderCommandError({
        operation: 'staff_seat_guests',
        error,
        metadata: { storeId, tableId, seatCount },
      })
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
    setMoveError('')
    setShowMoveModal(true)
  }

  async function handleMove(targetTable) {
    if (moving) return
    setMoving(true)
    setMoveError('')
    try {
      await moveTableOrder({ sourceTable: table, sourceTableId: tableId, targetTable, activeStaff })
      navigate(`/staff/table/${targetTable.id}`, { replace: true })
    } catch (error) {
      const formatted = formatOrderCommandError(error, { context: 'tableMove' })
      setMoveError(formatted.message)
      logOrderCommandError({
        operation: 'staff_move_table_order',
        error,
        metadata: { storeId, sourceTableId: tableId, targetTableId: targetTable.id },
      })
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
        errorMessage={moveError}
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
      <OrderCommandErrorNotice message={actionError} className="staff-table-command-error" />

      {!hasOrder ? (
        <TableSeatingPanel
          errorMessage={seatError}
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
