import { STAFF_ROLE_CARDS } from '../../lib/staffPermissions'

// 役割を選ぶカード（追加と詳細で共通。2026-10-23）。押したら選ぶ（詳細ではすぐ保存）。
export default function StaffRoleCards({ value, onChange, disabled = false }) {
  return (
    <div className="staff-role-cards" role="radiogroup" aria-label="役割">
      {STAFF_ROLE_CARDS.map(card => (
        <button
          key={card.key}
          type="button"
          role="radio"
          aria-checked={value === card.key}
          disabled={disabled}
          onClick={() => onChange(card.key)}
          className={`staff-role-card${value === card.key ? ' is-selected' : ''}`}
        >
          <b>{card.label}</b>
          <span>{card.hint}</span>
        </button>
      ))}
    </div>
  )
}
