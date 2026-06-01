import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import StaffBottomNav from '../../components/StaffBottomNav'
import CheckoutCompleteScreen from '../../components/staff/CheckoutCompleteScreen'
import CheckoutConfirmBar from '../../components/staff/CheckoutConfirmBar'
import CheckoutHeader from '../../components/staff/CheckoutHeader'
import CheckoutItemDiscountList from '../../components/staff/CheckoutItemDiscountList'
import CheckoutItemDiscountModal from '../../components/staff/CheckoutItemDiscountModal'
import CheckoutPaymentPanel from '../../components/staff/CheckoutPaymentPanel'
import { useStaffMember } from '../../contexts/StaffMemberContext'
import { calculateCheckoutTotals } from '../../lib/checkoutCalculations'
import { completeCashCheckout, loadCheckoutData } from '../../services/checkoutService'

export default function CheckoutPage() {
  const { tableId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { orderId, storeId, guestCount } = location.state || {}
  const { activeStaff } = useStaffMember()
  const [items, setItems] = useState([])
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

  useEffect(() => {
    if (!orderId) return
    let cancelled = false

    async function load() {
      const data = await loadCheckoutData({ orderId, storeId })
      if (cancelled) return
      setItems(data.items)
      setTaxRate(data.taxRate)
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [orderId, storeId])

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

  async function handleConfirm() {
    if (totals.change === null || submitting) return
    setSubmitting(true)
    try {
      await completeCashCheckout({
        storeId,
        tableId,
        orderId,
        guestCount,
        subtotalBeforeItemDiscount: totals.subtotalBeforeItemDiscount,
        itemDiscountAmount: totals.itemDiscountAmount,
        activeItemDiscounts: totals.activeItemDiscounts,
        subtotal: totals.subtotal,
        checkoutDiscountAmount: totals.discountAmount,
        totalDiscountAmount: totals.totalDiscountAmount,
        discountNote: discountNote.trim() || null,
        total: totals.total,
        received: totals.received,
        change: totals.change,
        activeStaff,
      })
      setCompletedChange(totals.change)
    } catch {
      alert('エラーが発生しました。もう一度試してください。')
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
      <CheckoutItemDiscountList
        rows={totals.itemDiscountRows}
        onSelect={setSelectedItemId}
      />
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
        receivedCash={receivedCash}
        received={totals.received}
        change={totals.change}
        onDiscountTypeChange={changeDiscountType}
        onDiscountValueChange={setDiscountValue}
        onDiscountNoteChange={setDiscountNote}
        onReceivedCashChange={setReceivedCash}
      />
      <CheckoutConfirmBar
        disabled={totals.change === null}
        submitting={submitting}
        onConfirm={handleConfirm}
      />
      <StaffBottomNav
        current="checkout"
        tableId={tableId}
        orderId={orderId}
        storeId={storeId}
        guestCount={guestCount}
      />
    </div>
  )
}
