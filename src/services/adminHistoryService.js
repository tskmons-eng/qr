import { collection, getDocs, query, where } from 'firebase/firestore'
import { mergeHistoryItems } from '../lib/adminHistory'
import { db } from '../lib/firebase'

function mapDocs(snapshot) {
  return snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
}

export async function loadAdminHistory(storeId) {
  const [actionsSnap, checksSnap] = await Promise.all([
    getDocs(query(collection(db, 'staffActions'), where('storeId', '==', storeId))),
    getDocs(query(collection(db, 'checks'), where('storeId', '==', storeId))),
  ])

  return mergeHistoryItems(mapDocs(actionsSnap), mapDocs(checksSnap))
}
