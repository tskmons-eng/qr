import { addDoc, collection, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'
import { hasStaffPermission } from '../lib/staffPermissions'
import { filterVisibleOrderItems, sortOrderItemsByOrderedAt } from '../lib/staffTableDetail'
import { seatStaffOrderSession } from './orderCommandService'
import {
  cancelOrderItemCommand,
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

export function subscribeStaffTableOrderItems(orderId, onNext) {
  const orderItemsQuery = query(collection(db, 'orderItems'), where('orderId', '==', orderId))
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

export async function cancelOrderItem({ table, tableId, item, passcode, activeStaff }) {
  const canBypassPasscode = hasStaffPermission(activeStaff, 'manageMenu', { useKitchen: true, closeRegister: false, manageMenu: false })
  if (!canBypassPasscode) {
    const storeSnap = await getDoc(doc(db, 'stores', table.storeId))
    if (storeSnap.data()?.adminPasscode !== passcode) {
      return { ok: false, reason: 'invalid-passcode' }
    }
  }

  await cancelOrderItemCommand({
    itemId: item.id,
    tableId,
    tableName: table.tableName,
    source: 'staff_table',
    activeStaff,
    actorUid: auth.currentUser?.uid ?? null,
  })

  return { ok: true }
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
  return snap.docs
    .map(docSnapshot => ({ id: docSnapshot.id, ...docSnapshot.data() }))
    .filter(table => table.id !== currentTableId)
    .sort((a, b) => a.tableName.localeCompare(b.tableName, 'ja'))
}

export async function moveTableOrder({ sourceTable, sourceTableId, targetTable, activeStaff }) {
  return moveTableOrderCommand({ sourceTable, sourceTableId, targetTable, activeStaff })
}
