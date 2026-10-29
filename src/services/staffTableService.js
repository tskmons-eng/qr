import { addDoc, collection, doc, getDocs, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'
import { sortTables } from '../lib/tableOrder'
import { filterVisibleOrderItems, sortOrderItemsByOrderedAt } from '../lib/staffTableDetail'
import { seatStaffOrderSession } from './orderCommandService'
import {
  cancelOrderItemWithPasscode,
  markOrderItemOrderedCommand,
  markOrderItemServedCommand,
} from './orderItemCommandService'
import { moveTableOrderCommand } from './tableMoveCommandService'

function mapDocs(snapshot) {
  return snapshot.docs.map(docSnapshot => ({ id: docSnapshot.id, ...docSnapshot.data() }))
}

export function subscribeStaffTable(tableId, onNext) {
  return onSnapshot(doc(db, 'tables', tableId), snap => {
    onNext(snap.exists() ? { id: snap.id, ...snap.data() } : null)
  })
}

// 店で絞って読む（注文の品は店の人とその注文のお客様だけが読める決まり。2026-10-29 QR 第2章）。
export function subscribeStaffTableOrderItems(orderId, storeId, onNext) {
  const orderItemsQuery = query(collection(db, 'orderItems'), where('storeId', '==', storeId), where('orderId', '==', orderId))
  return onSnapshot(orderItemsQuery, snap => {
    onNext(sortOrderItemsByOrderedAt(filterVisibleOrderItems(mapDocs(snap))))
  })
}

export function markOrderItemServed({ tableId, itemId }) {
  return markOrderItemServedCommand({ tableId, itemId })
}

export function markOrderItemOrdered({ tableId, itemId }) {
  return markOrderItemOrderedCommand({ tableId, itemId })
}

// パスコードの照合と権限の確認はサーバー（cancelOrderItemCommand）で行う。
export function cancelOrderItem({ table, tableId, item, passcode, activeStaff }) {
  return cancelOrderItemWithPasscode({
    itemId: item.id,
    tableId,
    tableName: table.tableName,
    source: 'staff_table',
    activeStaff,
    actorUid: auth.currentUser?.uid ?? null,
    passcode,
  })
}

export function seatGuestsAtTable({ table, tableId, seatCount, activeStaff }) {
  return seatStaffOrderSession({ table, tableId, seatCount, activeStaff })
}

export async function updateTableGuestCount({ table, tableId, guestCount, activeStaff }) {
  await updateDoc(doc(db, 'tables', tableId), { guestCount, updatedAt: serverTimestamp() })
  await addDoc(collection(db, 'staffActions'), {
    storeId: table.storeId,
    actionType: 'adjust_guests',
    targetType: 'table',
    targetId: tableId,
    actorType: 'staff',
    actorStaffId: activeStaff?.id ?? null,
    actorStaffName: activeStaff?.name ?? null,
    note: `人数変更 ${table.guestCount}名 → ${guestCount}名`,
    createdAt: serverTimestamp(),
  })
}

export async function loadVacantTables({ storeId, currentTableId }) {
  const snap = await getDocs(query(collection(db, 'tables'), where('storeId', '==', storeId), where('status', '==', 'vacant')))
  return sortTables(snap.docs
    .map(docSnapshot => ({ id: docSnapshot.id, ...docSnapshot.data() }))
    .filter(table => table.id !== currentTableId))
}

export async function moveTableOrder({ sourceTable, sourceTableId, targetTable, activeStaff }) {
  return moveTableOrderCommand({ sourceTable, sourceTableId, targetTable, activeStaff })
}
