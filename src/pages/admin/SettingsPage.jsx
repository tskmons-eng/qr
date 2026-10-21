import { useEffect, useState } from 'react'
import CancelPasscodeSettings from '../../components/admin/CancelPasscodeSettings'
import CustomerDisplaySettings from '../../components/admin/CustomerDisplaySettings'
import DeviceSoundSettings from '../../components/admin/DeviceSoundSettings'
import SettingsSaveButton from '../../components/admin/SettingsSaveButton'
import StoreWorkflowSettings from '../../components/admin/StoreWorkflowSettings'
import StoreCodeCard from '../../components/admin/StoreCodeCard'
import TaxRateSettings from '../../components/admin/TaxRateSettings'
import { useAuth } from '../../contexts/AuthContext'
import { useStore } from '../../contexts/StoreContext'
import {
  CUSTOMER_SETTING_TOGGLES,
  WORKFLOW_SETTING_TOGGLES,
  TAX_PRESETS,
} from '../../lib/settingsConfig'
import { normalizeStoreName } from '../../lib/storeIdentity'
import {
  loadStoreIdentity,
  loadStoreConfig,
  loadStoreConfigProducts,
  saveStoreName,
  saveStoreConfig,
} from '../../services/settingsService'

export default function SettingsPage({ notificationControls = null, onConfigSaved }) {
  const { storeId } = useStore()
  const { user } = useAuth()
  const [storeCode, setStoreCode] = useState('')
  const [storeIdentity, setStoreIdentity] = useState(null)
  const [storeNameInput, setStoreNameInput] = useState('')
  const [storeNameSaving, setStoreNameSaving] = useState(false)
  const [storeNameSaved, setStoreNameSaved] = useState(false)
  const [storeNameError, setStoreNameError] = useState('')
  const [codeCopied, setCodeCopied] = useState(false)
  const [config, setConfig] = useState(null)
  const [taxInput, setTaxInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
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
    loadStoreConfig(storeId).then(nextConfig => {
      setConfig(nextConfig)
      setTaxInput(String(nextConfig.taxRate))
    })
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

  function handleToggle(key) {
    setConfig(prev => ({ ...prev, [key]: !prev[key] }))
    setSaved(false)
  }

  function handleGuestAutoAddChange(patch) {
    setConfig(prev => ({
      ...prev,
      guestAutoAdd: {
        ...(prev.guestAutoAdd ?? {}),
        ...patch,
      },
    }))
    setSaved(false)
  }

  function handleTaxPreset(value) {
    setConfig(prev => ({ ...prev, taxRate: value }))
    setTaxInput(String(value))
    setSaved(false)
  }

  function handleTaxInput(value) {
    setTaxInput(value)
    const nextTaxRate = parseFloat(value)
    if (!Number.isNaN(nextTaxRate) && nextTaxRate >= 0 && nextTaxRate <= 100) {
      setConfig(prev => ({ ...prev, taxRate: nextTaxRate }))
    }
    setSaved(false)
  }

  async function handleSave() {
    setSaving(true)
    await saveStoreConfig(storeId, config)
    onConfigSaved?.(config)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
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
      <CustomerDisplaySettings
        toggles={CUSTOMER_SETTING_TOGGLES}
        config={config}
        onToggle={handleToggle}
      />
      <StoreWorkflowSettings
        config={config}
        products={products}
        toggles={WORKFLOW_SETTING_TOGGLES}
        onToggle={handleToggle}
        onGuestAutoAddChange={handleGuestAutoAddChange}
      />
      <CancelPasscodeSettings storeId={storeId} />
      <DeviceSoundSettings notificationControls={notificationControls} />
      <TaxRateSettings
        taxRate={config.taxRate}
        taxInput={taxInput}
        presets={TAX_PRESETS}
        onPreset={handleTaxPreset}
        onInput={handleTaxInput}
      />
      <SettingsSaveButton
        saving={saving}
        saved={saved}
        onSave={handleSave}
      />
    </div>
  )
}
