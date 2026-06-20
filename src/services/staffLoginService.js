import {
  GoogleAuthProvider,
  getRedirectResult,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'firebase/auth'
import { auth } from '../lib/firebase'

const googleProvider = new GoogleAuthProvider()

export function signInStaffWithEmail(email, password) {
  return signInWithEmailAndPassword(auth, email, password)
}

function shouldFallbackToRedirect(error) {
  return [
    'auth/cancelled-popup-request',
    'auth/operation-not-supported-in-this-environment',
    'auth/popup-blocked',
  ].includes(error?.code)
}

export async function signInStaffWithGoogle() {
  try {
    return await signInWithPopup(auth, googleProvider)
  } catch (error) {
    if (!shouldFallbackToRedirect(error)) throw error

    if (auth.currentUser?.isAnonymous) {
      await signOut(auth)
    }
    await signInWithRedirect(auth, googleProvider)
    return null
  }
}

export function consumeStaffGoogleRedirectResult() {
  return getRedirectResult(auth)
}
