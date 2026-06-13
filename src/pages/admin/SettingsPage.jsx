import { useEffect, useState } from 'react'
import AllowedEmailSettings from '../../components/admin/AllowedEmailSettings'
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
  normalizeAllowedEmail,
  TAX_PRESETS,
  validateAllowedEmail,
} from '../../lib/settingsConfig'
import { isSuperAdminEmail } from '../../lib/ownerIdentity'
import {
  addAllowedEmail,
  loadAllowedEmails,
  loadStoreCode,
  loadStoreConfig,
  loadStoreConfigProducts,
  removeAllowedEmail,
  saveStoreConfig,
} from '../../services/settingsService'

export default function SettingsPage({ notificationControls = null, onConfigSaved }) {
  const { storeId } = useStore()
  const { user } = useAuth()
  const [storeCode, setStoreCode] = useState('')
  const [codeCopied, setCodeCopied] = useState(false)
  const [config, setConfig] = useState(null)
  const [taxInput, setTaxInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [allowedEmails, setAllowedEmails] = useState([])
  const [products, setProducts] = useState([])
  const [newEmail, setNewEmail] = useState('')
  const [emailAdding, setEmailAdding] = useState(false)
  const [emailError, setEmailError] = useState('')
  const canManageAllowedEmails = isSuperAdminEmail(user?.email)

  useEffect(() => {
    if (!storeId || !user || user.isAnonymous) return
    loadStoreCode(storeId).then(setStoreCode)
  }, [storeId, user])

  useEffect(() => {
    if (!canManageAllowedEmails) return
    loadAllowedEmails().then(setAllowedEmails)
  }, [canManageAllowedEmails])

  useEffect(() => {
    if (!storeId) return
    loadStoreConfig(storeId).then(nextConfig => {
      setConfig(nextConfig)
      setTaxInput(String(nextConfig.taxRate ?? 10))
    })
    loadStoreConfigProducts(storeId).then(setProducts)
  }, [storeId])

  function handleCopyCode() {
    navigator.clipboard.writeText(storeCode).then(() => {
      setCodeCopied(true)
      setTimeout(() => setCodeCopied(false), 2000)
    })
  }

  async function handleAddEmail() {
    setEmailError('')
    const email = normalizeAllowedEmail(newEmail)
    const validationError = validateAllowedEmail(email, allowedEmails)
    if (validationError) {
      setEmailError(validationError)
      return
    }

    setEmailAdding(true)
    try {
      await addAllowedEmail(email)
      setAllowedEmails(prev => [...prev, email])
      setNewEmail('')
    } catch (error) {
      setEmailError(`保存失敗: ${error.message}`)
    } finally {
      setEmailAdding(false)
    }
  }

  async function handleRemoveEmail(email) {
    if (!confirm(`${email} を削除しますか？`)) return
    try {
      await removeAllowedEmail(email)
      setAllowedEmails(prev => prev.filter(existingEmail => existingEmail !== email))
    } catch (error) {
      alert(`削除失敗: ${error.message}`)
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
      <StoreCodeCard
        storeCode={storeCode}
        copied={codeCopied}
        onCopy={handleCopyCode}
      />
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

      {canManageAllowedEmails && (
        <AllowedEmailSettings
          allowedEmails={allowedEmails}
          newEmail={newEmail}
          emailAdding={emailAdding}
          emailError={emailError}
          onNewEmailChange={value => {
            setNewEmail(value)
            setEmailError('')
          }}
          onAddEmail={handleAddEmail}
          onRemoveEmail={handleRemoveEmail}
        />
      )}
    </div>
  )
}
