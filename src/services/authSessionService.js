import { signOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'

export function signOutCurrentUser() {
  return signOut(auth)
}

export async function isAllowedEmail(email) {
  const snap = await getDoc(doc(db, 'allowedEmails', email))
  return snap.exists()
}
