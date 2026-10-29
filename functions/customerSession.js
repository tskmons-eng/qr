const { FieldValue, getFirestore } = require('firebase-admin/firestore')
const { warn } = require('firebase-functions/logger')
const { commandError } = require('./orderCommandShared')

// 「この端末はこの注文」の記録（2026-10-29 QR 第2章）。お客様の端末は見えないログイン（匿名）をしていて、
// その uid ごとに今の注文を1件だけ覚える。注文の品は、店の人と、この記録がその注文を指すお客様だけが読める（firestore.rules）。
// 書くのは Functions だけ。QRから入れる人（席の今の注文を知っている人）だけが記録できる。
const CUSTOMER_SESSION_COLLECTION = 'customerSessions'

// 着席・注文のあとに書く。書けなくても着席・注文は成功のまま返す（読めない分は join で取り戻せる）。
async function recordCustomerSession(db, request, { storeId, tableId, orderId }) {
  const uid = request?.auth?.uid
  if (!uid || !orderId) return
  try {
    await db.collection(CUSTOMER_SESSION_COLLECTION).doc(uid).set({
      storeId,
      tableId,
      orderId,
      updatedAt: FieldValue.serverTimestamp(),
    })
  } catch (error) {
    warn('Customer session record failed.', { event: 'customer_session_record_failed', orderId, message: error?.message })
  }
}

// 席の今の注文に、この端末を加える（2台目のスマホ・読み込み直し）。席の今の注文と一致するときだけ。
async function joinCustomerOrder({ storeId, tableId, orderId, qrToken }, request) {
  if (!storeId || !tableId || !orderId || !qrToken) throw commandError('invalid-argument', 'Store, table, order, and QR are required.')
  if (!request?.auth?.uid) throw commandError('unauthenticated', 'Sign-in is required.')
  const db = getFirestore()
  const entrySnap = await db.collection('tableEntries').doc(String(qrToken)).get()
  if (!entrySnap.exists || entrySnap.data().tableId !== tableId) throw commandError('table-not-found', 'QR is no longer valid.')
  const tableSnap = await db.collection('tables').doc(tableId).get()
  const table = tableSnap.exists ? tableSnap.data() : null
  if (!table || table.storeId !== storeId) throw commandError('table-not-found', 'Table was not found.')
  if (table.currentOrderId !== orderId) throw commandError('table-order-mismatch', 'Table is not linked to this order.')
  await recordCustomerSession(db, request, { storeId, tableId, orderId })
  return { ok: true }
}

module.exports = {
  CUSTOMER_SESSION_COLLECTION,
  joinCustomerOrder,
  recordCustomerSession,
}
