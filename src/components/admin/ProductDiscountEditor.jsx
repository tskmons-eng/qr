const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

export default function ProductDiscountEditor({
  discountConfig,
  onUpdate,
  onToggleWeekday,
}) {
  return (
    <div className="product-form-section">
      <div className={`product-section-header${discountConfig.enabled ? ' has-content' : ''}`}>
        <div>
          <div className="product-section-title">商品割引</div>
          <div className="product-section-help">今日だけ、期限つき、曜日指定の割引</div>
        </div>
        <button type="button" onClick={() => onUpdate({ enabled: !discountConfig.enabled })} className={`product-section-toggle${discountConfig.enabled ? ' is-active' : ''}`}>
          {discountConfig.enabled ? 'ON' : 'OFF'}
        </button>
      </div>

      {discountConfig.enabled && (
        <div className="discount-editor">
          <div className="discount-type-row">
            <button
              type="button"
              onClick={() => onUpdate({ type: 'amount' })}
              className={`button discount-type-button${discountConfig.type === 'amount' ? ' is-active' : ''}`}
            >
              金額
            </button>
            <button
              type="button"
              onClick={() => onUpdate({ type: 'percent' })}
              className={`button discount-type-button${discountConfig.type === 'percent' ? ' is-active' : ''}`}
            >
              %
            </button>
            <input
              type="number"
              value={discountConfig.value}
              onChange={event => onUpdate({ value: event.target.value })}
              min="0"
              max={discountConfig.type === 'percent' ? '100' : undefined}
              placeholder={discountConfig.type === 'percent' ? '割引率' : '割引額'}
              className="discount-value-input"
            />
          </div>
          <div className="discount-date-grid">
            <label className="discount-date-label">
              開始日
              <input type="date" value={discountConfig.startDate} onChange={event => onUpdate({ startDate: event.target.value })} className="discount-date-input" />
            </label>
            <label className="discount-date-label">
              終了日
              <input type="date" value={discountConfig.endDate} onChange={event => onUpdate({ endDate: event.target.value })} className="discount-date-input" />
            </label>
          </div>
          <div>
            <div className="discount-weekday-label">曜日指定（未選択なら毎日）</div>
            <div className="discount-weekday-row">
              {WEEKDAYS.map((label, day) => {
                const active = (discountConfig.weekdays ?? []).includes(day)
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => onToggleWeekday(day)}
                    className={`button discount-weekday-button${active ? ' is-active' : ''}`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
