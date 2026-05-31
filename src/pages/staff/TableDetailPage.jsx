import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { doc, collection, query, where, onSnapshot, getDocs, updateDoc, addDoc, getDoc, serverTimestamp, increment } from 'firebase/firestore'
import { db, auth } from '../../lib/firebase'
import { useStore } from '../../contexts/StoreContext'
import { useStaffMember } from '../../contexts/StaffMemberContext'
import StaffBottomNav from '../../components/StaffBottomNav'

function formatElapsed(startedAtSeconds, nowMs) {
  const elapsed = Math.floor((nowMs / 1000) - startedAtSeconds)
  if (elapsed < 60) return '1分未満'
  const h = Math.floor(elapsed / 3600)
  const m = Math.floor((elapsed % 3600) / 60)
  if (h > 0) return `${h}時間${m}分`
  return `${m}分`
}

function formatOptions(optionSelections) {
  if (!optionSelections || optionSelections.length === 0) return null
  return optionSelections.map(o => o.choice).join(' · ')
}

export default function TableDetailPage() {
  const { tableId } = useParams()
  const navigate = useNavigate()
  const { storeId } = useStore()
  const { activeStaff } = useStaffMember()
  const [table, setTable] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(id)
  }, [])

  // キャンセルモーダル
  const [cancelTarget, setCancelTarget] = useState(null)
  const [passcode, setPasscode] = useState('')
  const [passcodeError, setPasscodeError] = useState('')
  const [cancelling, setCancelling] = useState(false)

  // 着席
  const [seatCount, setSeatCount] = useState(2)
  const [seating, setSeating] = useState(false)

  // 人数調整
  const [editingGuests, setEditingGuests] = useState(false)
  const [guestInput, setGuestInput] = useState('')

  // 席移動モーダル
  const [showMoveModal, setShowMoveModal] = useState(false)
  const [vacantTables, setVacantTables] = useState([])
  const [moving, setMoving] = useState(false)

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'tables', tableId), snap => {
      if (snap.exists()) setTable({ id: snap.id, ...snap.data() })
      setLoading(false)
    })
    return unsub
  }, [tableId])

  useEffect(() => {
    if (!table?.currentOrderId) { setItems([]); return }
    const q = query(collection(db, 'orderItems'), where('orderId', '==', table.currentOrderId))
    return onSnapshot(q, snap => {
      const data = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(i => i.itemStatus !== 'cancelled')
        .sort((a, b) => (a.orderedAt?.seconds ?? 0) - (b.orderedAt?.seconds ?? 0))
      setItems(data)
    })
  }, [table?.currentOrderId])

  async function markServed(item) {
    await updateDoc(doc(db, 'orderItems', item.id), { itemStatus: 'served', updatedAt: serverTimestamp() })
    await updateDoc(doc(db, 'tables', tableId), { pendingCount: increment(-1), updatedAt: serverTimestamp() })
  }

  async function markOrdered(item) {
    await updateDoc(doc(db, 'orderItems', item.id), { itemStatus: 'ordered', updatedAt: serverTimestamp() })
    await updateDoc(doc(db, 'tables', tableId), { pendingCount: increment(1), updatedAt: serverTimestamp() })
  }

  function openCancel(item) {
    setCancelTarget(item)
    setPasscode('')
    setPasscodeError('')
  }

  async function handleCancel() {
    if (!cancelTarget || cancelling) return
    setCancelling(true)
    setPasscodeError('')
    try {
      const storeSnap = await getDoc(doc(db, 'stores', table.storeId))
      if (storeSnap.data()?.adminPasscode !== passcode) {
        setPasscodeError('パスコードが違います')
        setCancelling(false)
        return
      }
      const actor = auth.currentUser
      await updateDoc(doc(db, 'orderItems', cancelTarget.id), {
        itemStatus: 'cancelled',
        updatedAt: serverTimestamp(),
      })
      if (cancelTarget.itemStatus === 'ordered') {
        await updateDoc(doc(db, 'tables', tableId), { pendingCount: increment(-1), updatedAt: serverTimestamp() })
      }
      await addDoc(collection(db, 'staffActions'), {
        storeId: table.storeId,
        actionType: 'cancel_item',
        targetType: 'orderItem',
        targetId: cancelTarget.id,
        actorType: 'staff',
        actorStaffId: activeStaff?.id ?? null,
        actorStaffName: activeStaff?.name ?? null,
        actorUid: actor?.uid ?? null,
        note: `${cancelTarget.productNameSnapshot} × ${cancelTarget.quantity} をキャンセル`,
        createdAt: serverTimestamp(),
      })
      setCancelTarget(null)
    } catch {
      setPasscodeError('エラーが発生しました')
    } finally {
      setCancelling(false)
    }
  }

  // 着席
  async function handleSeat() {
    if (seating) return
    setSeating(true)
    try {
      const now = serverTimestamp()
      const orderRef = await addDoc(collection(db, 'orders'), {
        storeId: table.storeId,
        tableId,
        guestCount: seatCount,
        status: 'open',
        openedAt: now,
        checkedOutAt: null,
        createdBy: 'staff',
        updatedAt: now,
      })
      await updateDoc(doc(db, 'tables', tableId), {
        status: 'occupied',
        guestCount: seatCount,
        currentOrderId: orderRef.id,
        startedAt: now,
        pendingCount: 0,
        updatedAt: now,
      })
      await addDoc(collection(db, 'staffActions'), {
        storeId: table.storeId,
        actionType: 'seat_guests',
        targetType: 'table',
        targetId: tableId,
        actorType: 'staff',
        actorStaffId: activeStaff?.id ?? null,
        actorStaffName: activeStaff?.name ?? null,
        note: `${seatCount}名着席`,
        createdAt: now,
      })
    } catch {
      alert('エラーが発生しました')
    } finally {
      setSeating(false)
    }
  }

  // 人数変更
  function startEditGuests() {
    setGuestInput(String(table.guestCount ?? 0))
    setEditingGuests(true)
  }

  async function saveGuests() {
    const n = parseInt(guestInput, 10)
    if (isNaN(n) || n < 0) { setEditingGuests(false); return }
    await updateDoc(doc(db, 'tables', tableId), { guestCount: n, updatedAt: serverTimestamp() })
    await addDoc(collection(db, 'staffActions'), {
      storeId: table.storeId,
      actionType: 'adjust_guests',
      targetType: 'table',
      targetId: tableId,
      actorType: 'staff',
      actorStaffId: activeStaff?.id ?? null,
      actorStaffName: activeStaff?.name ?? null,
      note: `人数変更 ${table.guestCount}名 → ${n}名`,
      createdAt: serverTimestamp(),
    })
    setEditingGuests(false)
  }

  // 席移動
  async function openMoveModal() {
    const snap = await getDocs(query(collection(db, 'tables'), where('storeId', '==', storeId), where('status', '==', 'vacant')))
    setVacantTables(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => t.id !== tableId).sort((a, b) => a.tableName.localeCompare(b.tableName, 'ja')))
    setShowMoveModal(true)
  }

  async function handleMove(targetTable) {
    if (moving) return
    setMoving(true)
    try {
      const now = serverTimestamp()
      await updateDoc(doc(db, 'tables', tableId), {
        status: 'vacant',
        currentOrderId: null,
        guestCount: 0,
        startedAt: null,
        pendingCount: 0,
        updatedAt: now,
      })
      await updateDoc(doc(db, 'tables', targetTable.id), {
        status: 'occupied',
        currentOrderId: table.currentOrderId,
        guestCount: table.guestCount,
        startedAt: table.startedAt ?? null,
        pendingCount: table.pendingCount ?? 0,
        updatedAt: now,
      })
      await addDoc(collection(db, 'staffActions'), {
        storeId: table.storeId,
        actionType: 'move_table',
        targetType: 'table',
        targetId: targetTable.id,
        actorType: 'staff',
        actorStaffId: activeStaff?.id ?? null,
        actorStaffName: activeStaff?.name ?? null,
        note: `${table.tableName} → ${targetTable.tableName} に移動`,
        createdAt: now,
      })
      navigate(`/staff/table/${targetTable.id}`, { replace: true })
    } catch {
      alert('移動に失敗しました')
      setMoving(false)
    }
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 48, color: '#999' }}>読み込み中...</div>
  if (!table) return <div style={{ textAlign: 'center', padding: 48, color: '#dc2626' }}>席が見つかりません</div>

  const orderedItems = items.filter(i => i.itemStatus === 'ordered')
  const servedItems = items.filter(i => i.itemStatus === 'served')
  const total = items.reduce((sum, i) => sum + i.lineTotal, 0)
  const hasOrder = !!table.currentOrderId
  const guestCount = table.guestCount ?? 0

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', paddingBottom: 156 }}>

      {/* キャンセル確認モーダル */}
      {cancelTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 24 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: '100%', maxWidth: 340 }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>注文をキャンセル</h3>
            <p style={{ fontSize: 14, color: '#555', margin: '0 0 20px' }}>
              「{cancelTarget.productNameSnapshot} × {cancelTarget.quantity}」をキャンセルします。
            </p>
            <label style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>管理者パスコード</label>
            <input
              type="password"
              inputMode="numeric"
              value={passcode}
              onChange={e => setPasscode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCancel()}
              placeholder="パスコード"
              style={{ width: '100%', padding: '10px 12px', fontSize: 18, textAlign: 'center', border: '1px solid #ddd', borderRadius: 8, letterSpacing: 6, boxSizing: 'border-box', marginBottom: 4 }}
            />
            {passcodeError && <p style={{ color: '#dc2626', fontSize: 13, margin: '4px 0 8px' }}>{passcodeError}</p>}
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={() => setCancelTarget(null)} style={{ flex: 1, padding: '11px', fontSize: 14, background: '#fff', border: '1px solid #ddd', borderRadius: 8, cursor: 'pointer' }}>
                戻る
              </button>
              <button onClick={handleCancel} disabled={cancelling} style={{ flex: 1, padding: '11px', fontSize: 14, background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                {cancelling ? '処理中...' : 'キャンセル確定'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 席移動モーダル */}
      {showMoveModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 24 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: '100%', maxWidth: 360, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>席移動</h3>
            <p style={{ fontSize: 13, color: '#888', margin: '0 0 16px' }}>移動先の空席を選んでください</p>
            {vacantTables.length === 0 ? (
              <p style={{ color: '#bbb', textAlign: 'center', padding: '24px 0' }}>空席がありません</p>
            ) : (
              <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {vacantTables.map(t => (
                  <button
                    key={t.id}
                    onClick={() => handleMove(t)}
                    disabled={moving}
                    style={{ width: '100%', padding: '14px', fontSize: 15, fontWeight: 600, background: '#f8f8f8', border: '2px solid #e5e5e5', borderRadius: 10, cursor: 'pointer', textAlign: 'left' }}
                  >
                    {t.tableName}
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => setShowMoveModal(false)}
              style={{ marginTop: 16, width: '100%', padding: '11px', fontSize: 14, background: '#fff', border: '1px solid #ddd', borderRadius: 8, cursor: 'pointer' }}
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* ヘッダー */}
      <div style={{ background: '#fff', padding: '12px 16px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => navigate('/staff')} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#444' }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>{table.tableName}</div>
          {hasOrder && (
            editingGuests ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <button onClick={() => setGuestInput(v => String(Math.max(0, parseInt(v || '0') - 1)))} style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid #ddd', background: '#f5f5f5', fontSize: 16, cursor: 'pointer' }}>−</button>
                <input
                  type="number"
                  value={guestInput}
                  onChange={e => setGuestInput(e.target.value)}
                  style={{ width: 48, textAlign: 'center', fontSize: 15, border: '1px solid #ddd', borderRadius: 6, padding: '2px 4px' }}
                />
                <span style={{ fontSize: 13, color: '#555' }}>名</span>
                <button onClick={() => setGuestInput(v => String(parseInt(v || '0') + 1))} style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid #ddd', background: '#f5f5f5', fontSize: 16, cursor: 'pointer' }}>+</button>
                <button onClick={saveGuests} style={{ padding: '4px 12px', fontSize: 13, background: '#222', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>保存</button>
                <button onClick={() => setEditingGuests(false)} style={{ padding: '4px 10px', fontSize: 13, background: '#fff', color: '#888', border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer' }}>戻る</button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <span style={{ fontSize: 13, color: '#888' }}>{guestCount}名</span>
                {table.startedAt?.seconds && (
                  <span style={{ fontSize: 12, color: '#bbb' }}>· {formatElapsed(table.startedAt.seconds, now)}</span>
                )}
                <button onClick={startEditGuests} style={{ fontSize: 11, color: '#aaa', background: 'none', border: '1px solid #e5e5e5', borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}>変更</button>
              </div>
            )
          )}
        </div>
      </div>

      {!hasOrder ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 32px', gap: 24 }}>
          <p style={{ color: '#bbb', margin: 0 }}>現在注文はありません</p>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, width: '100%', maxWidth: 280 }}>
            <p style={{ fontSize: 14, color: '#888', margin: 0 }}>何名様ですか？</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              <button onClick={() => setSeatCount(c => Math.max(1, c - 1))} style={{ width: 44, height: 44, borderRadius: '50%', border: '1px solid #ddd', fontSize: 22, cursor: 'pointer', background: '#fff' }}>−</button>
              <span style={{ fontSize: 42, fontWeight: 700, minWidth: 52, textAlign: 'center' }}>{seatCount}</span>
              <button onClick={() => setSeatCount(c => Math.min(20, c + 1))} style={{ width: 44, height: 44, borderRadius: '50%', border: '1px solid #ddd', fontSize: 22, cursor: 'pointer', background: '#fff' }}>+</button>
            </div>
            <button
              onClick={handleSeat}
              disabled={seating}
              style={{ width: '100%', padding: '14px', fontSize: 15, fontWeight: 700, background: '#222', color: '#fff', border: 'none', borderRadius: 10, cursor: seating ? 'default' : 'pointer' }}
            >
              {seating ? '処理中...' : `${seatCount}名で着席する`}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* 準備中 */}
          {orderedItems.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ padding: '8px 16px', fontSize: 12, color: '#888', fontWeight: 600 }}>準備中</div>
              <div style={{ background: '#fff' }}>
                {orderedItems.map(item => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', padding: '13px 16px', borderBottom: '1px solid #f5f5f5', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 15 }}>{item.productNameSnapshot} × {item.quantity}</span>
                        {item.categoryGroup === 'drink' && <span style={{ fontSize: 10, background: '#0ea5e9', color: '#fff', borderRadius: 4, padding: '1px 5px' }}>🥤</span>}
                        {item.categoryGroup === 'food' && <span style={{ fontSize: 10, background: '#f97316', color: '#fff', borderRadius: 4, padding: '1px 5px' }}>🍽</span>}
                      </div>
                      {formatOptions(item.optionSelections) && (
                        <div style={{ fontSize: 12, color: '#1d4ed8', marginTop: 2 }}>{formatOptions(item.optionSelections)}</div>
                      )}
                      <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                        ¥{item.lineTotal.toLocaleString()} · {item.orderedBy === 'staff' ? 'スタッフ' : 'お客様'}
                      </div>
                    </div>
                    <button onClick={() => markServed(item)} style={{ padding: '6px 12px', fontSize: 13, background: '#222', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      提供済み
                    </button>
                    <button onClick={() => openCancel(item)} style={{ padding: '6px 10px', fontSize: 13, background: '#fff', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      削除
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 提供済み */}
          {servedItems.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ padding: '8px 16px', fontSize: 12, color: '#888', fontWeight: 600 }}>提供済み</div>
              <div style={{ background: '#fff' }}>
                {servedItems.map(item => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', padding: '13px 16px', borderBottom: '1px solid #f5f5f5', gap: 10, opacity: 0.6 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 15 }}>{item.productNameSnapshot} × {item.quantity}</span>
                        {item.categoryGroup === 'drink' && <span style={{ fontSize: 10, background: '#0ea5e9', color: '#fff', borderRadius: 4, padding: '1px 5px' }}>🥤</span>}
                        {item.categoryGroup === 'food' && <span style={{ fontSize: 10, background: '#f97316', color: '#fff', borderRadius: 4, padding: '1px 5px' }}>🍽</span>}
                      </div>
                      {formatOptions(item.optionSelections) && (
                        <div style={{ fontSize: 12, color: '#1d4ed8', marginTop: 2 }}>{formatOptions(item.optionSelections)}</div>
                      )}
                      <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>¥{item.lineTotal.toLocaleString()}</div>
                    </div>
                    <button onClick={() => markOrdered(item)} style={{ padding: '6px 12px', fontSize: 12, background: '#fff', color: '#888', border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      戻す
                    </button>
                    <button onClick={() => openCancel(item)} style={{ padding: '6px 10px', fontSize: 12, background: '#fff', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      削除
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ background: '#fff', marginTop: 12, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700 }}>
            <span>合計</span>
            <span>¥{total.toLocaleString()}</span>
          </div>
          {guestCount > 0 && (
            <div style={{ background: '#fff', marginTop: 1, padding: '10px 16px', display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#888' }}>
              <span>客単価</span>
              <span>¥{Math.round(total / guestCount).toLocaleString()}</span>
            </div>
          )}
        </>
      )}

      <div style={{ position: 'fixed', bottom: 74, left: 0, right: 0, background: '#fff', borderTop: '1px solid #eee', padding: '10px 16px', display: 'flex', gap: 8, zIndex: 44 }}>
        {hasOrder && (
          <button
            onClick={openMoveModal}
            style={{ flex: 1, padding: '13px', fontSize: 14, background: '#fff', color: '#555', border: '1px solid #ddd', borderRadius: 10, cursor: 'pointer' }}
          >
            席移動
          </button>
        )}
        {hasOrder && (
          <button
            onClick={() => navigate(`/staff/table/${tableId}/add-order`, { state: { orderId: table.currentOrderId, storeId: table.storeId, guestCount: table.guestCount } })}
            style={{ flex: 1, padding: '13px', fontSize: 14, background: '#fff', color: '#222', border: '2px solid #222', borderRadius: 10, cursor: 'pointer' }}
          >
            + 注文追加
          </button>
        )}
      </div>
      <StaffBottomNav
        current="seat"
        tableId={tableId}
        orderId={table.currentOrderId}
        storeId={table.storeId}
        guestCount={table.guestCount}
        pendingCount={orderedItems.length}
      />
    </div>
  )
}
