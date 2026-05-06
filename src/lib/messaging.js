import { getMessaging, getToken, onMessage } from 'firebase/messaging'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { app, db } from './firebase'

let messaging = null
function getMsg() {
  if (!messaging) messaging = getMessaging(app)
  return messaging
}

export async function requestAndRegisterToken(storeId, userId) {
  try {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return null

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return null

    // サービスワーカーを明示的に登録
    let sw
    try {
      sw = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' })
      await navigator.serviceWorker.ready
    } catch {
      sw = await navigator.serviceWorker.ready
    }

    const token = await getToken(getMsg(), {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: sw,
    })
    if (!token) return null

    await setDoc(doc(db, 'staffTokens', token), {
      storeId,
      userId,
      token,
      updatedAt: serverTimestamp(),
    }, { merge: true })

    return token
  } catch (e) {
    console.error('FCM token error:', e)
    return null
  }
}

export function listenForeground(callback) {
  return onMessage(getMsg(), callback)
}
