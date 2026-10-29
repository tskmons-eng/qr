import { collection, deleteField, doc, getDocs, onSnapshot, query, serverTimestamp, updateDoc, where, writeBatch } from 'firebase/firestore'
import { generateTableQrToken, normalizeTableName } from '../lib/adminTable'
import { db } from '../lib/firebase'
import { buildEmptyTablePendingAggregateFields } from '../lib/tablePending'
import { sortTables } from '../lib/tableOrder'

// 席のQRの文字は、店の人だけが読める tableSecrets に置く（2026-10-29 QR 第2章）。
// 席の記録はお客様も1件ずつ読めるので、そこにQRの文字を置くと、前に座ったお客様が作り直したQRを知れてしまう。
// 移し替えの前の席は、席の記録のQRの文字を使う。
export function subscribeAdminTables(storeId, onChange, onError) {
  let tables = null
  let secrets = new Map()
  const emit = () => {
    if (!tables) return
    onChange(sortTables(tables.map(table => ({ ...table, qrToken: secrets.get(table.id) ?? table.qrToken ?? '' }))))
  }
  const unsubscribeTables = onSnapshot(query(collection(db, 'tables'), where('storeId', '==', storeId)), snap => {
    tables = snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
    emit()
  }, onError)
  const unsubscribeSecrets = onSnapshot(query(collection(db, 'tableSecrets'), where('storeId', '==', storeId)), snap => {
    secrets = new Map(snap.docs.map(docSnap => [docSnap.id, docSnap.data().qrToken]))
    emit()
  }, onError)
  return () => {
    unsubscribeTables()
    unsubscribeSecrets()
  }
}

function setTableSecret(batch, { tableId, storeId, qrToken }) {
  batch.set(doc(db, 'tableSecrets', tableId), { storeId, qrToken, updatedAt: serverTimestamp() })
}

// QRの入口の記録（2026-10-28 QR 第1章）。QRの文字を名前にして、店と席を指す。お客様はこれを1件だけ読める（一覧は読めない）。
function setTableEntry(batch, { qrToken, storeId, tableId }) {
  batch.set(doc(db, 'tableEntries', qrToken), { storeId, tableId, createdAt: serverTimestamp() })
}

// 席を1つ以上まとめて作る（「番号でまとめて追加」も1回の書き込み）。
// 並び順は planTableSortOrders で決めたもの。今ある席に並び順を付ける分も同じ書き込みに入れる。
export async function createAdminTables({ storeId, tableNames, newSortOrders, existingUpdates = [] }) {
  const batch = writeBatch(db)
  existingUpdates.forEach(({ id, sortOrder }) => {
    batch.update(doc(db, 'tables', id), { sortOrder, updatedAt: serverTimestamp() })
  })
  tableNames.forEach((tableName, index) => {
    const tableRef = doc(collection(db, 'tables'))
    const qrToken = generateTableQrToken()
    setTableEntry(batch, { qrToken, storeId, tableId: tableRef.id })
    setTableSecret(batch, { tableId: tableRef.id, storeId, qrToken })
    batch.set(tableRef, {
      storeId,
      tableName: normalizeTableName(tableName),
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

// QRを作り直す：古いQRの入口を消し、新しいQRの入口を作る（古いQRは使えなくなる）。
export async function reissueAdminTableQr(table) {
  const qrToken = generateTableQrToken()
  const batch = writeBatch(db)
  if (table.qrToken) batch.delete(doc(db, 'tableEntries', table.qrToken))
  setTableEntry(batch, { qrToken, storeId: table.storeId, tableId: table.id })
  setTableSecret(batch, { tableId: table.id, storeId: table.storeId, qrToken })
  // 移し替えの前の席に残っているQRの文字は消す（お客様が読める所に置かない）。
  batch.update(doc(db, 'tables', table.id), { qrToken: deleteField(), updatedAt: serverTimestamp() })
  await batch.commit()
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
export async function deleteAdminTable(table) {
  const batch = writeBatch(db)
  if (table.qrToken) batch.delete(doc(db, 'tableEntries', table.qrToken))
  batch.delete(doc(db, 'tableSecrets', table.id))
  batch.delete(doc(db, 'tables', table.id))
  await batch.commit()
}
