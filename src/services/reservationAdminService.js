import { addDoc, collection, doc, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { db } from '../lib/firebase'

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

export async function createReservationRecord({ storeId, form }) {
  await addDoc(collection(db, 'reservations'), {
    storeId,
    ...form,
    guestCount: Number(form.guestCount),
    status: 'confirmed',
    createdAt: serverTimestamp(),
  })
}

export async function updateReservationStatus(id, status) {
  await updateDoc(doc(db, 'reservations', id), {
    status,
    updatedAt: serverTimestamp(),
  })
}
