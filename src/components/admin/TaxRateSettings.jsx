import { useEffect, useState } from 'react'
import { TAX_PRESETS, calculateIncludedTax } from '../../lib/settingsConfig'
import { SettingSaveStatus } from './SettingsGroup'

function parseTaxRate(value) {
  const taxRate = parseFloat(value)
  return !Number.isNaN(taxRate) && taxRate >= 0 && taxRate <= 100 ? taxRate : null
}

// 0・8・10% のボタンは押したらすぐ保存。数字を打ったときだけ「保存」を押す。
export default function TaxRateSettings({ taxRate, status, onSave }) {
  const [taxInput, setTaxInput] = useState(String(taxRate))
  const inputRate = parseTaxRate(taxInput)

  useEffect(() => {
    setTaxInput(String(taxRate))
  }, [taxRate])

  return (
    <div className="settings-subsection">
      <div className="settings-subsection__title">税率</div>
      <div className="admin-settings__description">
        会計画面に内税の内訳を表示します。0%にすると表示しません。
      </div>
      <div className="admin-settings__tax-controls">
        {TAX_PRESETS.map(value => (
          <button
            type="button"
            key={value}
            onClick={() => onSave({ taxRate: value })}
            className={`admin-settings__tax-preset${taxRate === value ? ' is-active' : ''}`}
          >
            {value}%
          </button>
        ))}
        <div className="settings-inline-save">
          <div className="admin-settings__tax-input-wrap">
            <input
              type="number"
              value={taxInput}
              onChange={event => setTaxInput(event.target.value)}
              min="0"
              max="100"
              className="admin-settings__tax-input"
              aria-label="税率（%）"
            />
            <span className="admin-settings__tax-unit">%</span>
          </div>
          <button
            type="button"
            onClick={() => onSave({ taxRate: inputRate })}
            disabled={inputRate === null || inputRate === taxRate}
            className="admin-settings__store-name-save"
          >
            保存
          </button>
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
      <SettingSaveStatus status={status} />
    </div>
  )
}
