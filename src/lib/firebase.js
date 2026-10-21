import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import { connectFirestoreEmulator, initializeFirestore, memoryLocalCache, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import { LOCAL_EMULATOR_HOSTS, LOCAL_EMULATOR_PROJECT_ID, USE_LOCAL_EMULATORS } from './localEmulator'

const firebaseConfig = USE_LOCAL_EMULATORS
  ? {
      apiKey: 'demo-api-key',
      authDomain: `${LOCAL_EMULATOR_PROJECT_ID}.firebaseapp.com`,
      projectId: LOCAL_EMULATOR_PROJECT_ID,
      storageBucket: `${LOCAL_EMULATOR_PROJECT_ID}.appspot.com`,
      appId: 'demo-app-id',
    }
  : {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    }

export const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = initializeFirestore(app, {
  // テスト環境は毎回作り直すので、端末に古いデータを残さない。
  localCache: USE_LOCAL_EMULATORS
    ? memoryLocalCache()
    : persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
})
export const storage = getStorage(app)

if (USE_LOCAL_EMULATORS) {
  const { host, authPort, firestorePort } = LOCAL_EMULATOR_HOSTS
  connectAuthEmulator(auth, `http://${host}:${authPort}`, { disableWarnings: true })
  connectFirestoreEmulator(db, host, firestorePort)
}
