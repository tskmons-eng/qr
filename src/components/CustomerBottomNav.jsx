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
      action: onCall,
    },
    checkout: {
      title: '会計を出しますか？',
      message: checkoutConfirmMessage ?? 'スタッフに会計希望を送ります。',
      confirmText: '会計を依頼する',
      action: onCheckout ?? (() => navigate('../complete')),
    },
  }

  function itemClassName({ active = false, disabled = false, variant = '' }) {
    return [
      'customer-bottom-nav__item',
      variant ? `customer-bottom-nav__item--${variant}` : '',
      active ? 'is-active' : '',
      disabled ? 'is-disabled' : '',
    ].filter(Boolean).join(' ')
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
      <nav className="customer-bottom-nav">
        <div className="customer-bottom-nav__inner">
          <button
            type="button"
            onClick={() => !menuDisabled && navigate('../menu')}
            disabled={menuDisabled}
            className={itemClassName({ active: current === 'menu', disabled: menuDisabled })}
          >
            <span className="customer-bottom-nav__icon">注文</span>
            <span>メニュー</span>
          </button>
          {!hideCart && (
            <button
              type="button"
              onClick={() => navigate('../cart')}
              className={itemClassName({ active: current === 'cart' })}
            >
              <span className="customer-bottom-nav__icon">カート</span>
              <span>{count > 0 ? `${count}点 ¥${total.toLocaleString()}` : '確認'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => openConfirm('call')}
            disabled={callDisabled}
            className={itemClassName({ disabled: callDisabled, variant: 'call' })}
          >
            <span className="customer-bottom-nav__icon">呼出</span>
            <span>{callDisabled ? '送信済' : '確認して呼ぶ'}</span>
          </button>
          <button
            type="button"
            onClick={() => openConfirm('checkout')}
            disabled={checkoutDisabled}
            className={itemClassName({ active: current === 'checkout', disabled: checkoutDisabled, variant: 'checkout' })}
          >
            <span className="customer-bottom-nav__icon">会計</span>
            <span>{checkoutDisabled ? '送信済' : '確認して依頼'}</span>
          </button>
        </div>
      </nav>

      {currentConfirm && (
        <div className="customer-bottom-confirm">
          <div className={`customer-bottom-confirm__panel customer-bottom-confirm__panel--${confirming}`}>
            <div className="customer-bottom-confirm__header">
              <div className="customer-bottom-confirm__icon">
                {confirming === 'call' ? '呼' : '¥'}
              </div>
              <div>
                <div className="customer-bottom-confirm__title">{currentConfirm.title}</div>
                <div className="customer-bottom-confirm__message">{currentConfirm.message}</div>
              </div>
            </div>
            <div className="customer-bottom-confirm__actions">
              <button
                type="button"
                onClick={() => setConfirming(null)}
                disabled={sending}
                className="customer-bottom-confirm__button"
              >
                戻る
              </button>
              <button
                type="button"
                onClick={runConfirmedAction}
                disabled={sending}
                className="customer-bottom-confirm__button customer-bottom-confirm__button--primary"
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
