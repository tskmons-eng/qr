import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import StaffBottomNav from '../../components/StaffBottomNav'
import CheckoutCompleteScreen from '../../components/staff/CheckoutCompleteScreen'
import CheckoutDiscountSheet from '../../components/staff/CheckoutDiscountSheet'
import CheckoutGuestCountPanel from '../../components/staff/CheckoutGuestCountPanel'
import CheckoutHeader from '../../components/staff/CheckoutHeader'
import CheckoutItemDiscountModal from '../../components/staff/CheckoutItemDiscountModal'
import CheckoutItemList from '../../components/staff/CheckoutItemList'
import CheckoutPaymentPanel from '../../components/staff/CheckoutPaymentPanel'
import { useStaffMember } from '../../contexts/StaffMemberContext'
import { calculateCheckoutTotals } from '../../lib/checkoutCalculations'
import { formatOrderCommandError, logOrderCommandError } from '../../lib/orderCommandErrors'
import { stepGuestInputValue } from '../../lib/staffTableDetail'
import { completeCheckout, subscribeCheckoutData } from '../../services/checkoutService'
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
  const [completed, setCompleted] = useState(null)
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [discountSheetOpen, setDiscountSheetOpen] = useState(false)
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
    if (nextType === discountType) return
    setDiscountType(nextType)
    setDiscountValue('')
    // 「なし」にしたら理由も消す（値引きの無い会計に理由だけが残らないように）。
    if (!nextType) setDiscountNote('')
  }

  function clearCheckoutDiscount() {
    setDiscountType(null)
    setDiscountValue('')
    setDiscountNote('')
  }

  const totals = calculateCheckoutTotals({
    items,
    itemDiscounts,
    discountType,
    discountValue,
    taxRate,
    receivedCash,
    paymentMethod,
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
      await completeCheckout({
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
        paymentMethod,
        received: totals.received,
        change: totals.change,
        activeStaff,
      })
      setCompleted({ change: totals.change, paymentMethod, total: totals.total })
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

  if (completed !== null) {
    return (
      <CheckoutCompleteScreen
        change={completed.change}
        paymentMethod={completed.paymentMethod}
        total={completed.total}
        onBackToTables={() => navigate('/staff', { replace: true })}
      />
    )
  }

  if (loading) return <div className="checkout-loading">読み込み中...</div>

  return (
    <div className="checkout-page">
      <CheckoutDiscountSheet
        open={discountSheetOpen}
        discountNote={discountNote}
        discountType={discountType}
        discountValue={discountValue}
        rows={totals.itemDiscountRows}
        totalDiscountAmount={totals.totalDiscountAmount}
        onClose={() => setDiscountSheetOpen(false)}
        onDiscountNoteChange={setDiscountNote}
        onDiscountTypeChange={changeDiscountType}
        onDiscountValueChange={setDiscountValue}
        onSelectItem={setSelectedItemId}
      />
      <CheckoutItemDiscountModal
        row={selectedItemRow}
        onClose={() => setSelectedItemId(null)}
        onUpdate={updateItemDiscount}
      />
      <CheckoutHeader
        activeStaff={activeStaff}
        guestCount={currentGuestCount}
        tableName={table?.tableName}
        onBack={() => navigate(-1)}
        onEditGuests={startEditGuests}
      />
      {/* タブレットは左に品・右に合計〜確定、スマホは品を上でスクロールし合計〜確定を下に固定（2026-10-29 レジ 第2章） */}
      <div className="checkout-page__body">
        <div className="checkout-page__items-scroll">
          {editingGuests && (
            <CheckoutGuestCountPanel
              guestInput={guestInput}
              onCancel={() => setEditingGuests(false)}
              onChange={setGuestInput}
              onSave={saveGuests}
              onStep={stepGuestInput}
            />
          )}
          {itemsChanged && (
            <div className="checkout-page__notice" role="status">
              会計の途中で注文の品が変わりました。合計を直したので、金額を確かめてください。
            </div>
          )}
          <CheckoutItemList rows={totals.itemDiscountRows} />
        </div>
        <div className="checkout-page__payment">
          <CheckoutPaymentPanel
            discountNote={discountNote}
            discountType={discountType}
            discountValue={discountValue}
            errorMessage={checkoutError}
            guestCount={currentGuestCount}
            paymentMethod={paymentMethod}
            receivedCash={receivedCash}
            submitting={submitting}
            taxRate={taxRate}
            totals={totals}
            onClearCheckoutDiscount={clearCheckoutDiscount}
            onClearItemDiscounts={() => setItemDiscounts({})}
            onConfirm={handleConfirm}
            onOpenDiscount={() => setDiscountSheetOpen(true)}
            onPaymentMethodChange={setPaymentMethod}
            onReceivedCashChange={setReceivedCash}
          />
        </div>
      </div>
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
