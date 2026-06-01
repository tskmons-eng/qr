import { useEffect, useState } from 'react'
import StaffEntryForm from '../../components/staff/StaffEntryForm'
import {
  canEnterStaffStore,
  getSavedStaffStoreCode,
  normalizeStaffStoreCode,
  saveStaffStoreCodePreference,
} from '../../lib/staffEntry'
import { enterStaffStoreByCode } from '../../services/staffEntryService'

export default function StaffEntryPage() {
  const [code, setCode] = useState('')
  const [rememberCode, setRememberCode] = useState(true)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [autoEntering, setAutoEntering] = useState(false)

  useEffect(() => {
    const savedCode = getSavedStaffStoreCode()
    if (!savedCode) return
    setCode(savedCode)
    setAutoEntering(true)
    enterStore(savedCode, true).finally(() => setAutoEntering(false))
  }, [])

  async function enterStore(rawCode, remember) {
    const upper = rawCode.trim().toUpperCase()
    if (!canEnterStaffStore(upper)) return false

    setLoading(true)
    setError('')
    try {
      const result = await enterStaffStoreByCode(upper)
      if (!result.ok) {
        saveStaffStoreCodePreference({ code: upper, remember: false })
        setError('店舗コードが正しくありません')
        setLoading(false)
        return false
      }

      localStorage.setItem('deviceStoreId', result.storeId)
      saveStaffStoreCodePreference({ code: upper, remember })
      window.location.href = '/staff'
      return true
    } catch (err) {
      setError(err?.code || err?.message || 'エラーが発生しました。もう一度試してください')
      setLoading(false)
      return false
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    await enterStore(code, rememberCode)
  }

  return (
    <StaffEntryForm
      autoEntering={autoEntering}
      code={code}
      error={error}
      loading={loading}
      rememberCode={rememberCode}
      onCodeChange={value => setCode(normalizeStaffStoreCode(value))}
      onRememberChange={setRememberCode}
      onSubmit={handleSubmit}
    />
  )
}
