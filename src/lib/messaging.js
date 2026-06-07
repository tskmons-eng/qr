import { getMessaging, getToken, onMessage } from 'firebase/messaging'
import { deleteDoc, doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { app, db } from './firebase'

const STAFF_NOTIFICATION_TOKEN_KEY = 'staffNotificationToken'

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
      enabled: true,
      updatedAt: serverTimestamp(),
    }, { merge: true })

    localStorage.setItem(STAFF_NOTIFICATION_TOKEN_KEY, token)
    return token
  } catch (e) {
    console.error('FCM token error:', e)
    return null
  }
}

export async function removeRegisteredNotificationToken() {
  const token = localStorage.getItem(STAFF_NOTIFICATION_TOKEN_KEY)
  localStorage.removeItem(STAFF_NOTIFICATION_TOKEN_KEY)
  if (!token) return
  try {
    await deleteDoc(doc(db, 'staffTokens', token))
  } catch (error) {
    console.error('FCM token removal error:', error)
  }
}

export function hasRegisteredNotificationToken() {
  return Boolean(localStorage.getItem(STAFF_NOTIFICATION_TOKEN_KEY))
}

export function listenForeground(callback) {
  return onMessage(getMsg(), callback)
}
