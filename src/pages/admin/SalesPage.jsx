import { useState, useEffect } from 'react'
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore'
import { db, auth } from '../../lib/firebase'
import { useStore } from '../../contexts/StoreContext'
import { downloadCSV, formatTS } from '../../lib/csv'

function getBusinessDate() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function isToday(timestamp) {
  if (!timestamp) return false
  const d = timestamp.toDate()
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
}

export default function SalesPage() {
  const { storeId } = useStore()
  const [todayChecks, setTodayChecks] = useState([])
  const [allChecks, setAllChecks] = useState([])
  const [closings, setClosings] = useState([])
  const [todayClosed, setTodayClosed] = useState(false)
  const [memo, setMemo] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const businessDate = getBusinessDate()

  useEffect(() => {
    if (!storeId) return
    async function load() {
      const [checksSnap, closingsSnap] = await Promise.all([
        getDocs(query(collection(db, 'checks'), where('storeId', '==', storeId))),
        getDocs(query(collection(db, 'cashClosings'), where('storeId', '==', storeId))),
      ])
      const allChecks = checksSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(c => c.status === 'completed')
      setAllChecks(allChecks)
      setTodayChecks(allChecks.filter(c => isToday(c.completedAt)))

      const allClosings = closingsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      allClosings.sort((a, b) => b.businessDate.localeCompare(a.businessDate))
      setClosings(allClosings)
      setTodayClosed(allClosings.some(c => c.businessDate === businessDate))
      setLoading(false)
    }
    load()
  }, [storeId])

  async function handleClose() {
    if (todayClosed || saving) return
    setSaving(true)
    try {
      const salesTotal = todayChecks.reduce((s, c) => s + c.total, 0)
      const customerCount = todayChecks.reduce((s, c) => s + (c.guestCount || 0), 0)
      const checkCount = todayChecks.length
      const averageSpend = checkCount > 0 ? Math.round(salesTotal / checkCount) : 0
      const actor = auth.currentUser

      const newClosing = {
        storeId,
        businessDate,
        salesTotal,
        customerCount,
        checkCount,
        averageSpend,
        memo: memo.trim(),
        closedAt: serverTimestamp(),
        closedByUid: actor?.uid ?? null,
        closedByEmail: actor?.email ?? null,
      }
      const ref = await addDoc(collection(db, 'cashClosings'), newClosing)
      setClosings(prev => [{ id: ref.id, ...newClosing, closedAt: new Date() }, ...prev])
      setTodayClosed(true)
    } catch {
      alert('エラーが発生しました')
    } finally {
      setSaving(false)
    }
  }

  function handleExport() {
    const sorted = [...allChecks].sort((a, b) => (b.completedAt?.seconds ?? 0) - (a.completedAt?.seconds ?? 0))
    const header = ['日時', 'スタッフ', '客数', '小計', '割引', '割引理由', '合計', 'お預かり', 'お釣り', '決済方法']
    const rows = sorted.map(c => [
      formatTS(c.completedAt),
      c.closedByStaffName ?? c.closedByEmail ?? '',
      c.guestCount ?? 0,
      c.subtotal ?? c.total,
      c.discountAmount ?? 0,
      c.discountNote ?? '',
      c.total,
      c.receivedCash ?? '',
      c.changeAmount ?? '',
      c.paymentMethod ?? '現金',
    ])
    downloadCSV([header, ...rows], `売上履歴_${new Date().toLocaleDateString('ja-JP').replace(/\//g, '-')}.csv`)
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 48, color: '#999' }}>読み込み中...</div>

  const todaySales = todayChecks.reduce((s, c) => s + c.total, 0)
  const todayCustomers = todayChecks.reduce((s, c) => s + (c.guestCount || 0), 0)
  const avgSpend = todayChecks.length > 0 ? Math.round(todaySales / todayChecks.length) : 0

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, margin: 0 }}>売上・レジ締め</h2>
        <button onClick={handleExport} disabled={allChecks.length === 0} style={{ padding: '7px 16px', fontSize: 13, background: '#fff', border: '1px solid #ddd', borderRadius: 8, cursor: 'pointer', color: '#333' }}>
          CSV出力
        </button>
      </div>

      {/* 本日の集計 */}
      <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #eee', padding: 16, marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: '#888', fontWeight: 600, marginBottom: 12 }}>本日の売上（{businessDate}）</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          {[
            { label: '売上合計', value: `¥${todaySales.toLocaleString()}` },
            { label: '会計件数', value: `${todayChecks.length}件` },
            { label: '客数',     value: `${todayCustomers}名` },
            { label: '客単価',   value: `¥${avgSpend.toLocaleString()}` },
          ].map(({ label, value }) => (
            <div key={label} style={{ textAlign: 'center', padding: '12px 8px', background: '#f8f8f8', borderRadius: 8 }}>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 本日の会計一覧 */}
      {todayChecks.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #eee', marginBottom: 12 }}>
          <div style={{ padding: '10px 16px', fontSize: 12, color: '#888', fontWeight: 600, borderBottom: '1px solid #f0f0f0' }}>本日の会計</div>
          {todayChecks
            .slice()
            .sort((a, b) => (b.completedAt?.seconds ?? 0) - (a.completedAt?.seconds ?? 0))
            .map(check => (
              <div key={check.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 16px', borderBottom: '1px solid #f5f5f5', fontSize: 14 }}>
                <div>
                  <span style={{ color: '#555' }}>
                    {check.completedAt?.toDate().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span style={{ color: '#aaa', fontSize: 12, marginLeft: 8 }}>{check.guestCount}名</span>
                  {check.closedByEmail && <span style={{ color: '#aaa', fontSize: 11, marginLeft: 8 }}>{check.closedByEmail}</span>}
                </div>
                <span style={{ fontWeight: 600 }}>¥{check.total.toLocaleString()}</span>
              </div>
            ))}
        </div>
      )}

      {/* レジ締め */}
      <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #eee', padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: '#888', fontWeight: 600, marginBottom: 12 }}>レジ締め</div>
        {todayClosed ? (
          <div style={{ background: '#f0fdf4', color: '#16a34a', padding: '12px 16px', borderRadius: 8, fontSize: 14, textAlign: 'center' }}>
            本日のレジ締めは完了しています
          </div>
        ) : (
          <>
            <textarea
              value={memo}
              onChange={e => setMemo(e.target.value)}
              placeholder="メモ（任意）"
              rows={2}
              style={{ width: '100%', padding: '10px 12px', fontSize: 14, border: '1px solid #ddd', borderRadius: 6, resize: 'vertical', boxSizing: 'border-box', marginBottom: 12 }}
            />
            <button
              onClick={handleClose}
              disabled={saving}
              style={{ width: '100%', padding: '12px', fontSize: 15, background: '#222', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}
            >
              {saving ? '処理中...' : 'レジ締めを実行する'}
            </button>
          </>
        )}
      </div>

      {/* 過去のレジ締め履歴 */}
      {closings.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #eee' }}>
          <div style={{ padding: '10px 16px', fontSize: 12, color: '#888', fontWeight: 600, borderBottom: '1px solid #f0f0f0' }}>レジ締め履歴</div>
          {closings.map(c => (
            <div key={c.id} style={{ padding: '12px 16px', borderBottom: '1px solid #f5f5f5' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{c.businessDate}</span>
                <span style={{ fontSize: 15, fontWeight: 700 }}>¥{c.salesTotal.toLocaleString()}</span>
              </div>
              <div style={{ fontSize: 12, color: '#888' }}>
                {c.checkCount}件 · {c.customerCount}名 · 客単価 ¥{c.averageSpend.toLocaleString()}
                {c.closedByEmail && ` · ${c.closedByEmail}`}
              </div>
              {c.memo && <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>📝 {c.memo}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
