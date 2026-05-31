import { createContext, useContext, useEffect, useState } from 'react'
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from './AuthContext'

const StoreContext = createContext(null)

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export function StoreProvider({ children }) {
  const { user } = useAuth()
  const [storeId, setStoreId] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user === undefined) return

    if (!user) {
      setStoreId(null)
      setLoading(false)
      return
    }

    // 匿名ユーザー: localStorageのstoreIdを使う
    if (user.isAnonymous) {
      const deviceStoreId = localStorage.getItem('deviceStoreId')
      setStoreId(deviceStoreId)
      setLoading(false)
      return
    }

    // Googleユーザー: stores/{uid} を初期化
    async function initStore() {
      const storeRef = doc(db, 'stores', user.uid)
      const snap = await getDoc(storeRef)
      let code
      if (!snap.exists()) {
        code = generateCode()
        await setDoc(storeRef, {
          storeName: '店舗名未設定',
          storeCode: code,
          isOpen: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      } else if (!snap.data().storeCode) {
        code = generateCode()
        await updateDoc(storeRef, { storeCode: code, updatedAt: serverTimestamp() })
      } else {
        code = snap.data().storeCode
      }
      // storeCodes マッピングを常に保証する
      await setDoc(doc(db, 'storeCodes', code), {
        storeId: user.uid,
        createdAt: serverTimestamp(),
      }, { merge: true })
      setStoreId(user.uid)
      setLoading(false)
    }

    initStore().catch(e => {
      console.error('initStore failed:', e)
      setStoreId(user.uid)
      setLoading(false)
    })
  }, [user])

  function clearDeviceStore() {
    localStorage.removeItem('deviceStoreId')
    localStorage.removeItem('savedStaffStoreCode')
    setStoreId(null)
  }

  function setDeviceStore(id) {
    localStorage.setItem('deviceStoreId', id)
    setStoreId(id)
  }

  return (
    <StoreContext.Provider value={{ storeId, loading, clearDeviceStore, setDeviceStore }}>
      {children}
    </StoreContext.Provider>
  )
}

export function useStore() {
  return useContext(StoreContext)
}
