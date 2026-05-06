import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useStore } from '../../contexts/StoreContext'

const statusConfig = {
  vacant:           { label: '空席',    bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
  occupied:         { label: '使用中',  bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' },
  occupied_pending: { label: '使用中',  bg: '#eff6ff', color: '#1d4ed8', border: '#93c5fd' },
  checkout_pending: { label: '会計待ち', bg: '#fefce8', color: '#a16207', border: '#fde68a' },
}

function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

function formatElapsed(startedAtSeconds, nowMs) {
  const elapsed = Math.floor((nowMs / 1000) - startedAtSeconds)
  if (elapsed < 60) return '1分未満'
  const h = Math.floor(elapsed / 3600)
  const m = Math.floor((elapsed % 3600) / 60)
  if (h > 0) return `${h}時間${m}分`
  return `${m}分`
}

export default function TableListPage() {
  const { storeId } = useStore()
  const [tables, setTables] = useState([])
  const [pendingMap, setPendingMap] = useState({}) // tableId → {total, drink, food}
  const navigate = useNavigate()
  const now = useNow()

  useEffect(() => {
    if (!storeId) return
    const q = query(collection(db, 'tables'), where('storeId', '==', storeId))
    return onSnapshot(q, snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      data.sort((a, b) => (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0))
      setTables(data)
    })
  }, [storeId])

  // 提供待ち（ordered）アイテムをリアルタイム購読してtebleIdごとにカウント
  useEffect(() => {
    if (!storeId) return
    const q = query(
      collection(db, 'orderItems'),
      where('storeId', '==', storeId),
      where('itemStatus', '==', 'ordered')
    )
    return onSnapshot(q, snap => {
      const map = {}
      snap.docs.forEach(d => {
        const { tableId, categoryGroup } = d.data()
        if (!tableId) return
        const prev = map[tableId] ?? { total: 0, drink: 0, food: 0 }
        map[tableId] = {
          total: prev.total + 1,
          drink: prev.drink + (categoryGroup === 'drink' ? 1 : 0),
          food: prev.food + (categoryGroup === 'food' ? 1 : 0),
        }
      })
      setPendingMap(map)
    })
  }, [storeId])

  if (tables.length === 0) return (
    <div style={{ textAlign: 'center', padding: 48, color: '#bbb' }}>
      <p>席がまだありません</p>
      <p style={{ fontSize: 13 }}>管理画面 → 席管理から追加してください</p>
    </div>
  )

  return (
    <div style={{ padding: 16, maxWidth: 600, margin: '0 auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        {tables.map(table => {
          const pending = pendingMap[table.id] ?? { total: 0, drink: 0, food: 0 }
          const hasPending = table.status === 'occupied' && pending.total > 0
          const cfgKey = hasPending ? 'occupied_pending' : (table.status ?? 'vacant')
          const cfg = statusConfig[cfgKey] ?? statusConfig.vacant
          return (
            <button
              key={table.id}
              onClick={() => navigate(`table/${table.id}`)}
              style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 12, padding: '20px 16px', cursor: 'pointer', textAlign: 'left' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#222' }}>{table.tableName}</div>
                {hasPending && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                    {pending.drink > 0 && (
                      <span style={{ fontSize: 10, fontWeight: 700, background: '#0ea5e9', color: '#fff', borderRadius: 99, padding: '1px 7px', whiteSpace: 'nowrap' }}>
                        🥤 {pending.drink}
                      </span>
                    )}
                    {pending.food > 0 && (
                      <span style={{ fontSize: 10, fontWeight: 700, background: '#f97316', color: '#fff', borderRadius: 99, padding: '1px 7px', whiteSpace: 'nowrap' }}>
                        🍽 {pending.food}
                      </span>
                    )}
                    {(pending.total - pending.drink - pending.food) > 0 && (
                      <span style={{ fontSize: 10, fontWeight: 700, background: '#1d4ed8', color: '#fff', borderRadius: 99, padding: '1px 7px', whiteSpace: 'nowrap' }}>
                        待 {pending.total - pending.drink - pending.food}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div style={{ fontSize: 13, color: cfg.color, fontWeight: 600 }}>{cfg.label}</div>
              {table.guestCount > 0 && (
                <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{table.guestCount}名</div>
              )}
              {table.status !== 'vacant' && table.startedAt?.seconds && (
                <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>
                  {formatElapsed(table.startedAt.seconds, now)}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
