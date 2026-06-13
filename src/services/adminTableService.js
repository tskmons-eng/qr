import { addDoc, collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { generateTableQrToken, normalizeTableName } from '../lib/adminTable'
import { db } from '../lib/firebase'
import { buildEmptyTablePendingAggregateFields } from '../lib/tablePending'

export function subscribeAdminTables(storeId, onChange) {
  const q = query(collection(db, 'tables'), where('storeId', '==', storeId))
  return onSnapshot(q, snap => {
    const tables = snap.docs
      .map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
      .sort((a, b) => (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0))

    onChange(tables)
  })
}

export function createAdminTable({ storeId, tableName }) {
  return addDoc(collection(db, 'tables'), {
    storeId,
    tableName: normalizeTableName(tableName),
    qrToken: generateTableQrToken(),
    status: 'vacant',
    guestCount: 0,
    currentOrderId: null,
    startedAt: null,
    pendingCount: 0,
    ...buildEmptyTablePendingAggregateFields(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export function reissueAdminTableQr(tableId) {
  return updateDoc(doc(db, 'tables', tableId), {
    qrToken: generateTableQrToken(),
    updatedAt: serverTimestamp(),
  })
}

export function renameAdminTable(tableId, tableName) {
  return updateDoc(doc(db, 'tables', tableId), {
    tableName: normalizeTableName(tableName),
    updatedAt: serverTimestamp(),
  })
}
