import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import StaffBottomNav from '../../components/StaffBottomNav'
import CheckoutCompleteScreen from '../../components/staff/CheckoutCompleteScreen'
import CheckoutConfirmBar from '../../components/staff/CheckoutConfirmBar'
import CheckoutGuestCountPanel from '../../components/staff/CheckoutGuestCountPanel'
import CheckoutHeader from '../../components/staff/CheckoutHeader'
import CheckoutItemDiscountList from '../../components/staff/CheckoutItemDiscountList'
import CheckoutItemDiscountModal from '../../components/staff/CheckoutItemDiscountModal'
import CheckoutPaymentPanel from '../../components/staff/CheckoutPaymentPanel'
import { useStaffMember } from '../../contexts/StaffMemberContext'
import { calculateCheckoutTotals } from '../../lib/checkoutCalculations'
import { formatOrderCommandError, logOrderCommandError } from '../../lib/orderCommandErrors'
import { stepGuestInputValue } from '../../lib/staffTableDetail'
import { completeCashCheckout, subscribeCheckoutData } from '../../services/checkoutService'
import { subscribeStaffTable, updateTableGuestCount } from '../../services/staffTableService'

export default function CheckoutPage() {
  const { tableId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { orderId, storeId, guestCount } = location.state || {}
  const { activeStaff } = useStaffMember()
  const [table, setTable] = useState(null)
  const [items, setItems] = useState([])
  const [orderItemsRevision, setOrderItemsRevision] = useState(0)
  const [taxRate, setTaxRate] = useState(0)
  const [receivedCash, setReceivedCash] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [completedChange, setCompletedChange] = useState(null)
  const [discountType, setDiscountType] = useState(null)
  const [discountValue, setDiscountValue] = useState('')
  const [discountNote, setDiscountNote] = useState('')
  const [itemDiscounts, setItemDiscounts] = useState({})
  const [selectedItemId, setSelectedItemId] = useState(null)
  const [editingGuests, setEditingGuests] = useState(false)
  const [guestInput, setGuestInput] = useState('')
  const [checkoutError, setCheckoutError] = useState('')
  const [itemsChanged, setItemsChanged] = useState(false)
  const itemsSignatureRef = useRef(null)

  // 品を見続ける。会計の途中で品が変わったら知らせ、入れた値引きとお預かりは残したまま合計だけ直す（2026-10-29 レジ 第1章）。
  useEffect(() => {
    if (!orderId || !storeId) return undefined
    itemsSignatureRef.current = null
    return subscribeCheckoutData({ orderId, storeId }, data => {
      // 比べるのはサーバーから届いた品どうしだけ（開いた直後の端末の控えからの切り替わりでは知らせない）。
      if (data.itemsFromServer) {
        const signature = data.items.map(item => `${item.id}:${item.lineTotal}`).sort().join('|')
        if (itemsSignatureRef.current !== null && itemsSignatureRef.current !== signature) setItemsChanged(true)
        itemsSignatureRef.current = signature
      }
      setItems(data.items)
      setOrderItemsRevision(data.orderItemsRevision)
      setTaxRate(data.taxRate)
      setLoading(false)
    }, error => {
      logOrderCommandError({ operation: 'subscribe_checkout_items', error, metadata: { storeId, tableId, orderId } })
      setCheckoutError('注文の品を読み込めませんでした。通信を確かめて、画面を読み込み直してください。')
      setLoading(false)
    })
  }, [orderId, storeId, tableId])

  useEffect(() => {
    return subscribeStaffTable(tableId, setTable)
  }, [tableId])

  function updateItemDiscount(itemId, patch) {
    setItemDiscounts(prev => ({
      ...prev,
      [itemId]: { type: 'amount', value: '', note: '', ...(prev[itemId] ?? {}), ...patch },
    }))
  }

  function changeDiscountType(nextType) {
    setDiscountType(nextType)
    setDiscountValue('')
  }

  const totals = calculateCheckoutTotals({
    items,
    itemDiscounts,
    discountType,
    discountValue,
    taxRate,
    receivedCash,
  })
  const selectedItemRow = totals.itemDiscountRows.find(row => row.item.id === selectedItemId)
  const currentGuestCount = table?.guestCount ?? guestCount ?? 0

  function startEditGuests() {
    setGuestInput(String(currentGuestCount))
    setEditingGuests(true)
  }

  function stepGuestInput(delta) {
    setGuestInput(value => stepGuestInputValue(value, delta))
  }

  async function saveGuests() {
    const nextGuestCount = parseInt(guestInput, 10)
    if (Number.isNaN(nextGuestCount) || nextGuestCount < 0 || !table) {
      setEditingGuests(false)
      return
    }
    await updateTableGuestCount({ table, tableId, guestCount: nextGuestCount, activeStaff })
    setEditingGuests(false)
  }

  async function handleConfirm() {
    if (totals.change === null || submitting) return
    setSubmitting(true)
    setCheckoutError('')
    setItemsChanged(false)
    try {
      await completeCashCheckout({
        storeId,
        tableId,
        orderId,
        guestCount: currentGuestCount,
        subtotalBeforeItemDiscount: totals.subtotalBeforeItemDiscount,
        itemDiscountAmount: totals.itemDiscountAmount,
        activeItemDiscounts: totals.activeItemDiscounts,
        checkoutItemIds: items.map(item => item.id),
        orderItemsRevision,
        subtotal: totals.subtotal,
        checkoutDiscountType: discountType,
        checkoutDiscountValue: discountValue,
        checkoutDiscountAmount: totals.discountAmount,
        totalDiscountAmount: totals.totalDiscountAmount,
        discountNote: discountNote.trim() || null,
        total: totals.total,
        paymentMethod: 'cash',
        received: totals.received,
        change: totals.change,
        activeStaff,
      })
      setCompletedChange(totals.change)
    } catch (error) {
      // 品が変わって断られたときも、品は見続けているので画面はもう新しい合計になっている。入れた値引き・お預かりは残す。
      const formatted = formatOrderCommandError(error, { context: 'checkout' })
      setCheckoutError(formatted.message)
      logOrderCommandError({
        operation: 'complete_checkout',
        error,
        metadata: { storeId, tableId, orderId, total: totals.total },
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (completedChange !== null) {
    return (
      <CheckoutCompleteScreen
        change={completedChange}
        onBackToTables={() => navigate('/staff', { replace: true })}
      />
    )
  }

  if (loading) return <div className="checkout-loading">読み込み中...</div>

  return (
    <div className="checkout-page">
      <CheckoutItemDiscountModal
        row={selectedItemRow}
        onClose={() => setSelectedItemId(null)}
        onUpdate={updateItemDiscount}
      />
      <CheckoutHeader activeStaff={activeStaff} onBack={() => navigate(-1)} />
      <div className="checkout-page__body">
        <CheckoutGuestCountPanel
          editing={editingGuests}
          guestCount={currentGuestCount}
          guestInput={guestInput}
          onCancel={() => setEditingGuests(false)}
          onChange={setGuestInput}
          onEdit={startEditGuests}
          onSave={saveGuests}
          onStep={stepGuestInput}
        />
        {itemsChanged && (
          <div className="checkout-page__notice" role="status">
            会計の途中で注文の品が変わりました。合計を直したので、金額を確かめてください。
          </div>
        )}
        <div className="checkout-page__items-scroll">
          <CheckoutItemDiscountList
            rows={totals.itemDiscountRows}
            onSelect={setSelectedItemId}
          />
        </div>
        <div className="checkout-page__payment">
          <CheckoutPaymentPanel
            subtotalBeforeItemDiscount={totals.subtotalBeforeItemDiscount}
            itemDiscountAmount={totals.itemDiscountAmount}
            discountType={discountType}
            discountValue={discountValue}
            discountNote={discountNote}
            discountAmount={totals.discountAmount}
            total={totals.total}
            taxAmount={totals.taxAmount}
            taxRate={taxRate}
            onDiscountTypeChange={changeDiscountType}
            onDiscountValueChange={setDiscountValue}
            onDiscountNoteChange={setDiscountNote}
          />
        </div>
      </div>
      <CheckoutConfirmBar
        change={totals.change}
        disabled={totals.change === null}
        errorMessage={checkoutError}
        onReceivedCashChange={setReceivedCash}
        received={totals.received}
        receivedCash={receivedCash}
        submitting={submitting}
        total={totals.total}
        onConfirm={handleConfirm}
      />
      <StaffBottomNav
        current="checkout"
        tableId={tableId}
        orderId={orderId}
        storeId={storeId}
        guestCount={currentGuestCount}
      />
    </div>
  )
}
