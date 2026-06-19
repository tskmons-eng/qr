import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { sortReservationsByTime, sortWaitingReservations } from '../lib/reservationDisplay'
import { buildEmptyTablePendingAggregateFields } from '../lib/tablePending'
import { withOrderCommandFailureLog } from './orderCommandFailureService'
import { callOrderCommandFunction, shouldUseOrderCommandFunctions } from './orderFunctionCommandService'

function mapDocs(snapshot) {
  return snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
}

function normalizeGuestCount(value) {
  const count = Number(value)
  if (!Number.isFinite(count)) return 1
  return Math.max(1, Math.round(count))
}

export function subscribeTodayReservations(storeId, date, onChange) {
  const reservationsQuery = query(
    collection(db, 'reservations'),
    where('storeId', '==', storeId),
    where('date', '==', date),
    where('status', '==', 'confirmed')
  )

  return onSnapshot(reservationsQuery, snap => {
    onChange(sortReservationsByTime(mapDocs(snap)))
  })
}

export function subscribePendingReservationWaits(storeId, onChange) {
  const waitsQuery = query(
    collection(db, 'reservations'),
    where('storeId', '==', storeId),
    where('waitingStatus', '==', 'pending'),
    orderBy('arrivalNoticeAt', 'asc')
  )

  return onSnapshot(waitsQuery, snap => {
    onChange(sortWaitingReservations(mapDocs(snap)))
  })
}

export function subscribeReservationTables(storeId, onChange) {
  const tablesQuery = query(collection(db, 'tables'), where('storeId', '==', storeId))
  return onSnapshot(tablesQuery, snap => {
    const tables = mapDocs(snap).sort((a, b) => (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0))
    onChange(tables)
  })
}

export async function loadReservationTables(storeId) {
  const snap = await getDocs(query(collection(db, 'tables'), where('storeId', '==', storeId)))
  return mapDocs(snap).sort((a, b) => (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0))
}

export async function dismissReservationWait({ reservationId, activeStaff }) {
  await updateDoc(doc(db, 'reservations', reservationId), {
    waitingStatus: 'dismissed',
    dismissedAt: serverTimestamp(),
    handledByStaffId: activeStaff?.id ?? null,
    handledByStaffName: activeStaff?.name ?? null,
    updatedAt: serverTimestamp(),
  })
}

async function guideReservationToTableClient({ reservationId, targetTableId, activeStaff }) {
  return runTransaction(db, async transaction => {
    const reservationRef = doc(db, 'reservations', reservationId)
    const tableRef = doc(db, 'tables', targetTableId)
    const reservationSnap = await transaction.get(reservationRef)
    const tableSnap = await transaction.get(tableRef)

    if (!reservationSnap.exists()) return { ok: false, reason: 'reservation-missing' }
    if (!tableSnap.exists()) return { ok: false, reason: 'table-missing' }

    const reservation = reservationSnap.data()
    const table = tableSnap.data()
    if (reservation.storeId !== table.storeId) return { ok: false, reason: 'store-mismatch' }
    if (reservation.status !== 'confirmed') return { ok: false, reason: 'reservation-closed' }

    const now = serverTimestamp()
    const guestCount = normalizeGuestCount(reservation.guestCount)
    const actorFields = {
      handledByStaffId: activeStaff?.id ?? null,
      handledByStaffName: activeStaff?.name ?? null,
    }
    let orderId = table.currentOrderId ?? null
    const isVacant = table.status === 'vacant' || !table.currentOrderId

    if (isVacant) {
      const orderRef = doc(collection(db, 'orders'))
      orderId = orderRef.id
      transaction.set(orderRef, {
        storeId: reservation.storeId,
        tableId: targetTableId,
        guestCount,
        status: 'open',
        openedAt: now,
        checkedOutAt: null,
        createdBy: 'reservation',
        reservationId,
        updatedAt: now,
      })
      transaction.update(tableRef, {
        status: 'occupied',
        guestCount,
        currentOrderId: orderId,
        startedAt: now,
        pendingCount: 0,
        ...buildEmptyTablePendingAggregateFields(),
        updatedAt: now,
      })
    } else {
      if (orderId) {
        transaction.update(doc(db, 'orders', orderId), {
          guestCount,
          reservationId,
          updatedAt: now,
        })
      }
      transaction.update(tableRef, {
        guestCount,
        updatedAt: now,
      })
    }

    transaction.update(reservationRef, {
      status: 'seated',
      waitingStatus: 'handled',
      waitingReason: null,
      seatedTableId: targetTableId,
      seatedOrderId: orderId,
      handledAt: now,
      ...actorFields,
      updatedAt: now,
    })

    transaction.set(doc(collection(db, 'staffActions')), {
      storeId: reservation.storeId,
      actionType: 'seat_reservation',
      targetType: 'reservation',
      targetId: reservationId,
      actorType: 'staff',
      actorStaffId: activeStaff?.id ?? null,
      actorStaffName: activeStaff?.name ?? null,
      note: `${reservation.name ?? '予約'} ${guestCount}名を${table.tableName ?? ''}へ案内`,
      createdAt: now,
    })

    return { ok: true, orderId, wasOccupied: !isVacant }
  })
}

export async function guideReservationToTable({ reservationId, targetTableId, storeId, activeStaff }) {
  return withOrderCommandFailureLog({
    commandType: 'guide_reservation_to_table',
    actorType: 'staff',
    storeId,
    targetTableId,
  }, () => (
    shouldUseOrderCommandFunctions()
      ? callOrderCommandFunction('guideReservationToTableCommand', {
          reservationId,
          targetTableId,
          storeId,
          activeStaff,
        })
      : guideReservationToTableClient({ reservationId, targetTableId, activeStaff })
  ))
}
