import { collection, deleteDoc, doc, getDocs, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import {
  normalizeAllowedEmailEntry,
  normalizeOwnerEmail,
  sortAllowedEmailEntries,
} from '../lib/ownerAccess'

function mapAllowedEmailDocs(docs) {
  return sortAllowedEmailEntries(
    docs.map(docSnap => normalizeAllowedEmailEntry(docSnap.id, docSnap.data())),
  )
}

function allowedEmailDoc(email) {
  return doc(db, 'allowedEmails', normalizeOwnerEmail(email))
}

function buildAllowedEmailData({ email, addedBy = null }) {
  return {
    email: normalizeOwnerEmail(email),
    addedAt: serverTimestamp(),
    addedBy: addedBy ?? null,
  }
}

export function subscribeAllowedEmailEntries(onNext) {
  return onSnapshot(collection(db, 'allowedEmails'), snap => {
    onNext(mapAllowedEmailDocs(snap.docs))
  })
}

export async function loadAllowedEmailEntries() {
  const snap = await getDocs(collection(db, 'allowedEmails'))
  return mapAllowedEmailDocs(snap.docs)
}

export function saveAllowedEmail({ email, addedBy = null }) {
  const normalizedEmail = normalizeOwnerEmail(email)
  return setDoc(
    allowedEmailDoc(normalizedEmail),
    buildAllowedEmailData({ email: normalizedEmail, addedBy }),
    { merge: true },
  )
}

export function deleteAllowedEmail(email) {
  return deleteDoc(allowedEmailDoc(email))
}

export function subscribeOwnerAllowedEmails(onNext) {
  return subscribeAllowedEmailEntries(onNext)
}

export function addOwnerAllowedEmail({ email, addedBy }) {
  return saveAllowedEmail({ email, addedBy })
}

export function removeOwnerAllowedEmail(email) {
  return deleteAllowedEmail(email)
}
