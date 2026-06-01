export default function StoreCodeCard({ storeCode, copied, onCopy }) {
  if (!storeCode) return null

  return (
    <>
      <h2 className="admin-settings__heading">店舗コード</h2>
      <div className="admin-settings__store-code-card">
        <div>
          <div className="admin-settings__store-code">{storeCode}</div>
          <div className="admin-settings__store-code-help">スタッフ・スタッフ画面のログインに使います</div>
        </div>
        <button
          type="button"
          onClick={onCopy}
          className={`admin-settings__copy-button${copied ? ' is-copied' : ''}`}
        >
          {copied ? 'コピー済み' : 'コピー'}
        </button>
      </div>
    </>
  )
}
