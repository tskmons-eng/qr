import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { sortTables } from '../lib/tableOrder'
import { sortReservationsByTime, sortWaitingReservations } from '../lib/reservationDisplay'
import { withOrderCommandFailureLog } from './orderCommandFailureService'
import { callOrderCommandFunction } from './orderFunctionCommandService'

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
    const tables = sortTables(mapDocs(snap))
    onChange(tables)
  })
}

export async function loadReservationTables(storeId) {
  const snap = await getDocs(query(collection(db, 'tables'), where('storeId', '==', storeId)))
  return sortTables(mapDocs(snap))
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

// 予約客の案内は必ずサーバーを通す。案内したスタッフはサーバーが決める。
export async function guideReservationToTable({ reservationId, targetTableId, storeId }) {
  return withOrderCommandFailureLog({
    commandType: 'guide_reservation_to_table',
    actorType: 'staff',
    storeId,
    targetTableId,
  }, () => callOrderCommandFunction('guideReservationToTableCommand', { reservationId, targetTableId, storeId }))
}
