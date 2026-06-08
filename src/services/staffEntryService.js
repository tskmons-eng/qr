import { signInAnonymously, signOut } from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'

export async function enterStaffStoreByCode(code, { forceAnonymous = false } = {}) {
  let credential = auth.currentUser ? { user: auth.currentUser } : await signInAnonymously(auth)
  const snap = await getDoc(doc(db, 'storeCodes', code))
  if (!snap.exists()) return { ok: false, reason: 'not-found' }

  const { storeId } = snap.data()
  if (forceAnonymous && credential.user && !credential.user.isAnonymous) {
    await signOut(auth)
    credential = await signInAnonymously(auth)
  }

  await setDoc(doc(db, 'staffSessions', credential.user.uid), {
    storeId,
    code,
  })

  return { ok: true, storeId }
}
