import { useState, useEffect } from 'react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useStore } from '../../contexts/StoreContext'
import { downloadCSV, formatTS } from '../../lib/csv'

const actionLabel = {
  checkout: '会計',
  checkout_discount: '割引会計',
  cancel_item: 'キャンセル',
  seat_guests: '着席',
  move_table: '席移動',
  adjust_guests: '人数変更',
}

const actionColor = {
  checkout: '#16a34a',
  checkout_discount: '#7c3aed',
  cancel_item: '#dc2626',
  seat_guests: '#2563eb',
  move_table: '#0891b2',
  adjust_guests: '#d97706',
}

function formatDate(ts) {
  if (!ts) return '—'
  return ts.toDate?.().toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) ?? '—'
}

export default function HistoryPage() {
  const { storeId } = useStore()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    if (!storeId) return
    async function load() {
      const [actionsSnap, checksSnap] = await Promise.all([
        getDocs(query(collection(db, 'staffActions'), where('storeId', '==', storeId))),
        getDocs(query(collection(db, 'checks'), where('storeId', '==', storeId))),
      ])

      const actions = actionsSnap.docs.map(d => ({ id: d.id, ...d.data() }))

      const discountedChecks = checksSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(c => c.discountAmount > 0)
        .map(c => ({
          id: c.id,
          actionType: 'checkout_discount',
          actorStaffName: c.closedByStaffName ?? c.closedByEmail ?? '—',
          note: `¥${c.total.toLocaleString()} (割引 −¥${c.discountAmount.toLocaleString()}${c.discountNote ? ' / ' + c.discountNote : ''})`,
          createdAt: c.completedAt,
          _check: c,
        }))

      const merged = [...actions, ...discountedChecks]
        .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))

      setItems(merged)
      setLoading(false)
    }
    load()
  }, [storeId])

  const filterKeys = ['all', ...Object.keys(actionLabel)]
  const filtered = filter === 'all' ? items : items.filter(a => a.actionType === filter)

  function handleExport() {
    const header = ['日時', '種別', 'スタッフ', '内容']
    const rows = filtered.map(a => [
      formatTS(a.createdAt),
      actionLabel[a.actionType] ?? a.actionType,
      a.actorStaffName ?? a.actorEmail ?? '',
      a.note ?? '',
    ])
    downloadCSV([header, ...rows], `操作履歴_${new Date().toLocaleDateString('ja-JP').replace(/\//g, '-')}.csv`)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>操作履歴</h2>
        <button
          onClick={handleExport}
          disabled={filtered.length === 0}
          style={{ padding: '7px 16px', fontSize: 13, background: '#fff', border: '1px solid #ddd', borderRadius: 8, cursor: 'pointer', color: '#333' }}
        >
          CSV出力
        </button>
      </div>

      {/* フィルター */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {filterKeys.map(key => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            style={{ padding: '5px 12px', fontSize: 12, borderRadius: 99, cursor: 'pointer', border: '1px solid #ddd', background: filter === key ? '#222' : '#fff', color: filter === key ? '#fff' : '#555', fontWeight: filter === key ? 600 : 400 }}
          >
            {key === 'all' ? 'すべて' : actionLabel[key]}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: '#999', textAlign: 'center', padding: 32 }}>読み込み中...</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: '#bbb', textAlign: 'center', padding: 32 }}>履歴がありません</p>
      ) : (
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #eee', overflow: 'hidden' }}>
          {filtered.map((a, i) => (
            <div key={`${a.id}-${a.actionType}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: i < filtered.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 99, whiteSpace: 'nowrap', background: `${actionColor[a.actionType] ?? '#888'}18`, color: actionColor[a.actionType] ?? '#888' }}>
                {actionLabel[a.actionType] ?? a.actionType}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, color: '#222', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.note ?? '—'}</div>
                <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>{a.actorStaffName ?? a.actorEmail ?? '—'}</div>
              </div>
              <span style={{ fontSize: 12, color: '#bbb', whiteSpace: 'nowrap' }}>{formatDate(a.createdAt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
