import { useState, useEffect } from 'react'
import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useStore } from '../../contexts/StoreContext'

const STATUS_LABEL = { confirmed: '予約済', cancelled: 'キャンセル', seated: '案内済' }
const STATUS_COLOR = { confirmed: '#2563eb', cancelled: '#dc2626', seated: '#16a34a' }
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

function todayStr() {
  return new Date().toLocaleDateString('sv-SE')
}

function toDateStr(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfWeek(year, month) {
  return new Date(year, month, 1).getDay()
}

const EMPTY_FORM = (date) => ({ date: date || todayStr(), time: '18:00', name: '', phone: '', guestCount: 2, tableId: '', note: '' })

export default function ReservationPage() {
  const { storeId } = useStore()
  const [reservations, setReservations] = useState([])
  const [tables, setTables] = useState([])
  const [loading, setLoading] = useState(true)

  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState(todayStr())
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM(todayStr()))
  const [saving, setSaving] = useState(false)

  async function load() {
    const [resSnap, tableSnap] = await Promise.all([
      getDocs(query(collection(db, 'reservations'), where('storeId', '==', storeId))),
      getDocs(query(collection(db, 'tables'), where('storeId', '==', storeId))),
    ])
    setReservations(resSnap.docs.map(d => ({ id: d.id, ...d.data() })))
    setTables(tableSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.tableName.localeCompare(b.tableName, 'ja')))
    setLoading(false)
  }

  useEffect(() => { if (storeId) load() }, [storeId])

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  function handleDayClick(dateStr) {
    setSelectedDate(dateStr)
    setShowForm(false)
    setForm(EMPTY_FORM(dateStr))
  }

  async function handleAdd() {
    if (!form.name.trim() || !form.date || !form.time) return
    setSaving(true)
    await addDoc(collection(db, 'reservations'), {
      storeId, ...form,
      guestCount: Number(form.guestCount),
      status: 'confirmed',
      createdAt: serverTimestamp(),
    })
    setShowForm(false)
    setForm(EMPTY_FORM(selectedDate))
    await load()
    setSaving(false)
  }

  async function handleStatus(id, status) {
    await updateDoc(doc(db, 'reservations', id), { status, updatedAt: serverTimestamp() })
    setReservations(prev => prev.map(r => r.id === id ? { ...r, status } : r))
  }

  // カレンダー計算
  const daysInMonth = getDaysInMonth(viewYear, viewMonth)
  const firstDow = getFirstDayOfWeek(viewYear, viewMonth)
  const todayISO = todayStr()

  // 日付ごとの予約マップ
  const byDate = {}
  reservations.forEach(r => {
    if (!byDate[r.date]) byDate[r.date] = []
    byDate[r.date].push(r)
  })

  const selectedReservations = (byDate[selectedDate] || [])
    .filter(r => r.status !== 'cancelled')
    .sort((a, b) => a.time.localeCompare(b.time))

  const selectedDateLabel = selectedDate
    ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })
    : ''

  if (loading) return <p style={{ color: '#999', textAlign: 'center', padding: 32 }}>読み込み中...</p>

  return (
    <div>
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>予約管理</h2>

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>

        {/* カレンダー */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #eee', overflow: 'hidden', minWidth: 320, flex: '1 1 320px' }}>
          {/* 月ナビ */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #f0f0f0' }}>
            <button onClick={prevMonth} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#555', padding: '0 6px' }}>‹</button>
            <span style={{ fontSize: 15, fontWeight: 700 }}>{viewYear}年{viewMonth + 1}月</span>
            <button onClick={nextMonth} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#555', padding: '0 6px' }}>›</button>
          </div>

          {/* 曜日ヘッダー */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {WEEKDAYS.map((d, i) => (
              <div key={d} style={{ textAlign: 'center', padding: '8px 0', fontSize: 11, fontWeight: 600, color: i === 0 ? '#dc2626' : i === 6 ? '#2563eb' : '#888' }}>
                {d}
              </div>
            ))}

            {/* 空白 */}
            {Array.from({ length: firstDow }).map((_, i) => <div key={`e${i}`} />)}

            {/* 日付セル */}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
              const dateStr = toDateStr(viewYear, viewMonth, day)
              const dayReservations = (byDate[dateStr] || []).filter(r => r.status !== 'cancelled')
              const isToday = dateStr === todayISO
              const isSelected = dateStr === selectedDate
              const isPast = dateStr < todayISO
              const dow = (firstDow + day - 1) % 7

              return (
                <div
                  key={day}
                  onClick={() => handleDayClick(dateStr)}
                  style={{
                    padding: '6px 4px', textAlign: 'center', cursor: 'pointer', minHeight: 56,
                    background: isSelected ? '#222' : isToday ? '#f0f9ff' : '#fff',
                    borderTop: '1px solid #f0f0f0',
                    borderLeft: '1px solid #f0f0f0',
                    transition: 'background 0.1s',
                  }}
                >
                  <div style={{
                    fontSize: 13, fontWeight: isToday ? 700 : 400, marginBottom: 3,
                    color: isSelected ? '#fff' : isToday ? '#2563eb' : isPast ? '#bbb' : dow === 0 ? '#dc2626' : dow === 6 ? '#2563eb' : '#333',
                  }}>
                    {day}
                  </div>
                  {dayReservations.length > 0 && (
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: isSelected ? '#fff' : '#2563eb', background: isSelected ? 'rgba(255,255,255,0.2)' : '#dbeafe', borderRadius: 99, padding: '1px 5px', display: 'inline-block', marginBottom: 2 }}>
                        {dayReservations.length}件
                      </div>
                      {dayReservations.slice(0, 2).map(r => (
                        <div key={r.id} style={{ fontSize: 9, color: isSelected ? 'rgba(255,255,255,0.8)' : '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.4 }}>
                          {r.time} {r.name}
                        </div>
                      ))}
                      {dayReservations.length > 2 && (
                        <div style={{ fontSize: 9, color: isSelected ? 'rgba(255,255,255,0.6)' : '#aaa' }}>+{dayReservations.length - 2}</div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* 右パネル：選択日の予約 */}
        <div style={{ flex: '1 1 280px', minWidth: 260 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{selectedDateLabel}</div>
            <button
              onClick={() => { setShowForm(v => !v); setForm(EMPTY_FORM(selectedDate)) }}
              style={{ padding: '7px 14px', fontSize: 13, fontWeight: 600, background: '#222', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}
            >
              {showForm ? '閉じる' : '+ 追加'}
            </button>
          </div>

          {/* 追加フォーム */}
          {showForm && (
            <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #eee', padding: 16, marginBottom: 14 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 3 }}>日付</label>
                    <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                      style={{ width: '100%', padding: '8px', fontSize: 13, border: '1px solid #ddd', borderRadius: 6, boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 3 }}>時間</label>
                    <input type="time" value={form.time} onChange={e => setForm(p => ({ ...p, time: e.target.value }))}
                      style={{ width: '100%', padding: '8px', fontSize: 13, border: '1px solid #ddd', borderRadius: 6, boxSizing: 'border-box' }} />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 3 }}>お名前 *</label>
                  <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="山田 太郎"
                    style={{ width: '100%', padding: '8px', fontSize: 13, border: '1px solid #ddd', borderRadius: 6, boxSizing: 'border-box' }} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 3 }}>人数</label>
                    <input type="number" value={form.guestCount} min="1" onChange={e => setForm(p => ({ ...p, guestCount: e.target.value }))}
                      style={{ width: '100%', padding: '8px', fontSize: 13, border: '1px solid #ddd', borderRadius: 6, boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 3 }}>電話</label>
                    <input type="tel" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                      style={{ width: '100%', padding: '8px', fontSize: 13, border: '1px solid #ddd', borderRadius: 6, boxSizing: 'border-box' }} />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 3 }}>席（任意）</label>
                  <select value={form.tableId} onChange={e => setForm(p => ({ ...p, tableId: e.target.value }))}
                    style={{ width: '100%', padding: '8px', fontSize: 13, border: '1px solid #ddd', borderRadius: 6, boxSizing: 'border-box', background: '#fff' }}>
                    <option value="">未指定</option>
                    {tables.map(t => <option key={t.id} value={t.id}>{t.tableName}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 3 }}>メモ</label>
                  <input type="text" value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))} placeholder="アレルギー・ご要望など"
                    style={{ width: '100%', padding: '8px', fontSize: 13, border: '1px solid #ddd', borderRadius: 6, boxSizing: 'border-box' }} />
                </div>
                <button
                  onClick={handleAdd}
                  disabled={saving || !form.name.trim()}
                  style={{ padding: '10px', fontSize: 13, fontWeight: 600, background: form.name.trim() ? '#222' : '#ccc', color: '#fff', border: 'none', borderRadius: 8, cursor: form.name.trim() ? 'pointer' : 'default' }}
                >
                  {saving ? '保存中...' : '登録する'}
                </button>
              </div>
            </div>
          )}

          {/* 選択日の予約リスト */}
          {selectedReservations.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#bbb', fontSize: 13 }}>予約はありません</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {selectedReservations.map(r => {
                const tableName = tables.find(t => t.id === r.tableId)?.tableName
                return (
                  <div key={r.id} style={{ background: '#fff', borderRadius: 10, border: '1px solid #eee', padding: '12px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 15, fontWeight: 700 }}>{r.time}</span>
                          <span style={{ fontSize: 15 }}>{r.name} 様</span>
                          <span style={{ fontSize: 12, color: '#888' }}>{r.guestCount}名</span>
                        </div>
                        <div style={{ fontSize: 11, color: '#aaa', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {r.phone && <span>📞 {r.phone}</span>}
                          {tableName && <span>🪑 {tableName}</span>}
                          {r.note && <span>📝 {r.note}</span>}
                        </div>
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: `${STATUS_COLOR[r.status]}18`, color: STATUS_COLOR[r.status], whiteSpace: 'nowrap', marginLeft: 8 }}>
                        {STATUS_LABEL[r.status]}
                      </span>
                    </div>
                    {r.status === 'confirmed' && (
                      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                        <button onClick={() => handleStatus(r.id, 'seated')}
                          style={{ flex: 1, padding: '6px', fontSize: 12, background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: 6, cursor: 'pointer' }}>
                          案内済にする
                        </button>
                        <button onClick={() => handleStatus(r.id, 'cancelled')}
                          style={{ flex: 1, padding: '6px', fontSize: 12, background: '#fff', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 6, cursor: 'pointer' }}>
                          取消
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
