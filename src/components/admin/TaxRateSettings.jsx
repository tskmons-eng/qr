import { calculateIncludedTax } from '../../lib/settingsConfig'

export default function TaxRateSettings({ taxRate, taxInput, presets, onPreset, onInput }) {
  return (
    <>
      <h2 className="admin-settings__heading">税率設定</h2>
      <div className="admin-settings__panel">
        <div className="admin-settings__description">
          会計画面・注文確認に消費税の内訳を表示します（内税表示）。0%にすると非表示。
        </div>
        <div className="admin-settings__tax-controls">
          {presets.map(value => (
            <button
              type="button"
              key={value}
              onClick={() => onPreset(value)}
              className={`admin-settings__tax-preset${taxRate === value ? ' is-active' : ''}`}
            >
              {value}%
            </button>
          ))}
          <div className="admin-settings__tax-input-wrap">
            <input
              type="number"
              value={taxInput}
              onChange={event => onInput(event.target.value)}
              min="0"
              max="100"
              className="admin-settings__tax-input"
            />
            <span className="admin-settings__tax-unit">%</span>
          </div>
        </div>
        <div className="admin-settings__current-tax">
          現在の設定: <strong>{taxRate}%</strong>
          {taxRate > 0 && (
            <span className="admin-settings__included-tax">
              （¥1,000の場合 うち税 ¥{calculateIncludedTax(1000, taxRate)}）
            </span>
          )}
        </div>
      </div>
    </>
  )
}
