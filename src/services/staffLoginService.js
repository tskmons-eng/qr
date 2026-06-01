import { GoogleAuthProvider, signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth'
import { auth } from '../lib/firebase'

const googleProvider = new GoogleAuthProvider()

export function signInStaffWithEmail(email, password) {
  return signInWithEmailAndPassword(auth, email, password)
}

export function signInStaffWithGoogle() {
  return signInWithPopup(auth, googleProvider)
}
