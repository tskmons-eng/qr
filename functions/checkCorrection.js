const { FieldValue, getFirestore } = require('firebase-admin/firestore')
const {
  buildCheckoutCheckPayload,
  buildCheckoutCommandDocId,
  commandError,
  getTokyoDateKey,
  normalizeGuestCount,
  normalizeItemStatus,
} = require('./orderCommandShared')
const { assertStoreAccess } = require('./orderCommandAuth')
const { actorHasPermission } = require('./staffPermission')
const { normalizeTaxRate, recalculateCheckout } = require('./checkoutCalculations')
const { calculateCashCount, summarizeChecksForClosing } = require('./closingSummary')

// 締め：間違えた会計の取り消し・打ち直しと、1日の締め（2026-10-30 締め 第1章）。
// 3つとも「レジ締め」の権限か店長・オーナーだけ。締めた日の会計は直せない（締めの数字が後から変わらないように）。
const VOID_REASON_MAX_LENGTH = 100
const CLOSING_MEMO_MAX_LENGTH = 500
const CLOSING_CASH_MAX = 100000000

const EXPECTED_CHECK_CORRECTION_ERROR_CODES = [
  'register-closed',
  'closing-already-exists',
  'closing-date-changed',
  'void-reason-required',
  'check-not-completed',
]

async function assertCanCloseRegister(db, request, storeId) {
  if (!request.auth) throw commandError('unauthenticated', 'Authentication is required.')
  const actor = await assertStoreAccess(db, request, storeId)
  if (!actorHasPermission(actor, 'closeRegister')) {
    throw commandError('permission-denied', 'Register permission is required.')
  }
  return actor
}

function toDate(timestamp) {
  if (!timestamp) return null
  if (timestamp instanceof Date) return timestamp
  if (typeof timestamp.toDate === 'function') return timestamp.toDate()
  return null
}

function checkBusinessDate(check) {
  const completedAt = toDate(check?.completedAt)
  return completedAt ? getTokyoDateKey(completedAt) : null
}

function buildClosingDocId(storeId, businessDate) {
  return `closing_${String(storeId).replace(/[^a-zA-Z0-9_-]/g, '_')}_${businessDate}`
}

// 締めた日かどうか。新しい締め（決まった名前）と、前からある締め（名前がばらばら）の両方を見る。
async function assertRegisterOpen(transaction, db, storeId, businessDate) {
  if (!businessDate) return
  const closingSnap = await transaction.get(db.collection('cashClosings').doc(buildClosingDocId(storeId, businessDate)))
  if (closingSnap.exists) throw commandError('register-closed', 'This business date is already closed.')
  const legacySnap = await transaction.get(db.collection('cashClosings')
    .where('storeId', '==', storeId)
    .where('businessDate', '==', businessDate)
    .limit(1))
  if (!legacySnap.empty) throw commandError('register-closed', 'This business date is already closed.')
}

async function loadCheckInStore(transaction, db, storeId, checkId) {
  if (!checkId) throw commandError('invalid-argument', 'Check is required.')
  const checkRef = db.collection('checks').doc(String(checkId))
  const checkSnap = await transaction.get(checkRef)
  if (!checkSnap.exists) throw commandError('check-not-found', 'Check was not found.')
  const check = checkSnap.data()
  if (check.storeId !== storeId) throw commandError('check-scope-mismatch', 'Check does not belong to this store.')
  return { checkRef, check }
}

function buildVoidFields({ actor, reason, now, correctedByCheckId = null }) {
  return {
    status: 'voided',
    voidedAt: now,
    voidReason: reason,
    voidedByStaffId: actor?.id ?? null,
    voidedByStaffName: actor?.name ?? null,
    correctedByCheckId,
    updatedAt: now,
  }
}

function buildCheckActionPayload({ storeId, actionType, checkId, actor, note, now, extra = {} }) {
  return {
    storeId,
    actionType,
    targetType: 'check',
    targetId: checkId,
    actorType: 'staff',
    actorStaffId: actor?.id ?? null,
    actorStaffName: actor?.name ?? null,
    note,
    createdAt: now,
    ...extra,
  }
}

function normalizeReason(value) {
  const reason = String(value ?? '').trim().slice(0, VOID_REASON_MAX_LENGTH)
  if (!reason) throw commandError('void-reason-required', 'A reason is required to void a check.')
  return reason
}

