import { useNavigate } from 'react-router-dom'

export default function StaffBottomNav({
  current,
  tableId,
  orderId,
  storeId,
  guestCount,
  pendingCount = 0,
}) {
  const navigate = useNavigate()
  const hasTable = !!tableId
  const hasOrder = !!orderId

  const itemStyle = active => ({
    flex: 1,
    minWidth: 0,
    border: 'none',
    borderRadius: 12,
    padding: '8px 4px',
    background: active ? '#111827' : 'transparent',
    color: active ? '#fff' : '#374151',
    fontSize: 12,
    fontWeight: active ? 800 : 700,
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  })

  const disabledStyle = {
    opacity: 0.35,
    cursor: 'not-allowed',
  }

  const checkoutState = { orderId, storeId, guestCount }

  return (
    <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 45, background: 'rgba(255,255,255,0.96)', borderTop: '1px solid #e5e7eb', backdropFilter: 'blur(12px)' }}>
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '8px 10px 10px', display: 'flex', gap: 6 }}>
        <button
          type="button"
          onClick={() => navigate(hasTable ? `/staff/table/${tableId}` : '/staff')}
          style={itemStyle(current === 'seat')}
        >
          <span style={{ fontSize: 18 }}>席</span>
          <span>戻る</span>
        </button>
        <button
          type="button"
          onClick={() => navigate('/staff/kitchen')}
          style={itemStyle(current === 'kitchen')}
        >
          <span style={{ fontSize: 18 }}>厨房</span>
          <span>パネル</span>
        </button>
        <button
          type="button"
          onClick={() => hasOrder && navigate(`/staff/table/${tableId}/remaining`, { state: { orderId, storeId } })}
          disabled={!hasOrder}
          style={{ ...itemStyle(current === 'remaining'), ...(!hasOrder ? disabledStyle : {}) }}
        >
          <span style={{ fontSize: 18 }}>残り</span>
          <span>{pendingCount > 0 ? `${pendingCount}点` : '確認'}</span>
        </button>
        <button
          type="button"
          onClick={() => hasOrder && navigate(`/staff/table/${tableId}/checkout`, { state: checkoutState })}
          disabled={!hasOrder}
          style={{ ...itemStyle(current === 'checkout'), ...(!hasOrder ? disabledStyle : {}) }}
        >
          <span style={{ fontSize: 18 }}>会計</span>
          <span>精算</span>
        </button>
      </div>
    </nav>
  )
}
