import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { sortAllowedEmailEntries } from '../lib/ownerAccess'

export function subscribeOwnerAllowedEmails(onNext) {
  return onSnapshot(collection(db, 'allowedEmails'), snap => {
    onNext(sortAllowedEmailEntries(snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))))
  })
}

export function addOwnerAllowedEmail({ email, addedBy }) {
  return setDoc(doc(db, 'allowedEmails', email), {
    email,
    addedAt: serverTimestamp(),
    addedBy,
  })
}

export function removeOwnerAllowedEmail(email) {
  return deleteDoc(doc(db, 'allowedEmails', email))
}
