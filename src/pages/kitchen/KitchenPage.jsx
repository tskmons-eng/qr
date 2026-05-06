import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, query, where, onSnapshot, updateDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useStore } from '../../contexts/StoreContext'
import { SOUNDS, playSound, loadKitchenSoundPrefs, saveKitchenSoundPrefs } from '../../lib/sounds'

function KitchenSoundPanel({ onClose }) {
  const [prefs, setPrefs] = useState(loadKitchenSoundPrefs)

  function handleSoundChange(soundId) {
    const next = { ...prefs, soundId }
    setPrefs(next)
    saveKitchenSoundPrefs(next.soundId, next.volume)
    playSound(soundId, next.volume)
  }

  function handleVolumeChange(volume) {
    const next = { ...prefs, volume }
    setPrefs(next)
    saveKitchenSoundPrefs(next.soundId, next.volume)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end' }} onClick={onClose}>
      <div
        style={{ background: '#2a2a2a', margin: '60px 12px 0 0', borderRadius: 12, padding: 20, width: 280, boxShadow: '0 8px 32px rgba(0,0,0,0.4)', border: '1px solid #444', color: '#fff' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>通知音設定（キッチン）</div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: '#888', marginBottom: 8 }}>音量</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 16 }}>🔈</span>
            <input type="range" min="0" max="2" step="0.05" value={prefs.volume}
              onChange={e => handleVolumeChange(parseFloat(e.target.value))} style={{ flex: 1 }} />
            <span style={{ fontSize: 16 }}>🔊</span>
          </div>
          <div style={{ textAlign: 'center', fontSize: 13, color: '#888', marginTop: 4 }}>{Math.round(prefs.volume * 100)}%</div>
        </div>
        <div style={{ fontSize: 13, color: '#888', marginBottom: 8 }}>通知音を選択</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {SOUNDS.map(s => (
            <button key={s.id} onClick={() => handleSoundChange(s.id)}
              style={{ padding: '9px 14px', fontSize: 14, textAlign: 'left', border: prefs.soundId === s.id ? '2px solid #fff' : '1px solid #444', borderRadius: 8, background: prefs.soundId === s.id ? '#444' : '#333', cursor: 'pointer', fontWeight: prefs.soundId === s.id ? 700 : 400, color: '#fff', display: 'flex', justifyContent: 'space-between' }}>
              <span>{s.label}</span>
              <span style={{ fontSize: 12, color: '#888' }}>▶ 試聴</span>
            </button>
          ))}
        </div>
        <button onClick={onClose}
          style={{ width: '100%', marginTop: 16, padding: '9px', fontSize: 14, background: '#555', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
          閉じる
        </button>
      </div>
    </div>
  )
}

