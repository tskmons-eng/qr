import { collection, doc, onSnapshot, query, runTransaction, serverTimestamp, where } from 'firebase/firestore'
import { db } from '../lib/firebase'

export function subscribePendingCalls(storeId, onChange) {
  const q = query(
    collection(db, 'calls'),
    where('storeId', '==', storeId),
    where('status', '==', 'pending')
  )
  return onSnapshot(q, snap => {
    const calls = snap.docs
      .map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
      .sort((a, b) => (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0))

    onChange(calls)
  })
}

export function getNewCallIds(calls, previousIds) {
  if (previousIds === null) return []
  return calls
    .filter(call => !previousIds.has(call.id))
    .map(call => call.id)
}

export async function respondToStaffCall({ callId, staffId, staffName }) {
  const callRef = doc(db, 'calls', callId)
  return runTransaction(db, async transaction => {
    const snap = await transaction.get(callRef)
    if (!snap.exists() || snap.data().status !== 'pending') return false
    transaction.update(callRef, {
      status: 'handled',
      handledAt: serverTimestamp(),
      handledByStaffId: staffId ?? null,
      handledByStaffName: staffName ?? null,
    })
    return true
  })
}
