import { addDoc, collection, getDocs, query, serverTimestamp, where } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'
import { filterCompletedChecks, sortCashClosingsByBusinessDateDesc } from '../lib/adminSales'

function mapDocs(snapshot) {
  return snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
}

export async function loadSalesAdminData(storeId) {
  const [checksSnap, closingsSnap] = await Promise.all([
    getDocs(query(collection(db, 'checks'), where('storeId', '==', storeId))),
    getDocs(query(collection(db, 'cashClosings'), where('storeId', '==', storeId))),
  ])

  return {
    completedChecks: filterCompletedChecks(mapDocs(checksSnap)),
    cashClosings: sortCashClosingsByBusinessDateDesc(mapDocs(closingsSnap)),
  }
}

export async function createCashClosingRecord({ storeId, businessDate, memo, summary }) {
  const actor = auth.currentUser
  const payload = {
    storeId,
    businessDate,
    salesTotal: summary.salesTotal,
    customerCount: summary.customerCount,
    checkCount: summary.checkCount,
    averageSpend: summary.averageSpend,
    memo,
    closedAt: serverTimestamp(),
    closedByUid: actor?.uid ?? null,
    closedByEmail: actor?.email ?? null,
  }
  const ref = await addDoc(collection(db, 'cashClosings'), payload)
  return { id: ref.id, ...payload, closedAt: new Date() }
}
