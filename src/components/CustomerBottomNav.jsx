import { useNavigate } from 'react-router-dom'

// お客様の下のタブ（2026-10-28 注文の流れ 第2章）。カートはメニューの下の青い帯から開くので、タブは2つ。
export default function CustomerBottomNav({
  current,
  menuDisabled = false,
}) {
  const navigate = useNavigate()

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
          onClick={() => navigate('../complete')}
          className={itemClassName({ active: current === 'history' })}
        >
          注文履歴・お会計
        </button>
      </div>
    </nav>
  )
}
