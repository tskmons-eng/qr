import { useState, useEffect } from 'react'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useStore } from '../../contexts/StoreContext'
import { useAuth } from '../../contexts/AuthContext'

const TOGGLES = [
  { key: 'showServedStatus', label: '提供済み表示', description: 'お客様の注文確認画面に「提供済み」ラベルを表示する' },
  { key: 'showItemPrice', label: '商品ごとの金額表示', description: 'お客様の注文確認画面に各商品の金額を表示する' },
  { key: 'allowAdditionalOrders', label: '追加注文ボタン表示', description: 'お客様の注文確認画面に「追加注文する」ボタンを表示する' },
]

const TOGGLE_DEFAULTS = { showServedStatus: true, showItemPrice: true, allowAdditionalOrders: true }
const TAX_PRESETS = [0, 8, 10]

export default function SettingsPage() {
  const { storeId } = useStore()
  const { user } = useAuth()
  const [storeCode, setStoreCode] = useState('')
  const [codeCopied, setCodeCopied] = useState(false)
  const [config, setConfig] = useState(null)
  const [taxInput, setTaxInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!storeId || !user || user.isAnonymous) return
    getDoc(doc(db, 'stores', storeId)).then(snap => {
      if (snap.exists()) setStoreCode(snap.data().storeCode ?? '')
    })
  }, [storeId, user])

  function handleCopyCode() {
    navigator.clipboard.writeText(storeCode).then(() => {
      setCodeCopied(true)
      setTimeout(() => setCodeCopied(false), 2000)
    })
  }

  useEffect(() => {
    if (!storeId) return
    getDoc(doc(db, 'storeConfig', storeId)).then(snap => {
      const data = snap.exists() ? snap.data() : {}
      const merged = { ...TOGGLE_DEFAULTS, taxRate: 10, ...data }
      setConfig(merged)
      setTaxInput(String(merged.taxRate ?? 10))
    })
  }, [storeId])

  function handleToggle(key) {
    setConfig(prev => ({ ...prev, [key]: !prev[key] }))
    setSaved(false)
  }

  function handleTaxPreset(v) {
    setConfig(prev => ({ ...prev, taxRate: v }))
    setTaxInput(String(v))
    setSaved(false)
  }

  function handleTaxInput(v) {
    setTaxInput(v)
    const n = parseFloat(v)
    if (!isNaN(n) && n >= 0 && n <= 100) {
      setConfig(prev => ({ ...prev, taxRate: n }))
    }
    setSaved(false)
  }

  async function handleSave() {
    setSaving(true)
    await setDoc(doc(db, 'storeConfig', storeId), { ...config, updatedAt: serverTimestamp() }, { merge: true })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (!config) return <p style={{ color: '#999', textAlign: 'center', padding: 32 }}>読み込み中...</p>

  return (
    <div>
      {/* 店舗コード */}
      {storeCode && (
        <>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>店舗コード</h2>
          <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #eee', padding: 16, marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: 6, color: '#222' }}>{storeCode}</div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>スタッフ・スタッフ画面のログインに使います</div>
            </div>
            <button
              onClick={handleCopyCode}
              style={{ padding: '9px 18px', fontSize: 13, fontWeight: 600, background: codeCopied ? '#16a34a' : '#f5f5f5', color: codeCopied ? '#fff' : '#444', border: '1px solid #e5e5e5', borderRadius: 8, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              {codeCopied ? 'コピー済み' : 'コピー'}
            </button>
          </div>
        </>
      )}

      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>お客様画面の設定</h2>

      {/* トグル設定 */}
      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #eee', overflow: 'hidden', marginBottom: 20 }}>
        {TOGGLES.map((s, i) => (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', borderBottom: i < TOGGLES.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
            <div style={{ flex: 1, marginRight: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{s.label}</div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 3 }}>{s.description}</div>
            </div>
            <button
              onClick={() => handleToggle(s.key)}
              style={{ width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', flexShrink: 0, background: config[s.key] ? '#222' : '#ddd', position: 'relative' }}
            >
              <span style={{ position: 'absolute', top: 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', left: config[s.key] ? 25 : 3, transition: 'left 0.15s' }} />
            </button>
          </div>
        ))}
      </div>

      {/* 税率設定 */}
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>税率設定</h2>
      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #eee', padding: 16, marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>会計画面・注文確認に消費税の内訳を表示します（内税表示）。0%にすると非表示。</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {TAX_PRESETS.map(v => (
            <button
              key={v}
              onClick={() => handleTaxPreset(v)}
              style={{ padding: '8px 18px', fontSize: 14, fontWeight: 600, border: '2px solid', borderRadius: 8, cursor: 'pointer', background: config.taxRate === v ? '#222' : '#fff', color: config.taxRate === v ? '#fff' : '#333', borderColor: config.taxRate === v ? '#222' : '#ddd' }}
            >
              {v}%
            </button>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="number"
              value={taxInput}
              onChange={e => handleTaxInput(e.target.value)}
              min="0"
              max="100"
              style={{ width: 72, padding: '8px 10px', fontSize: 14, border: '2px solid #ddd', borderRadius: 8, textAlign: 'right' }}
            />
            <span style={{ fontSize: 14, color: '#555' }}>%</span>
          </div>
        </div>
        <div style={{ fontSize: 13, color: '#555' }}>
          現在の設定: <strong>{config.taxRate}%</strong>
          {config.taxRate > 0 && <span style={{ color: '#888', marginLeft: 8 }}>（¥1,000の場合 うち税 ¥{Math.round(1000 * config.taxRate / (100 + config.taxRate))}）</span>}
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        style={{ padding: '11px 32px', fontSize: 14, fontWeight: 600, background: saved ? '#16a34a' : '#222', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}
      >
        {saving ? '保存中...' : saved ? '保存しました' : '保存する'}
      </button>
    </div>
  )
}
