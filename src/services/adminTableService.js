import { collection, deleteDoc, doc, getDocs, onSnapshot, query, serverTimestamp, updateDoc, where, writeBatch } from 'firebase/firestore'
import { generateTableQrToken, normalizeTableName } from '../lib/adminTable'
import { db } from '../lib/firebase'
import { buildEmptyTablePendingAggregateFields } from '../lib/tablePending'
import { sortTables } from '../lib/tableOrder'

export function subscribeAdminTables(storeId, onChange, onError) {
  const q = query(collection(db, 'tables'), where('storeId', '==', storeId))
  return onSnapshot(q, snap => {
    onChange(sortTables(snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))))
  }, onError)
}

// 席を1つ以上まとめて作る（「番号でまとめて追加」も1回の書き込み）。
// 並び順は planTableSortOrders で決めたもの。今ある席に並び順を付ける分も同じ書き込みに入れる。
export async function createAdminTables({ storeId, tableNames, newSortOrders, existingUpdates = [] }) {
  const batch = writeBatch(db)
  existingUpdates.forEach(({ id, sortOrder }) => {
    batch.update(doc(db, 'tables', id), { sortOrder, updatedAt: serverTimestamp() })
  })
  tableNames.forEach((tableName, index) => {
    batch.set(doc(collection(db, 'tables')), {
      storeId,
      tableName: normalizeTableName(tableName),
      qrToken: generateTableQrToken(),
      status: 'vacant',
      guestCount: 0,
      currentOrderId: null,
      startedAt: null,
      pendingCount: 0,
      ...buildEmptyTablePendingAggregateFields(),
      sortOrder: newSortOrders[index],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  })
  await batch.commit()
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

export async function batchUpdateTableSortOrder(updates) {
  const batch = writeBatch(db)
  updates.forEach(({ id, sortOrder }) => {
    batch.update(doc(db, 'tables', id), { sortOrder, updatedAt: serverTimestamp() })
  })
  await batch.commit()
}

// この席を指している、今日以降の予約（来店前のもの）。消す前に席を変えてもらうために数える。
export async function loadUpcomingReservationsForTable({ storeId, tableId, today }) {
  const snap = await getDocs(query(
    collection(db, 'reservations'),
    where('storeId', '==', storeId),
    where('tableId', '==', tableId),
    where('status', '==', 'confirmed'),
  ))
  return snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })).filter(reservation => String(reservation.date ?? '') >= today)
}

// 空いている席だけ消せる（firestore.rules でも止める）。履歴・売上の画面は席の名前を使っていないので、記録は壊れない。
export function deleteAdminTable(tableId) {
  return deleteDoc(doc(db, 'tables', tableId))
}
