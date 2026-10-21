import { useEffect, useState } from 'react'
import {
  canEnterStaffStore,
  getSavedStaffStoreCode,
  normalizeStaffStoreCode,
  saveStaffStoreCodePreference,
} from '../lib/staffEntry'
import { clearStaffAutoLoginPreference } from '../lib/staffMember'
import { enterStaffStoreByCode } from '../services/staffEntryService'

// 店舗コードでの入室。最初の入室画面と、スタッフを選ぶ画面の「別の店舗コードで入る」で共通に使う。
// 店舗コードで入るときは、管理者のログインを流用せず必ず匿名のスタッフ端末として入り直す（AGENTS.md 5章）。
export default function useStoreCodeEntry({ currentStoreId = null, autoEnterSaved = false } = {}) {
  const [code, setCode] = useState(() => (autoEnterSaved ? getSavedStaffStoreCode() ?? '' : ''))
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [autoEntering, setAutoEntering] = useState(false)

  async function enter(rawCode = code, rememberCode = remember) {
    const normalized = normalizeStaffStoreCode(rawCode)
    if (!canEnterStaffStore(normalized)) {
      setError('店舗コードは6文字で入力してください')
      return false
    }

    setLoading(true)
    setError('')
    try {
      const result = await enterStaffStoreByCode(normalized, { forceAnonymous: true })
      if (!result.ok) {
        saveStaffStoreCodePreference({ code: normalized, remember: false })
        setError('店舗コードが正しくありません')
        setLoading(false)
        return false
      }

      if (currentStoreId) clearStaffAutoLoginPreference(currentStoreId)
      clearStaffAutoLoginPreference(result.storeId)
      localStorage.removeItem('activeStaff')
      localStorage.setItem('deviceStoreId', result.storeId)
      saveStaffStoreCodePreference({ code: normalized, remember: rememberCode })
      window.location.href = '/staff'
      return true
    } catch (enterError) {
      setError(enterError?.code || enterError?.message || '店舗コードの確認に失敗しました。もう一度お試しください')
      setLoading(false)
      return false
    }
  }

  useEffect(() => {
    if (!autoEnterSaved) return
    const savedCode = getSavedStaffStoreCode()
    if (!savedCode) return
    setAutoEntering(true)
    enter(savedCode, true).finally(() => setAutoEntering(false))
  }, [autoEnterSaved])

  return {
    code,
    remember,
    error,
    loading,
    autoEntering,
    setCode: value => {
      setCode(normalizeStaffStoreCode(value))
      setError('')
    },
    setRemember,
    submit: event => {
      event?.preventDefault()
      return enter()
    },
  }
}