// 会計の取り消し。会計を「取り消し」にするだけで、席と注文には触らない。
async function voidCheckCommand(data, request) {
  const { storeId, checkId } = data ?? {}
  if (!storeId) throw commandError('invalid-argument', 'Store is required.')
  const reason = normalizeReason(data?.reason)
  const db = getFirestore()
  const actor = await assertCanCloseRegister(db, request, storeId)
  const actionRef = db.collection('staffActions').doc()
  const now = FieldValue.serverTimestamp()

  return db.runTransaction(async transaction => {
    const { checkRef, check } = await loadCheckInStore(transaction, db, storeId, checkId)
    if (check.status === 'voided' && !check.correctedByCheckId) return { checkId: checkRef.id, status: 'voided' }
    if (check.status !== 'completed') throw commandError('check-not-completed', 'Only completed checks can be voided.')
    await assertRegisterOpen(transaction, db, storeId, checkBusinessDate(check))

    transaction.update(checkRef, buildVoidFields({ actor, reason, now }))
    transaction.set(actionRef, buildCheckActionPayload({
      storeId,
      actionType: 'check_void',
      checkId: checkRef.id,
      actor,
      note: `会計を取り消し ¥${Number(check.total ?? 0).toLocaleString()}（${reason}）`,
      now,
    }))
    return { checkId: checkRef.id, status: 'voided' }
  })
}

function sameSortedIds(left, right) {
  if (left.length !== right.length) return false
  const a = [...left].sort()
  const b = [...right].sort()
  return a.every((value, index) => value === b[index])
}

// 打ち直し。同じ品から、支払い方法・値引き・人数・お預かりを入れ直した新しい会計を作り、前の会計を取り消しにする。
// 品は変えない。会計の日時（completedAt）は前の会計のまま（同じ日の売上として数える）。担当は引き継ぐ。
async function correctCheckCommand(data, request) {
  const { storeId, checkId } = data ?? {}
  const clientRequestId = String(data?.clientRequestId ?? '').trim().slice(0, 120)
  if (!storeId || !clientRequestId) throw commandError('invalid-argument', 'Store and request id are required.')
  const db = getFirestore()
  const actor = await assertCanCloseRegister(db, request, storeId)
  const actionRef = db.collection('staffActions').doc()
  const now = FieldValue.serverTimestamp()

  return db.runTransaction(async transaction => {
    const { checkRef, check } = await loadCheckInStore(transaction, db, storeId, checkId)
    // 同じ打ち直しが2回届いたとき（通信のやり直し）は、1回目の結果を返す。
    if (check.status === 'voided' && check.correctionRequestId === clientRequestId && check.correctedByCheckId) {
      return { checkId: check.correctedByCheckId, previousCheckId: checkRef.id }
    }
    if (check.status !== 'completed') throw commandError('check-not-completed', 'Only completed checks can be corrected.')
    await assertRegisterOpen(transaction, db, storeId, checkBusinessDate(check))

    const orderId = check.orderId
    const orderRef = db.collection('orders').doc(String(orderId ?? ''))
    const orderSnap = orderId ? await transaction.get(orderRef) : null
    const itemsSnap = orderId ? await transaction.get(db.collection('orderItems').where('orderId', '==', orderId)) : null
    const configSnap = await transaction.get(db.collection('storeConfig').doc(storeId))
    const attributionRef = db.collection('salesAttributions').doc(checkRef.id)
    const attributionSnap = await transaction.get(attributionRef)
    if (!orderSnap?.exists || orderSnap.data()?.storeId !== storeId) {
      throw commandError('order-not-found', 'Order for this check was not found.')
    }

    const checkItemIds = Array.isArray(check.checkoutItemIds) ? check.checkoutItemIds : []
    const items = itemsSnap.docs
      .map(itemDoc => ({ id: itemDoc.id, ...itemDoc.data() }))
      .filter(item => checkItemIds.includes(item.id) && normalizeItemStatus(item) !== 'cancelled')
    const itemsSubtotal = items.reduce((sum, item) => sum + (Number(item.lineTotal) || 0), 0)
    if (checkItemIds.length === 0 || !sameSortedIds(items.map(item => item.id), checkItemIds)
      || itemsSubtotal !== Math.round(Number(check.subtotalBeforeItemDiscount ?? itemsSubtotal))) {
      throw commandError('checkout-items-stale', 'Items of this check changed. It cannot be corrected.')
    }

    // 税率は会計した時のものを使う（後から店の設定が変わっても、その日の税額は変えない）。
    const taxRate = check.taxRate === null || check.taxRate === undefined
      ? normalizeTaxRate(configSnap.exists ? configSnap.data()?.taxRate : undefined)
      : normalizeTaxRate(check.taxRate)
    const totals = recalculateCheckout({ items, data, taxRate })

    const correctionNumber = Math.max(0, Number(check.correctionNumber) || 0) + 1
    const newCheckRef = db.collection('checks').doc(`${buildCheckoutCommandDocId({ orderId })}_r${correctionNumber}`)
    const newCheckSnap = await transaction.get(newCheckRef)
    if (newCheckSnap.exists) throw commandError('checkout-already-exists', 'Corrected check already exists.')

    const payload = buildCheckoutCheckPayload({
      storeId,
      tableId: check.tableId,
      tableName: check.tableNameSnapshot ?? null,
      orderId,
      guestCount: normalizeGuestCount(data?.guestCount ?? check.guestCount),
      checkoutItemCount: items.length,
      checkoutItemIds: checkItemIds,
      checkoutSourceSubtotalBeforeItemDiscount: itemsSubtotal,
      orderItemsRevision: check.checkoutOrderItemsRevision,
      discountNote: data?.discountNote,
      ...totals,
      activeStaff: actor,
      timestamp: now,
    })
    transaction.set(newCheckRef, {
      ...payload,
      clientRequestId,
      orderCommandType: 'correct_check',
      completedAt: check.completedAt ?? now,
      correctedAt: now,
      correctionNumber,
      correctsCheckId: checkRef.id,
    })
    transaction.update(checkRef, {
      ...buildVoidFields({ actor, reason: '打ち直し', now, correctedByCheckId: newCheckRef.id }),
      correctionRequestId: clientRequestId,
    })
    transaction.update(orderRef, { checkoutCheckId: newCheckRef.id, updatedAt: now })
    if (attributionSnap.exists) {
      transaction.set(db.collection('salesAttributions').doc(newCheckRef.id), {
        ...attributionSnap.data(),
        checkId: newCheckRef.id,
      })
    }
    transaction.set(actionRef, buildCheckActionPayload({
      storeId,
      actionType: 'check_correct',
      checkId: newCheckRef.id,
      actor,
      note: `会計を打ち直し ¥${Number(check.total ?? 0).toLocaleString()} → ¥${totals.total.toLocaleString()}`,
      now,
      extra: { previousCheckId: checkRef.id },
    }))
    return { checkId: newCheckRef.id, previousCheckId: checkRef.id }
  })
}

