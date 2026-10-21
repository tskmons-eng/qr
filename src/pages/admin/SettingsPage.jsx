import { useEffect, useState } from 'react'
import CustomerOrderSettings from '../../components/admin/CustomerOrderSettings'
import DeviceSoundSettings from '../../components/admin/DeviceSoundSettings'
import StoreCodeCard from '../../components/admin/StoreCodeCard'
import StoreOperationSettings from '../../components/admin/StoreOperationSettings'
import { useAuth } from '../../contexts/AuthContext'
import { useStore } from '../../contexts/StoreContext'
import useStoreConfigEditor from '../../hooks/useStoreConfigEditor'
import { normalizeStoreName } from '../../lib/storeIdentity'
import {
  loadStoreIdentity,
  loadStoreConfigProducts,
  saveStoreName,
} from '../../services/settingsService'

// 設定画面：店舗情報／お客様の注文／お店の運用／この端末だけの設定。スイッチや選択は押したらすぐ保存する。
export default function SettingsPage({ notificationControls = null }) {
  const { storeId } = useStore()
  const { user } = useAuth()
  const [storeCode, setStoreCode] = useState('')
  const [storeIdentity, setStoreIdentity] = useState(null)
  const [storeNameInput, setStoreNameInput] = useState('')
  const [storeNameSaving, setStoreNameSaving] = useState(false)
  const [storeNameSaved, setStoreNameSaved] = useState(false)
  const [storeNameError, setStoreNameError] = useState('')
  const [codeCopied, setCodeCopied] = useState(false)
  const { config, statuses, save } = useStoreConfigEditor(storeId)
  const [products, setProducts] = useState([])
  const storeNameChanged = storeIdentity
    ? normalizeStoreName(storeNameInput) !== storeIdentity.storeName
    : false

  useEffect(() => {
    if (!storeId || !user || user.isAnonymous) {
      setStoreIdentity(null)
      setStoreNameInput('')
      setStoreCode('')
      return
    }

    let active = true
    setStoreNameError('')
    loadStoreIdentity(storeId)
      .then(identity => {
        if (!active) return
        setStoreIdentity(identity)
        setStoreNameInput(identity.storeName)
        setStoreCode(identity.storeCode)
      })
      .catch(() => {
        if (!active) return
        setStoreNameError('店舗情報の読み込みに失敗しました')
      })

    return () => {
      active = false
    }
  }, [storeId, user])

  useEffect(() => {
    if (!storeId) return
    loadStoreConfigProducts(storeId).then(setProducts)
  }, [storeId])

  function handleCopyCode() {
    navigator.clipboard.writeText(storeCode).then(() => {
      setCodeCopied(true)
      setTimeout(() => setCodeCopied(false), 2000)
    })
  }

  async function handleStoreNameSave() {
    setStoreNameSaving(true)
    setStoreNameSaved(false)
    setStoreNameError('')
    try {
      const savedName = await saveStoreName(storeId, storeNameInput, user?.email ?? null)
      setStoreIdentity(prev => ({
        storeCode: prev?.storeCode ?? storeCode,
        storeName: savedName,
      }))
      setStoreNameInput(savedName)
      setStoreNameSaved(true)
      setTimeout(() => setStoreNameSaved(false), 2000)
    } catch (error) {
      setStoreNameError(error.message || '店舗名の保存に失敗しました')
    } finally {
      setStoreNameSaving(false)
    }
  }

  if (!config) return <p className="admin-settings__loading">読み込み中...</p>

  return (
    <div className="admin-settings">
      {storeIdentity && (
        <StoreCodeCard
          storeCode={storeCode}
          storeNameInput={storeNameInput}
          storeNameChanged={storeNameChanged}
          storeNameSaving={storeNameSaving}
          storeNameSaved={storeNameSaved}
          storeNameError={storeNameError}
          onStoreNameChange={value => {
            setStoreNameInput(value)
            setStoreNameSaved(false)
            setStoreNameError('')
          }}
          onStoreNameSave={handleStoreNameSave}
          copied={codeCopied}
          onCopy={handleCopyCode}
        />
      )}
      <CustomerOrderSettings config={config} products={products} statuses={statuses} onSave={save} />
      <StoreOperationSettings storeId={storeId} config={config} statuses={statuses} onSave={save} />
      <DeviceSoundSettings notificationControls={notificationControls} />
    </div>
  )
}
