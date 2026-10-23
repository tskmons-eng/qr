import { describeDiscount } from '../../lib/productForm'

// 期間割引（2026-10-23 商品設計）。金額か％、期間、曜日。
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

export default function MenuDiscountEditor({ discountConfig, onChange }) {
  const update = patch => onChange({ ...discountConfig, ...patch })
  const toggleWeekday = day => {
    const current = discountConfig.weekdays ?? []
    update({ weekdays: current.includes(day) ? current.filter(item => item !== day) : [...current, day].sort((a, b) => a - b) })
  }

  return (
    <div className="menu-sheet__box">
      <div className="menu-sheet__box-head">
        <b>期間割引</b>
        <button
          type="button"
          role="switch"
          aria-checked={discountConfig.enabled}
          onClick={() => update({ enabled: !discountConfig.enabled })}
          className={`menu-switch${discountConfig.enabled ? ' is-on' : ''}`}
          aria-label="期間割引"
        />
      </div>
      {discountConfig.enabled && (
        <div className="menu-discount">
          <div className="menu-discount__row">
            <input
              value={discountConfig.value}
              onChange={event => update({ value: event.target.value.replace(/[^0-9]/g, '') })}
              inputMode="numeric"
              placeholder="100"
              className="menu-sheet__input menu-discount__value"
            />
            <div className="menu-seg">
              <button type="button" onClick={() => update({ type: 'amount' })} className={discountConfig.type !== 'percent' ? 'is-on' : ''}>円引き</button>
              <button type="button" onClick={() => update({ type: 'percent' })} className={discountConfig.type === 'percent' ? 'is-on' : ''}>％引き</button>
            </div>
          </div>
          <div className="menu-discount__row">
            <input type="date" value={discountConfig.startDate} onChange={event => update({ startDate: event.target.value })} className="menu-sheet__input" aria-label="始める日" />
            <span>〜</span>
            <input type="date" value={discountConfig.endDate} onChange={event => update({ endDate: event.target.value })} className="menu-sheet__input" aria-label="終わる日" />
          </div>
          <div className="menu-discount__days">
            {WEEKDAYS.map((label, day) => (
              <button key={label} type="button" onClick={() => toggleWeekday(day)} className={(discountConfig.weekdays ?? []).includes(day) ? 'is-on' : ''}>{label}</button>
            ))}
          </div>
          <p className="menu-sheet__note">{describeDiscount({ ...discountConfig, value: Number(discountConfig.value) || 0 }) || '値引きの額を入れてください'}（曜日を選ばなければ毎日。日付が空なら期限なし）</p>
        </div>
      )}
    </div>
  )
}