function normalizeCashInput(value, { allowEmpty }) {
  if (value === null || value === undefined || value === '') {
    if (allowEmpty) return null
    return 0
  }
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount < 0 || amount > CLOSING_CASH_MAX) {
    throw commandError('invalid-argument', 'Cash amount is invalid.')
  }
  return Math.round(amount)
}

// 1日の締め。その日の会計をサーバーが数え直し、決まった名前で1件だけ書く（同じ日に2回押しても2件にならない）。
async function closeRegisterCommand(data, request) {
  const { storeId } = data ?? {}
  if (!storeId) throw commandError('invalid-argument', 'Store is required.')
  const db = getFirestore()
  const actor = await assertCanCloseRegister(db, request, storeId)
  const businessDate = getTokyoDateKey(new Date())
  // 画面を開いたまま日付が変わったときは、読み込み直してもらう（前の日の数字で今日を締めないように）。
  if (data?.businessDate && data.businessDate !== businessDate) {
    throw commandError('closing-date-changed', 'Business date changed. Reload before closing.')
  }
  const openingCash = normalizeCashInput(data?.openingCash, { allowEmpty: false })
  const countedCash = normalizeCashInput(data?.countedCash, { allowEmpty: true })
  const memo = String(data?.memo ?? '').trim().slice(0, CLOSING_MEMO_MAX_LENGTH)

  const legacySnap = await db.collection('cashClosings')
    .where('storeId', '==', storeId)
    .where('businessDate', '==', businessDate)
    .limit(1)
    .get()
  if (!legacySnap.empty) throw commandError('closing-already-exists', 'This business date is already closed.')

  const checksSnap = await db.collection('checks').where('storeId', '==', storeId).get()
  const checks = checksSnap.docs
    .map(checkDoc => ({ id: checkDoc.id, ...checkDoc.data() }))
    .filter(check => checkBusinessDate(check) === businessDate)
  const summary = summarizeChecksForClosing(checks)
  const cash = calculateCashCount({ cashSales: summary.cashSales, openingCash, countedCash })

  const closingRef = db.collection('cashClosings').doc(buildClosingDocId(storeId, businessDate))
  const now = FieldValue.serverTimestamp()
  const payload = {
    storeId,
    businessDate,
    ...summary,
    ...cash,
    memo,
    closedAt: now,
    closedByUid: request.auth?.uid ?? null,
    closedByEmail: request.auth?.token?.email ?? null,
    closedByStaffId: actor?.id ?? null,
    closedByStaffName: actor?.name ?? null,
    closingVersion: 2,
  }
  try {
    await closingRef.create(payload)
  } catch (error) {
    if (error?.code === 6 || /already exists/i.test(String(error?.message ?? ''))) {
      throw commandError('closing-already-exists', 'This business date is already closed.')
    }
    throw error
  }
  await db.collection('staffActions').add(buildCheckActionPayload({
    storeId,
    actionType: 'register_close',
    checkId: closingRef.id,
    actor,
    note: `${businessDate} の売上を締め ¥${summary.salesTotal.toLocaleString()}`,
    now,
    extra: { targetType: 'cashClosing' },
  }))
  return { closingId: closingRef.id, businessDate, ...summary, ...cash }
}

module.exports = {
  EXPECTED_CHECK_CORRECTION_ERROR_CODES,
  buildClosingDocId,
  closeRegisterCommand,
  correctCheckCommand,
  voidCheckCommand,
}
