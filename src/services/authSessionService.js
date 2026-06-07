import { signOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'

export function signOutCurrentUser() {
  return signOut(auth)
}

export async function isAllowedEmail(email) {
  if (!email) return false
  const normalizedEmail = email.trim().toLowerCase()
  const [allowedSnap, storeAdminSnap] = await Promise.all([
    getDoc(doc(db, 'allowedEmails', normalizedEmail)),
    getDoc(doc(db, 'storeAdminEmails', normalizedEmail)),
  ])
  return allowedSnap.exists() || storeAdminSnap.exists()
}
