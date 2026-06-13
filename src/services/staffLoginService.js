import { GoogleAuthProvider, getRedirectResult, signInWithEmailAndPassword, signInWithRedirect } from 'firebase/auth'
import { auth } from '../lib/firebase'

const googleProvider = new GoogleAuthProvider()

export function signInStaffWithEmail(email, password) {
  return signInWithEmailAndPassword(auth, email, password)
}

export function signInStaffWithGoogle() {
  return signInWithRedirect(auth, googleProvider)
}

export function consumeStaffGoogleRedirectResult() {
  return getRedirectResult(auth)
}
