import { useNavigate } from 'react-router-dom'
import { useCart } from '../contexts/CartContext'

export default function CustomerBottomNav({
  current,
  menuDisabled = false,
}) {
  const navigate = useNavigate()
  const { count } = useCart()

  function itemClassName({ active = false, disabled = false }) {
    return [
      'customer-bottom-nav__item',
      active ? 'is-active' : '',
      disabled ? 'is-disabled' : '',
    ].filter(Boolean).join(' ')
  }

  return (
    <nav className="customer-bottom-nav" aria-label="注文画面のメインメニュー">
      <div className="customer-bottom-nav__inner">
        <button
          type="button"
          onClick={() => !menuDisabled && navigate('../menu')}
          disabled={menuDisabled}
          className={itemClassName({ active: current === 'menu', disabled: menuDisabled })}
        >
          メニュー
        </button>
        <button
          type="button"
          onClick={() => navigate('../cart')}
          className={itemClassName({ active: current === 'cart' })}
        >
          <span>カート</span>
          {count > 0 && <span className="customer-bottom-nav__badge">{count}</span>}
        </button>
        <button
          type="button"
          onClick={() => navigate('../complete')}
          className={itemClassName({ active: current === 'history' })}
        >
          履歴・会計
        </button>
      </div>
    </nav>
  )
}
