import { useState, useEffect, useRef } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { collection, query, where, onSnapshot, getDocs, updateDoc, doc, serverTimestamp, runTransaction } from 'firebase/firestore'
import { auth, db } from '../../lib/firebase'
import { useStore } from '../../contexts/StoreContext'
import { StaffMemberContext } from '../../contexts/StaffMemberContext'
import { SOUNDS, playSound, loadSoundPrefs, saveSoundPrefs } from '../../lib/sounds'
import { requestAndRegisterToken } from '../../lib/messaging'
import StaffEntryPage from './StaffEntryPage'
import { useAuth } from '../../contexts/AuthContext'
import TableListPage from './TableListPage'
import TableDetailPage from './TableDetailPage'
import StaffMenuPage from './StaffMenuPage'
import CheckoutPage from './CheckoutPage'
import RemainingPage from './RemainingPage'
import KitchenPage from '../kitchen/KitchenPage'

function StaffLoginScreen({ storeId, onLogin, onLogout }) {
  const [members, setMembers] = useState([])
  const [selected, setSelected] = useState(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDocs(query(collection(db, 'staffMembers'), where('storeId', '==', storeId)))
      .then(snap => {
        setMembers(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0)))
        setLoading(false)
      })
  }, [storeId])

  function handleSelect(member) {
    setSelected(member)
    setCode('')
    setError('')
  }

  function handleVerify() {
    if (selected.code === code) {
      onLogin({ id: selected.id, name: selected.name })
    } else {
      setError('コードが違います')
      setCode('')
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', display: 'flex', flexDirection: 'column' }}>
      <header style={{ background: '#222', color: '#fff', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontSize: 17 }}>スタッフ選択</h1>
        <button onClick={onLogout} style={{ background: 'none', border: '1px solid #555', color: '#ccc', padding: '5px 12px', borderRadius: 5, cursor: 'pointer', fontSize: 13 }}>
          ログアウト
        </button>
      </header>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        {loading ? (
          <p style={{ color: '#999' }}>読み込み中...</p>
        ) : members.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#888', width: '100%', maxWidth: 360 }}>
            <p style={{ marginBottom: 4 }}>スタッフが登録されていません</p>
            <p style={{ fontSize: 13, marginBottom: 24 }}>管理画面 → スタッフ から追加してください</p>
            <button
              onClick={() => onLogin({ id: 'admin', name: '管理者' })}
              style={{ width: '100%', padding: '14px', fontSize: 15, fontWeight: 600, background: '#222', color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer' }}
            >
              管理者として入る
            </button>
          </div>
        ) : !selected ? (
          <div style={{ width: '100%', maxWidth: 360 }}>
            <p style={{ textAlign: 'center', color: '#888', fontSize: 14, marginBottom: 16 }}>あなたは誰ですか？</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {members.map(m => (
                <button
                  key={m.id}
                  onClick={() => handleSelect(m)}
                  style={{ width: '100%', padding: '16px', fontSize: 16, fontWeight: 600, background: '#fff', border: '2px solid #e5e5e5', borderRadius: 12, cursor: 'pointer' }}
                >
                  {m.name}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: '100%', maxWidth: 340, boxShadow: '0 2px 16px rgba(0,0,0,0.08)' }}>
            <p style={{ textAlign: 'center', fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{selected.name}</p>
            <p style={{ textAlign: 'center', fontSize: 13, color: '#888', marginBottom: 24 }}>4桁コードを入力</p>
            <input
              type="password"
              inputMode="numeric"
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
              onKeyDown={e => e.key === 'Enter' && code.length === 4 && handleVerify()}
              placeholder="----"
              autoFocus
              style={{ width: '100%', padding: '12px', fontSize: 28, textAlign: 'center', border: '1px solid #ddd', borderRadius: 10, letterSpacing: 10, boxSizing: 'border-box', marginBottom: 4 }}
            />
            {error && <p style={{ color: '#dc2626', fontSize: 13, textAlign: 'center', marginBottom: 8 }}>{error}</p>}
            <button
              onClick={handleVerify}
              disabled={code.length !== 4}
              style={{ width: '100%', marginTop: 12, padding: '13px', fontSize: 15, background: code.length === 4 ? '#222' : '#ccc', color: '#fff', border: 'none', borderRadius: 10, cursor: code.length === 4 ? 'pointer' : 'default' }}
            >
              確認
            </button>
            <button
              onClick={() => setSelected(null)}
              style={{ width: '100%', marginTop: 8, padding: '11px', fontSize: 14, background: '#fff', color: '#666', border: '1px solid #ddd', borderRadius: 10, cursor: 'pointer' }}
            >
              戻る
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function SoundSettingsPanel({ onClose }) {
  const [prefs, setPrefs] = useState(loadSoundPrefs)

  function handleSoundChange(soundId) {
    const next = { ...prefs, soundId }
    setPrefs(next)
    saveSoundPrefs(next.soundId, next.volume)
    playSound(soundId, next.volume)
  }

  function handleVolumeChange(volume) {
    const next = { ...prefs, volume }
    setPrefs(next)
    saveSoundPrefs(next.soundId, next.volume)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end' }} onClick={onClose}>
      <div
        style={{ background: '#fff', margin: '60px 12px 0 0', borderRadius: 12, padding: 20, width: 280, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', border: '1px solid #e5e5e5' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>通知音設定</div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: '#888', marginBottom: 8 }}>音量</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 16 }}>🔈</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.05"
              value={prefs.volume}
              onChange={e => handleVolumeChange(parseFloat(e.target.value))}
              style={{ flex: 1 }}
            />
            <span style={{ fontSize: 16 }}>🔊</span>
          </div>
          <div style={{ textAlign: 'center', fontSize: 13, color: '#888', marginTop: 4 }}>{Math.round(prefs.volume * 100)}%</div>
        </div>

        <div>
          <div style={{ fontSize: 13, color: '#888', marginBottom: 8 }}>通知音を選択</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {SOUNDS.map(s => (
              <button
                key={s.id}
                onClick={() => handleSoundChange(s.id)}
                style={{
                  padding: '9px 14px',
                  fontSize: 14,
                  textAlign: 'left',
                  border: prefs.soundId === s.id ? '2px solid #222' : '1px solid #e5e5e5',
                  borderRadius: 8,
                  background: prefs.soundId === s.id ? '#f5f5f5' : '#fff',
                  cursor: 'pointer',
                  fontWeight: prefs.soundId === s.id ? 700 : 400,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>{s.label}</span>
                <span style={{ fontSize: 12, color: '#aaa' }}>▶ 試聴</span>
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={onClose}
          style={{ width: '100%', marginTop: 16, padding: '9px', fontSize: 14, background: '#222', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}
        >
          閉じる
        </button>
      </div>
    </div>
  )
}

export default function StaffLayout() {
  const navigate = useNavigate()
  const { storeId, loading: storeLoading, clearDeviceStore, setDeviceStore } = useStore()
  const { user } = useAuth()
  const [activeStaff, setActiveStaff] = useState(() => {
    try { return JSON.parse(localStorage.getItem('activeStaff')) } catch { return null }
  })

  function setActiveStaffPersisted(staff) {
    if (staff) localStorage.setItem('activeStaff', JSON.stringify(staff))
    else localStorage.removeItem('activeStaff')
    setActiveStaff(staff)
  }

  const [calls, setCalls] = useState([])
  const [showSoundSettings, setShowSoundSettings] = useState(false)
  const [notifStatus, setNotifStatus] = useState('none')
  const prevCallIdsRef = useRef(null)

  async function registerNotif(sid, staffId) {
    setNotifStatus('loading')
    const token = await requestAndRegisterToken(sid, staffId)
    if (token) {
      setNotifStatus('ok')
    } else {
      setNotifStatus('failed')
    }
  }

  // スタッフがログインしたら毎回トークンを更新する（PWA/ブラウザ切替に対応）
  useEffect(() => {
    if (!storeId || !activeStaff) return
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return
    if (Notification.permission === 'granted') {
      registerNotif(storeId, activeStaff.id)
    }
  }, [storeId, activeStaff?.id])

  async function handleEnableNotif() {
    await registerNotif(storeId, activeStaff.id)
  }

  useEffect(() => {
    if (!storeId || !activeStaff) return
    const q = query(collection(db, 'calls'), where('storeId', '==', storeId))
    return onSnapshot(q, snap => {
      const data = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(d => d.status === 'pending')
        .sort((a, b) => (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0))

      // 新しい呼び出しが来たら音を鳴らす
      if (prevCallIdsRef.current !== null) {
        const newCalls = data.filter(d => !prevCallIdsRef.current.has(d.id))
        if (newCalls.length > 0) {
          const { soundId, volume } = loadSoundPrefs()
          playSound(soundId, volume)
        }
      }
      prevCallIdsRef.current = new Set(data.map(d => d.id))

      setCalls(data)
    })
  }, [storeId, activeStaff?.id])

  async function handleLogout() {
    clearDeviceStore()
    await signOut(auth)
    navigate('/staff')
  }

  async function handleRespond(call) {
    const callRef = doc(db, 'calls', call.id)
    const handled = await runTransaction(db, async tx => {
      const snap = await tx.get(callRef)
      if (!snap.exists() || snap.data().status !== 'pending') return false
      tx.update(callRef, {
        status: 'handled',
        handledAt: serverTimestamp(),
        handledByStaffId: activeStaff?.id ?? null,
        handledByStaffName: activeStaff?.name ?? null,
      })
      return true
    })
    if (handled) navigate(`/staff/table/${call.tableId}`)
  }

  if (user === undefined || storeLoading) return null

  if (!storeId) return <StaffEntryPage />

  if (!activeStaff) {
    return (
      <StaffMemberContext.Provider value={{ activeStaff, setActiveStaff: setActiveStaffPersisted }}>
        <StaffLoginScreen storeId={storeId} onLogin={setActiveStaffPersisted} onLogout={handleLogout} />
      </StaffMemberContext.Provider>
    )
  }

  return (
    <StaffMemberContext.Provider value={{ activeStaff, setActiveStaff: setActiveStaffPersisted }}>
      <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
        <header style={{ background: '#222', color: '#fff', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ margin: 0, fontSize: 17 }}>スタッフ</h1>
            {calls.length > 0 && (
              <span style={{ background: '#dc2626', color: '#fff', fontSize: 12, fontWeight: 700, borderRadius: 99, padding: '2px 8px' }}>
                {calls.length}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#aaa' }}>{activeStaff.name}</span>
            {notifStatus !== 'ok' && (
              <button
                onClick={handleEnableNotif}
                disabled={notifStatus === 'loading'}
                style={{ background: notifStatus === 'failed' ? '#7f1d1d' : '#854d0e', border: 'none', color: '#fef08a', padding: '5px 10px', borderRadius: 5, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
              >
                {notifStatus === 'loading' ? '...' : notifStatus === 'failed' ? '通知❌' : '通知ON'}
              </button>
            )}
            <button
              onClick={() => setShowSoundSettings(v => !v)}
              style={{ background: 'none', border: '1px solid #555', color: '#ccc', padding: '5px 10px', borderRadius: 5, cursor: 'pointer', fontSize: 14 }}
              title="通知音設定"
            >
              🔔
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{ background: 'none', border: '1px solid #555', color: '#ccc', padding: '5px 10px', borderRadius: 5, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}
              title="画面を更新"
            >
              更新
            </button>
            <button onClick={() => setActiveStaffPersisted(null)} style={{ background: 'none', border: '1px solid #555', color: '#ccc', padding: '5px 10px', borderRadius: 5, cursor: 'pointer', fontSize: 12 }}>
              切替
            </button>
            <button onClick={() => navigate('/staff/kitchen')} style={{ background: 'none', border: '1px solid #555', color: '#ccc', padding: '5px 12px', borderRadius: 5, cursor: 'pointer', fontSize: 13 }}>
              キッチン
            </button>
            {!user?.isAnonymous && (
              <>
                <button onClick={() => navigate('/admin')} style={{ background: 'none', border: '1px solid #555', color: '#ccc', padding: '5px 12px', borderRadius: 5, cursor: 'pointer', fontSize: 13 }}>
                  管理
                </button>
              </>
            )}
            <button onClick={handleLogout} style={{ background: 'none', border: '1px solid #555', color: '#ccc', padding: '5px 12px', borderRadius: 5, cursor: 'pointer', fontSize: 13 }}>
              ログアウト
            </button>
          </div>
        </header>

        {showSoundSettings && <SoundSettingsPanel onClose={() => setShowSoundSettings(false)} />}

        {/* 呼び出し・会計通知 */}
        {calls.length > 0 && (
          <div style={{ position: 'sticky', top: 53, zIndex: 15 }}>
            {calls.map(call => {
              const isCheckout = call.type === 'checkout'
              return (
                <div key={call.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: isCheckout ? '#eff6ff' : '#fff7ed', borderBottom: `3px solid ${isCheckout ? '#2563eb' : '#ea580c'}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 18 }}>{isCheckout ? '💳' : '🔔'}</span>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: 15 }}>{call.tableName}</span>
                      <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 700, color: isCheckout ? '#2563eb' : '#ea580c', background: isCheckout ? '#dbeafe' : '#ffedd5', padding: '2px 8px', borderRadius: 99 }}>
                        {isCheckout ? '会計希望' : '呼び出し'}
                      </span>
                    </div>
                  </div>
                  <button onClick={() => handleRespond(call)} style={{ padding: '8px 18px', fontSize: 13, fontWeight: 700, background: isCheckout ? '#2563eb' : '#ea580c', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                    対応する
                  </button>
                </div>
              )
            })}
          </div>
        )}

        <Routes>
          <Route index element={<TableListPage />} />
          <Route path="kitchen" element={<KitchenPage />} />
          <Route path="table/:tableId" element={<TableDetailPage />} />
          <Route path="table/:tableId/remaining" element={<RemainingPage />} />
          <Route path="table/:tableId/add-order" element={<StaffMenuPage />} />
          <Route path="table/:tableId/checkout" element={<CheckoutPage />} />
          <Route path="*" element={<Navigate to="/staff" replace />} />
        </Routes>
      </div>
    </StaffMemberContext.Provider>
  )
}
