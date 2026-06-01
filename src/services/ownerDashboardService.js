import { collection, getDocs } from 'firebase/firestore'
import { buildOwnerDashboardSnapshot } from '../lib/ownerDashboard'
import { db } from '../lib/firebase'

function mapDocs(snapshot) {
  return snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
}

export async function loadOwnerDashboardData() {
  const [storesSnap, checksSnap, ordersSnap] = await Promise.all([
    getDocs(collection(db, 'stores')),
    getDocs(collection(db, 'checks')),
    getDocs(collection(db, 'orders')),
  ])

  return buildOwnerDashboardSnapshot({
    stores: mapDocs(storesSnap),
    checks: mapDocs(checksSnap),
    orders: mapDocs(ordersSnap),
  })
}
