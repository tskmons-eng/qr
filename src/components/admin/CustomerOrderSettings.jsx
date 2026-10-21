import { CUSTOMER_SETTING_TOGGLES } from '../../lib/settingsConfig'
import SettingsGroup, { SettingSaveStatus, SettingToggleRow } from './SettingsGroup'

// 「お客様の注文」：お客様のスマホに出る画面と、注文の始め方（人数分の自動追加）。
export default function CustomerOrderSettings({ config, products, statuses, onSave }) {
  const guestAutoAdd = config.guestAutoAdd ?? {}
  const selectedProduct = products.find(product => product.id === guestAutoAdd.productId)
  const servedWorkflowEnabled = config.servedWorkflowEnabled !== false

  function saveGuestAutoAdd(statusKey, change) {
    onSave(statusKey, { guestAutoAdd: { ...guestAutoAdd, ...change } })
  }

  return (
    <SettingsGroup title="お客様の注文" lead="お客様のスマホに出る画面と、注文の始め方です。押すとすぐ保存されます。">
      <div className="admin-settings__panel admin-settings__panel--flush">
        {CUSTOMER_SETTING_TOGGLES.map(setting => {
          // 提供済み表示は、提供済み管理が OFF のときは効かない。
          const disabled = setting.key === 'showServedStatus' && !servedWorkflowEnabled
          return (
            <SettingToggleRow
              key={setting.key}
              label={setting.label}
              description={setting.description}
              on={config[setting.key]}
              disabled={disabled}
              dependencyNote="「お店の運用」の提供済み管理がOFFのため使えません"
              status={statuses[setting.key]}
              onToggle={() => onSave(setting.key, { [setting.key]: !config[setting.key] })}
            />
          )
        })}
        <SettingToggleRow
          label="人数分メニュー自動追加"
          description="人数を決めた後、指定メニューを人数分、最初の注文へ追加します（お通しなど）。"
          on={guestAutoAdd.enabled}
          isLast={!guestAutoAdd.enabled}
          status={statuses.guestAutoAddEnabled}
          onToggle={() => saveGuestAutoAdd('guestAutoAddEnabled', { enabled: !guestAutoAdd.enabled })}
        />
        {guestAutoAdd.enabled && (
          <div className="settings-subsection">
            <div className="admin-settings__workflow-grid">
              <select
                value={guestAutoAdd.productId ?? ''}
                onChange={event => {
                  const product = products.find(candidate => candidate.id === event.target.value)
                  saveGuestAutoAdd('guestAutoAddDetail', {
                    productId: product?.id ?? '',
                    productNameSnapshot: product?.name ?? '',
                  })
                }}
                className="admin-settings__product-select"
                aria-label="自動で追加するメニュー"
              >
                <option value="">追加するメニューを選択</option>
                {products.map(product => (
                  <option key={product.id} value={product.id}>
                    {product.name} / ¥{Number(product.price ?? 0).toLocaleString()}
                  </option>
                ))}
              </select>
              <label className="admin-settings__check-row">
                <input
                  type="checkbox"
                  checked={guestAutoAdd.showGuestCountButton !== false}
                  onChange={event => saveGuestAutoAdd('guestAutoAddDetail', { showGuestCountButton: event.target.checked })}
                />
                <span>人数を決める画面に、追加される内容を表示する</span>
              </label>
              {!selectedProduct && (
                <div className="admin-settings__warning">
                  自動追加を使うには、追加するメニューを選択してください。
                </div>
              )}
              <SettingSaveStatus status={statuses.guestAutoAddDetail} />
            </div>
          </div>
        )}
      </div>
    </SettingsGroup>
  )
}
