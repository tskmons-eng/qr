export default function StoreWorkflowSettings({
  config,
  products,
  toggles,
  onGuestAutoAddChange,
  onToggle,
}) {
  const guestAutoAdd = config.guestAutoAdd ?? {}
  const selectedProduct = products.find(product => product.id === guestAutoAdd.productId)

  return (
    <>
      <h2 className="admin-settings__heading admin-settings__heading--spaced">店舗運用の設定</h2>
      <div className="admin-settings__panel admin-settings__panel--flush">
        {toggles.map(setting => (
          <div key={setting.key} className="admin-settings__toggle-row">
            <div className="admin-settings__toggle-copy">
              <div className="admin-settings__toggle-label">{setting.label}</div>
              <div className="admin-settings__toggle-description">{setting.description}</div>
            </div>
            <button
              type="button"
              onClick={() => onToggle(setting.key)}
              className={`admin-settings__switch${config[setting.key] ? ' is-on' : ''}`}
              aria-pressed={Boolean(config[setting.key])}
            >
              <span className="admin-settings__switch-knob" />
            </button>
          </div>
        ))}
        <div className="admin-settings__workflow-block">
          <div className="admin-settings__toggle-copy">
            <div className="admin-settings__toggle-label">人数分メニュー自動追加</div>
            <div className="admin-settings__toggle-description">
              人数設定後に指定メニューを人数分、最初の注文へ追加します。既定はOFFです。
            </div>
          </div>
          <div className="admin-settings__workflow-grid">
            <label className="admin-settings__check-row">
              <input
                type="checkbox"
                checked={Boolean(guestAutoAdd.enabled)}
                onChange={event => onGuestAutoAddChange({ enabled: event.target.checked })}
              />
              <span>自動追加を有効にする</span>
            </label>
            <label className="admin-settings__check-row">
              <input
                type="checkbox"
                checked={guestAutoAdd.showGuestCountButton !== false}
                onChange={event => onGuestAutoAddChange({ showGuestCountButton: event.target.checked })}
              />
              <span>人数設定画面に追加内容のボタン表示を出す</span>
            </label>
            <select
              value={guestAutoAdd.productId ?? ''}
              onChange={event => {
                const product = products.find(candidate => candidate.id === event.target.value)
                onGuestAutoAddChange({
                  productId: product?.id ?? '',
                  productNameSnapshot: product?.name ?? '',
                })
              }}
              className="admin-settings__product-select"
            >
              <option value="">メニューを選択</option>
              {products.map(product => (
                <option key={product.id} value={product.id}>
                  {product.name} / ¥{Number(product.price ?? 0).toLocaleString()}
                </option>
              ))}
            </select>
            {guestAutoAdd.enabled && !selectedProduct && (
              <div className="admin-settings__warning">
                自動追加を使うには、追加するメニューを選択してください。
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
