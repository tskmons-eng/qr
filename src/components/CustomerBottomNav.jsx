import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCart } from '../contexts/CartContext'

export default function CustomerBottomNav({
  current,
  onCall,
  callDisabled = false,
  onCheckout,
  menuDisabled = false,
  hideCart = false,
  checkoutDisabled = false,
  checkoutConfirmMessage,
}) {
  const navigate = useNavigate()
  const { count, total } = useCart()
  const [confirming, setConfirming] = useState(null)
  const [sending, setSending] = useState(false)

  const actionConfig = {
    call: {
      title: 'スタッフを呼びますか？',
      message: 'スタッフに呼び出し通知を送ります。',
      confirmText: '呼び出す',
      color: '#ea580c',
      bg: '#fff7ed',
      border: '#fed7aa',
      action: onCall,
    },
    checkout: {
      title: '会計を出しますか？',
      message: checkoutConfirmMessage ?? 'スタッフに会計希望を送ります。',
      confirmText: '会計を依頼する',
      color: '#2563eb',
      bg: '#eff6ff',
      border: '#bfdbfe',
      action: onCheckout ?? (() => navigate('../complete')),
    },
  }

  const itemStyle = (active, variant = 'default') => {
    const colors = {
      default: { color: '#555', bg: 'transparent', border: 'transparent', active: '#222' },
      call: { color: '#c2410c', bg: '#fff7ed', border: '#fed7aa', active: '#ea580c' },
      checkout: { color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe', active: '#2563eb' },
    }[variant]

    return {
    flex: 1,
    minWidth: 0,
    border: `1px solid ${active ? colors.active : colors.border}`,
    borderRadius: 12,
    padding: '8px 4px',
    background: active ? colors.active : colors.bg,
    color: active ? '#fff' : colors.color,
    fontSize: 12,
    fontWeight: active ? 800 : 700,
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    opacity: active ? 1 : 0.92,
    }
  }

  const disabledStyle = {
    opacity: 0.35,
    cursor: 'not-allowed',
  }

  function openConfirm(type) {
    if (type === 'call' && callDisabled) return
    if (type === 'checkout' && checkoutDisabled) return
    setConfirming(type)
  }

  async function runConfirmedAction() {
    const config = actionConfig[confirming]
    if (!config?.action) return
    setSending(true)
    try {
      await config.action()
      setConfirming(null)
    } finally {
      setSending(false)
    }
  }

  const currentConfirm = confirming ? actionConfig[confirming] : null

  return (
    <>
      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 45, background: 'rgba(255,255,255,0.96)', borderTop: '1px solid #e5e5e5', backdropFilter: 'blur(12px)' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', padding: '8px 10px 10px', display: 'flex', gap: 6 }}>
          <button
            type="button"
            onClick={() => !menuDisabled && navigate('../menu')}
            disabled={menuDisabled}
            style={{ ...itemStyle(current === 'menu'), ...(menuDisabled ? disabledStyle : {}) }}
          >
            <span style={{ fontSize: 18 }}>注文</span>
            <span>メニュー</span>
          </button>
          {!hideCart && (
            <button
              type="button"
              onClick={() => navigate('../cart')}
              style={itemStyle(current === 'cart')}
            >
              <span style={{ fontSize: 18 }}>カート</span>
              <span>{count > 0 ? `${count}点 ¥${total.toLocaleString()}` : '確認'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => openConfirm('call')}
            disabled={callDisabled}
            style={{ ...itemStyle(false, 'call'), ...(callDisabled ? disabledStyle : {}) }}
          >
            <span style={{ fontSize: 18 }}>呼出</span>
            <span>{callDisabled ? '送信済' : '確認して呼ぶ'}</span>
          </button>
          <button
            type="button"
            onClick={() => openConfirm('checkout')}
            disabled={checkoutDisabled}
            style={{ ...itemStyle(current === 'checkout', 'checkout'), ...(checkoutDisabled ? disabledStyle : {}) }}
          >
            <span style={{ fontSize: 18 }}>会計</span>
            <span>{checkoutDisabled ? '送信済' : '確認して依頼'}</span>
          </button>
        </div>
      </nav>

      {currentConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(15,23,42,0.38)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 14 }}>
          <div style={{ width: '100%', maxWidth: 560, background: '#fff', borderRadius: 18, padding: 18, boxShadow: '0 18px 45px rgba(15,23,42,0.25)', border: `2px solid ${currentConfirm.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: currentConfirm.bg, color: currentConfirm.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 900 }}>
                {confirming === 'call' ? '呼' : '¥'}
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#111827' }}>{currentConfirm.title}</div>
                <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>{currentConfirm.message}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button
                type="button"
                onClick={() => setConfirming(null)}
                disabled={sending}
                style={{ flex: 1, padding: '13px 12px', borderRadius: 12, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontSize: 15, fontWeight: 800, cursor: sending ? 'default' : 'pointer' }}
              >
                戻る
              </button>
              <button
                type="button"
                onClick={runConfirmedAction}
                disabled={sending}
                style={{ flex: 1.35, padding: '13px 12px', borderRadius: 12, border: 'none', background: currentConfirm.color, color: '#fff', fontSize: 15, fontWeight: 900, cursor: sending ? 'default' : 'pointer' }}
              >
                {sending ? '送信中...' : currentConfirm.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
