import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { filterCompletedChecks, sortCashClosingsByBusinessDateDesc } from '../lib/adminSales'
import { loadSalesHistoryMetadata } from './salesHistoryService'

function mapDocs(snapshot) {
  return snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
}

export async function loadSalesAdminData(storeId) {
  const [checksSnap, closingsSnap, historyMetadata] = await Promise.all([
    getDocs(query(collection(db, 'checks'), where('storeId', '==', storeId))),
    getDocs(query(collection(db, 'cashClosings'), where('storeId', '==', storeId))),
    loadSalesHistoryMetadata(storeId),
  ])
  const checks = mapDocs(checksSnap)

  return {
    completedChecks: filterCompletedChecks(checks),
    // 取り消した会計（打ち直し前を含む）。本日の一覧に薄く出し、締めで件数を数える（2026-10-30 締め 第2章）。
    voidedChecks: checks.filter(check => check.status === 'voided'),
    cashClosings: sortCashClosingsByBusinessDateDesc(mapDocs(closingsSnap)),
    ...historyMetadata,
  }
}
