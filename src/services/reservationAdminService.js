import { addDoc, collection, doc, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { buildReservationScheduleFields } from '../lib/reservationDisplay'

export async function loadReservationAdminData(storeId) {
  const [reservationSnap, tableSnap] = await Promise.all([
    getDocs(query(collection(db, 'reservations'), where('storeId', '==', storeId))),
    getDocs(query(collection(db, 'tables'), where('storeId', '==', storeId))),
  ])

  return {
    reservations: reservationSnap.docs.map(record => ({ id: record.id, ...record.data() })),
    tables: tableSnap.docs
      .map(record => ({ id: record.id, ...record.data() }))
      .sort((a, b) => a.tableName.localeCompare(b.tableName, 'ja')),
  }
}

export async function createReservationRecord({ storeId, form, tables = [] }) {
  const selectedTable = tables.find(table => table.id === form.tableId)
  await addDoc(collection(db, 'reservations'), {
    storeId,
    ...form,
    guestCount: Number(form.guestCount),
    tableId: form.tableId || '',
    tableNameSnapshot: selectedTable?.tableName ?? '',
    ...buildReservationScheduleFields(form),
    status: 'confirmed',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function updateReservationStatus(id, status) {
  const extra = status === 'cancelled'
    ? { waitingStatus: 'dismissed', dismissedAt: serverTimestamp() }
    : status === 'seated'
      ? { waitingStatus: 'handled', waitingReason: null }
      : {}

  await updateDoc(doc(db, 'reservations', id), {
    status,
    ...extra,
    updatedAt: serverTimestamp(),
  })
}
