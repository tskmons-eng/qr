import { STORE_NAME_MAX_LENGTH } from '../../lib/storeIdentity'

export default function StoreCodeCard({
  copied,
  onCopy,
  onStoreNameChange,
  onStoreNameSave,
  storeCode,
  storeNameChanged,
  storeNameError,
  storeNameInput,
  storeNameSaved,
  storeNameSaving,
}) {
  if (!storeCode && storeNameInput == null) return null

  return (
    <>
      <h2 className="admin-settings__heading">店舗情報</h2>
      <div className="admin-settings__store-code-card admin-settings__store-identity-card">
        <div className="admin-settings__store-identity-main">
          <label className="admin-settings__store-name-label" htmlFor="admin-store-name">
            店舗名
          </label>
          <div className="admin-settings__store-name-row">
            <input
              id="admin-store-name"
              type="text"
              value={storeNameInput ?? ''}
              onChange={event => onStoreNameChange(event.target.value)}
              maxLength={STORE_NAME_MAX_LENGTH}
              className="admin-settings__store-name-input"
              placeholder="店舗名未設定"
            />
            <button
              type="button"
              onClick={onStoreNameSave}
              disabled={storeNameSaving || !storeNameChanged}
              className={`admin-settings__store-name-save${storeNameSaved ? ' is-saved' : ''}`}
            >
              {storeNameSaving ? '保存中...' : storeNameSaved ? '保存済み' : '保存'}
            </button>
          </div>
          {storeNameError && <p className="admin-settings__store-name-error">{storeNameError}</p>}
          <div className="admin-settings__store-name-help">店舗名は店舗コードと同じ店舗情報として保存されます。</div>

          {storeCode && (
            <div className="admin-settings__store-code-block">
              <div className="admin-settings__store-code-label">店舗コード</div>
              <div className="admin-settings__store-code">{storeCode}</div>
              <div className="admin-settings__store-code-help">スタッフ・スタッフ画面のログインに使います</div>
            </div>
          )}
        </div>
        {storeCode && (
          <button
            type="button"
            onClick={onCopy}
            className={`admin-settings__copy-button${copied ? ' is-copied' : ''}`}
          >
            {copied ? 'コピー済み' : 'コピー'}
          </button>
        )}
      </div>
    </>
  )
}
