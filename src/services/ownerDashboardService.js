import { collection, doc, getDoc, getDocs, serverTimestamp, writeBatch } from 'firebase/firestore'
import { buildOwnerDashboardSnapshot } from '../lib/ownerDashboard'
import { db } from '../lib/firebase'
import { normalizeOwnerEmail, validateOwnerEmail } from '../lib/ownerAccess'

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

export async function updateStoreAdminEmail({ storeId, currentEmail, nextEmail, updatedBy }) {
  const normalizedEmail = normalizeOwnerEmail(nextEmail)
  const validationError = validateOwnerEmail(normalizedEmail)
  if (validationError) throw new Error(validationError)

  const assignmentRef = doc(db, 'storeAdminEmails', normalizedEmail)
  const assignmentSnap = await getDoc(assignmentRef)
  if (assignmentSnap.exists() && assignmentSnap.data().storeId !== storeId) {
    throw new Error('このメールアドレスは別の店舗に割り当て済みです')
  }

  const timestamp = serverTimestamp()
  const normalizedCurrentEmail = currentEmail ? normalizeOwnerEmail(currentEmail) : ''
  const batch = writeBatch(db)
  if (normalizedCurrentEmail && normalizedCurrentEmail !== normalizedEmail) {
    batch.delete(doc(db, 'storeAdminEmails', normalizedCurrentEmail))
  }

  batch.set(assignmentRef, {
    email: normalizedEmail,
    storeId,
    role: 'storeAdmin',
    updatedAt: timestamp,
    updatedBy: updatedBy ?? null,
  }, { merge: true })
  batch.update(doc(db, 'stores', storeId), {
    ownerEmail: normalizedEmail,
    ownerEmailUpdatedAt: timestamp,
    ownerEmailUpdatedBy: updatedBy ?? null,
  })
  await batch.commit()
}
