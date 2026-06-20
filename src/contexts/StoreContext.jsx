import { createContext, useContext, useEffect, useState } from 'react'
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { isSuperAdminEmail } from '../lib/ownerIdentity'
import { useAuth } from './AuthContext'

const StoreContext = createContext(null)
const OWNER_ACTIVE_STORE_ID_KEY = 'ownerActiveStoreId'

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export function StoreProvider({ children }) {
  const { user } = useAuth()
  const [storeId, setStoreId] = useState(null)
  const [ownerActiveStoreId, setOwnerActiveStoreId] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user === undefined) return
    setLoading(true)

    if (!user) {
      localStorage.removeItem(OWNER_ACTIVE_STORE_ID_KEY)
      setStoreId(null)
      setOwnerActiveStoreId(null)
      setLoading(false)
      return
    }

    // 匿名ユーザー: localStorageのstoreIdを使う
    if (user.isAnonymous) {
      const deviceStoreId = localStorage.getItem('deviceStoreId')
      if (!deviceStoreId) {
        setStoreId(null)
        setLoading(false)
        return
      }

      async function validateStaffSession() {
        const sessionSnap = await getDoc(doc(db, 'staffSessions', user.uid))
        const sessionStoreId = sessionSnap.exists() ? sessionSnap.data().storeId : null
        if (sessionStoreId === deviceStoreId) {
          setStoreId(deviceStoreId)
        } else {
          localStorage.removeItem('deviceStoreId')
          localStorage.removeItem('activeStaff')
          setStoreId(null)
        }
        setLoading(false)
      }

      validateStaffSession().catch(e => {
        console.warn('validateStaffSession failed:', e)
        localStorage.removeItem('deviceStoreId')
        localStorage.removeItem('activeStaff')
        setStoreId(null)
        setLoading(false)
      })
      return
    }

    // Googleユーザー: stores/{uid} を初期化
    async function initStore() {
      const normalizedEmail = user.email?.trim().toLowerCase()
      if (isSuperAdminEmail(normalizedEmail)) {
        const selectedStoreId = localStorage.getItem(OWNER_ACTIVE_STORE_ID_KEY)
        if (selectedStoreId) {
          const selectedStoreSnap = await getDoc(doc(db, 'stores', selectedStoreId))
          if (selectedStoreSnap.exists()) {
            setStoreId(selectedStoreId)
            setOwnerActiveStoreId(selectedStoreId)
            setLoading(false)
            return
          }
          localStorage.removeItem(OWNER_ACTIVE_STORE_ID_KEY)
          setOwnerActiveStoreId(null)
        }
      }

      if (normalizedEmail) {
        const assignmentSnap = await getDoc(doc(db, 'storeAdminEmails', normalizedEmail))
        const assignedStoreId = assignmentSnap.exists() ? assignmentSnap.data().storeId : null
        if (assignedStoreId) {
          setStoreId(assignedStoreId)
          setLoading(false)
          return
        }
      }

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
      setOwnerActiveStoreId(null)
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

  function activateOwnerStore(id) {
    if (!user || user.isAnonymous || !isSuperAdminEmail(user.email?.trim().toLowerCase())) return false
    localStorage.setItem(OWNER_ACTIVE_STORE_ID_KEY, id)
    setOwnerActiveStoreId(id)
    setStoreId(id)
    return true
  }

  function clearOwnerStore() {
    localStorage.removeItem(OWNER_ACTIVE_STORE_ID_KEY)
    setOwnerActiveStoreId(null)
    if (user && !user.isAnonymous && isSuperAdminEmail(user.email?.trim().toLowerCase())) {
      setStoreId(user.uid)
    }
  }

  return (
    <StoreContext.Provider
      value={{
        storeId,
        loading,
        ownerActiveStoreId,
        activateOwnerStore,
        clearDeviceStore,
        clearOwnerStore,
        setDeviceStore,
      }}
    >
      {children}
    </StoreContext.Provider>
  )
}

export function useStore() {
  return useContext(StoreContext)
}
