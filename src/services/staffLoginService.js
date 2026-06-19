import { GoogleAuthProvider, getRedirectResult, signInWithEmailAndPassword, signInWithRedirect, signOut } from 'firebase/auth'
import { auth } from '../lib/firebase'

const googleProvider = new GoogleAuthProvider()

export function signInStaffWithEmail(email, password) {
  return signInWithEmailAndPassword(auth, email, password)
}

export async function signInStaffWithGoogle() {
  if (auth.currentUser?.isAnonymous) {
    await signOut(auth)
  }
  return signInWithRedirect(auth, googleProvider)
}

export function consumeStaffGoogleRedirectResult() {
  return getRedirectResult(auth)
}
