import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore'
import { normalizeStoreConfig } from '../lib/settingsConfig'
import { db } from '../lib/firebase'
import { startCustomerOrderSession } from './orderCommandService'

// お客様がQRから入るとき（2026-10-28 QR 第1章）。QRの文字を名前にした入口の記録（tableEntries）から席を知り、その席だけを読む。
// 席の一覧は店の人しか読めない決まりにしたので、店の外から全部の席のQRを集められない。
// 入口の記録がまだ無い席（入口を作る前の古い席）は、前の探し方で読む。
// QRを作り直した席は、古いQRの入口が消えるので「無効」になる。
export function subscribeCustomerTableByQrToken(qrToken, onNext, onError) {
  let unsubscribe = () => {}
  let cancelled = false

  function followTable(entry) {
    unsubscribe = onSnapshot(doc(db, 'tables', entry.tableId), snap => {
      const table = snap.exists() ? { id: snap.id, ...snap.data() } : null
      // 入口が指す席のQRの文字と店が一致しているときだけ入れる（作り直した古いQR・別の店を指す入口では入れない）。
      onNext(table && table.qrToken === qrToken && table.storeId === entry.storeId ? table : null)
    }, onError)
  }

  function followLegacyQuery() {
    const tableQuery = query(collection(db, 'tables'), where('qrToken', '==', qrToken))
    unsubscribe = onSnapshot(tableQuery, snap => {
      if (snap.empty) {
        onNext(null)
        return
      }
      const tableDoc = snap.docs[0]
      onNext({ id: tableDoc.id, ...tableDoc.data() })
    }, () => onNext(null))
  }

  let retryTimer = null
  function readEntry() {
    getDoc(doc(db, 'tableEntries', qrToken))
      .then(entrySnap => {
        if (cancelled) return
        if (entrySnap.exists() && entrySnap.data().tableId) followTable(entrySnap.data())
        else followLegacyQuery()
      })
      .catch(error => {
        if (cancelled) return
        // 電波が悪いときは、少し待って読み直す。決まりを出す前で入口が読めないときは、前の探し方で読む。
        if (error?.code === 'unavailable') retryTimer = setTimeout(readEntry, 3000)
        else followLegacyQuery()
      })
  }
  readEntry()

  return () => {
    cancelled = true
    clearTimeout(retryTimer)
    unsubscribe()
  }
}

export async function loadCustomerStoreConfig(storeId) {
  const snap = await getDoc(doc(db, 'storeConfig', storeId))
  return normalizeStoreConfig(snap.exists() ? snap.data() : {})
}

export function createCustomerOrderSession({ guestAutoAdd, guestCount, storeId, tableId }) {
  return startCustomerOrderSession({ guestAutoAdd, guestCount, storeId, tableId })
}