function timeAgo(timestamp) {
  if (!timestamp) return ''
  const seconds = Math.floor((Date.now() - timestamp.toDate().getTime()) / 1000)
  if (seconds < 60) return `${seconds}秒`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}分`
  return `${Math.floor(minutes / 60)}時間${minutes % 60}分`
}

function waitColor(timestamp) {
  if (!timestamp) return '#888'
  const minutes = Math.floor((Date.now() - timestamp.toDate().getTime()) / 60000)
  if (minutes >= 15) return '#dc2626'
  if (minutes >= 8) return '#f59e0b'
  return '#16a34a'
}

export default function KitchenPage() {
  const { storeId, loading: storeLoading } = useStore()
  const navigate = useNavigate()
  const [tables, setTables] = useState([])
  const [pendingItems, setPendingItems] = useState([])
  const [tick, setTick] = useState(0)
  const [showSoundSettings, setShowSoundSettings] = useState(false)
  const [filterGroup, setFilterGroup] = useState('all') // 'all' | 'drink' | 'food'
  const prevItemIdsRef = useRef(null)

  // 1分ごとに時刻表示を更新
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30000)
    return () => clearInterval(id)
  }, [])

  // 席をリアルタイム取得
  useEffect(() => {
    if (!storeId) return
    const q = query(collection(db, 'tables'), where('storeId', '==', storeId))
    return onSnapshot(q, snap => {
      setTables(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
  }, [storeId])

  // 未提供の注文明細をリアルタイム取得（storeId+itemStatus で購読し in句上限を回避）
  useEffect(() => {
    if (!storeId) return
    const q = query(
      collection(db, 'orderItems'),
      where('storeId', '==', storeId),
      where('itemStatus', '==', 'ordered')
    )
    return onSnapshot(q, snap => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }))

      if (prevItemIdsRef.current !== null) {
        const newItems = items.filter(i => !prevItemIdsRef.current.has(i.id))
        const notifyItems = filterGroup === 'all'
          ? newItems
          : newItems.filter(i => i.categoryGroup === filterGroup)
        if (notifyItems.length > 0) {
          const { soundId, volume } = loadKitchenSoundPrefs()
          playSound(soundId, volume)
        }
      }
      prevItemIdsRef.current = new Set(items.map(i => i.id))

      setPendingItems(items)
    })
  }, [storeId, filterGroup])

  async function markServed(itemId) {
    await updateDoc(doc(db, 'orderItems', itemId), {
      itemStatus: 'served',
      updatedAt: serverTimestamp(),
    })
  }

  async function markAllServed(items) {
    await Promise.all(items.map(i => updateDoc(doc(db, 'orderItems', i.id), {
      itemStatus: 'served',
      updatedAt: serverTimestamp(),
    })))
  }

  // 席ごとに未提供明細をまとめる
  const filteredPendingItems = filterGroup === 'all'
    ? pendingItems
    : pendingItems.filter(i => i.categoryGroup === filterGroup)
  const occupiedTables = tables.filter(t => t.currentOrderId)
  const tableGroups = occupiedTables.map(table => {
    const items = filteredPendingItems
      .filter(i => i.orderId === table.currentOrderId)
      .sort((a, b) => (a.orderedAt?.seconds ?? 0) - (b.orderedAt?.seconds ?? 0))
    const oldest = items[0]?.orderedAt ?? null
    return { table, items, oldest }
  }).filter(g => g.items.length > 0)

  // 最も古い注文が上に来るよう並び替え
  tableGroups.sort((a, b) => (a.oldest?.seconds ?? Infinity) - (b.oldest?.seconds ?? Infinity))

  if (storeLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#999' }}>
      読み込み中...
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#1a1a1a', color: '#fff' }}>
      <header style={{ background: '#111', padding: '10px 16px', borderBottom: '1px solid #333' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => navigate('/staff')} style={{ background: 'none', border: '1px solid #444', color: '#aaa', padding: '5px 12px', borderRadius: 5, cursor: 'pointer', fontSize: 13 }}>
              ← 戻る
            </button>
            <div>
              <span style={{ fontSize: 18, fontWeight: 700 }}>キッチン</span>
              <span style={{ marginLeft: 12, fontSize: 13, color: '#888' }}>未提供: {filteredPendingItems.length}品</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, color: '#666' }}>
              {new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
            </span>
            <button
              onClick={() => setShowSoundSettings(v => !v)}
              style={{ background: 'none', border: '1px solid #444', color: '#aaa', padding: '5px 10px', borderRadius: 5, cursor: 'pointer', fontSize: 14 }}
            >
              🔔
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { key: 'all',   label: 'すべて',      activeBg: '#fff',     activeColor: '#111' },
            { key: 'drink', label: '🥤 ドリンク', activeBg: '#0ea5e9',  activeColor: '#fff' },
            { key: 'food',  label: '🍽 フード',   activeBg: '#f97316',  activeColor: '#fff' },
          ].map(({ key, label, activeBg, activeColor }) => (
            <button
              key={key}
              onClick={() => setFilterGroup(key)}
              style={{ padding: '5px 14px', fontSize: 13, borderRadius: 20, border: filterGroup === key ? `1px solid ${activeBg}` : '1px solid #444', background: filterGroup === key ? activeBg : 'transparent', color: filterGroup === key ? activeColor : '#aaa', cursor: 'pointer', fontWeight: filterGroup === key ? 700 : 400, transition: 'all 0.15s' }}
            >
              {label}
            </button>
          ))}
        </div>
      </header>
      {showSoundSettings && <KitchenSoundPanel onClose={() => setShowSoundSettings(false)} />}

      {tableGroups.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 60px)', color: '#555', gap: 8 }}>
          <div style={{ fontSize: 48 }}>✓</div>
          <div style={{ fontSize: 16 }}>未提供の料理はありません</div>
        </div>
      ) : (
        <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, maxWidth: 1200, margin: '0 auto' }}>
          {tableGroups.map(({ table, items, oldest }) => {
            const color = waitColor(oldest)
            const ago = timeAgo(oldest)
            return (
              <div key={table.id} style={{ background: '#2a2a2a', borderRadius: 12, border: `2px solid ${color}`, overflow: 'hidden' }}>
                {/* 席ヘッダー */}
                <div style={{ background: '#333', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: 16, fontWeight: 700 }}>{table.tableName}</span>
                    <span style={{ fontSize: 12, color: '#aaa', marginLeft: 8 }}>{table.guestCount}名</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, color, fontWeight: 600 }}>{ago}待ち</span>
                    <button
                      onClick={() => markAllServed(items)}
                      style={{ padding: '4px 10px', fontSize: 11, background: color, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}
                    >
                      全提供
                    </button>
                  </div>
                </div>

                {/* 未提供アイテム */}
                <div style={{ padding: '8px 0' }}>
                  {items.map(item => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid #333' }}>
                      <div>
                        <span style={{ fontSize: 15, fontWeight: 600 }}>{item.productNameSnapshot}</span>
                        <span style={{ fontSize: 14, color: '#aaa', marginLeft: 8 }}>× {item.quantity}</span>
                        <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>
                          {timeAgo(item.orderedAt)}前 · {item.orderedBy === 'staff' ? 'スタッフ' : 'お客様'}
                        </div>
                      </div>
                      <button
                        onClick={() => markServed(item.id)}
                        style={{ padding: '6px 12px', fontSize: 12, background: '#444', color: '#ddd', border: '1px solid #555', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        提供済み
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
