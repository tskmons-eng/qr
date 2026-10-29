import { useState } from 'react'
import { calculateCheckoutTotals } from '../lib/checkoutCalculations'

// 会計の入力（値引き・品ごとの値引き・支払い方法・お預かり）と合計。
// 会計画面と打ち直し（2026-10-30 締め 第2章）で同じものを使い、同じ計算・同じ送り方にする。
// initial は打ち直しのときの前の会計の値（支払い方法・値引き）。
export default function useCheckoutForm({ items, taxRate, initial = null }) {
  const [receivedCash, setReceivedCash] = useState('')
  const [paymentMethod, setPaymentMethod] = useState(initial?.paymentMethod ?? 'cash')
  const [discountType, setDiscountType] = useState(initial?.discountType ?? null)
  const [discountValue, setDiscountValue] = useState(initial?.discountValue ?? '')
  const [discountNote, setDiscountNote] = useState(initial?.discountNote ?? '')
  const [itemDiscounts, setItemDiscounts] = useState(initial?.itemDiscounts ?? {})
  const [discountSheetOpen, setDiscountSheetOpen] = useState(false)
  const [selectedItemId, setSelectedItemId] = useState(null)

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

  // サーバーへ送る値（会計確定・打ち直しで共通）。サーバーは品の記録から計算し直し、違えば断る。
  function buildPayload() {
    return {
      subtotalBeforeItemDiscount: totals.subtotalBeforeItemDiscount,
      itemDiscountAmount: totals.itemDiscountAmount,
      activeItemDiscounts: totals.activeItemDiscounts,
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
    }
  }

  return {
    buildPayload,
    totals,
    // 値引きの窓（CheckoutDiscountSheet）と品ごとの値引きの窓（CheckoutItemDiscountModal）に渡すもの
    discountSheetProps: {
      open: discountSheetOpen,
      discountNote,
      discountType,
      discountValue,
      rows: totals.itemDiscountRows,
      totalDiscountAmount: totals.totalDiscountAmount,
      onClose: () => setDiscountSheetOpen(false),
      onDiscountNoteChange: setDiscountNote,
      onDiscountTypeChange: changeDiscountType,
      onDiscountValueChange: setDiscountValue,
      onSelectItem: setSelectedItemId,
    },
    itemDiscountModalProps: {
      row: selectedItemRow,
      onClose: () => setSelectedItemId(null),
      onUpdate: updateItemDiscount,
    },
    // 右側（スマホは下）の合計〜確定（CheckoutPaymentPanel）に渡すもの。確定・エラー・人数は使う側が足す。
    paymentPanelProps: {
      discountNote,
      discountType,
      discountValue,
      paymentMethod,
      receivedCash,
      taxRate,
      totals,
      onClearCheckoutDiscount: clearCheckoutDiscount,
      onClearItemDiscounts: () => setItemDiscounts({}),
      onOpenDiscount: () => setDiscountSheetOpen(true),
      onPaymentMethodChange: setPaymentMethod,
      onReceivedCashChange: setReceivedCash,
    },
  }
}
