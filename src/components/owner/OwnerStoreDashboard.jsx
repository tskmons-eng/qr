import { useEffect, useState } from 'react'
import { describeOwnerStoreManager, formatOwnerCurrency, formatOwnerDateTime } from '../../lib/ownerDashboard'
import { STORE_NAME_MAX_LENGTH, normalizeStoreName } from '../../lib/storeIdentity'

// 運営者の店舗一覧（2026-10-22 店舗登録で作り直し。余白少なめ）。
// 上に「店舗を追加」、店は1行ずつ。押すと名前・店長の変更、招待の出し直し、管理へ進める。
const summaryCards = [
  { key: 'todaySales', label: '本日売上', format: formatOwnerCurrency },
  { key: 'todayCheckCount', label: '本日会計', format: value => `${value}件` },
  { key: 'openOrderCount', label: '未会計', format: value => `${value}件` },
]

export default function OwnerStoreDashboard({
  dashboard,
  error,
  loading,
  inviteBusyStoreId,
  ownerActiveStoreId,
  ownerEmailSavingStoreId,
  storeNameSavingStoreId,
  onAddStore,
  onIssueInvite,
  onManageStore,
  onOwnerEmailSave,
  onStoreNameSave,
  onRefresh,
}) {
  return (
    <section className="owner-dashboard">
      {dashboard && (
        <div className="owner-summary-grid">
          {summaryCards.map(({ key, label, format }) => (
            <div key={key} className="owner-summary-card">
              <div className="owner-summary-card__label">{label}</div>
              <div className="owner-summary-card__value">{format(dashboard.summary[key])}</div>
            </div>
          ))}
        </div>
      )}
      <button type="button" onClick={onAddStore} className="ui-button ui-button--primary ui-button--block">
        ＋ 店舗を追加
      </button>
      <div className="owner-dashboard__heading">
        <span>店舗 {dashboard?.summary.storeCount ?? 0}{dashboard?.businessDate ? `（${dashboard.businessDate}）` : ''}</span>
        <button type="button" onClick={onRefresh} disabled={loading} className="owner-dashboard__refresh">
          {loading ? '読み込み中' : '更新'}
        </button>
      </div>
      {error && <p className="owner-dashboard__error" role="alert">{error}</p>}
      {loading && !dashboard && <p className="owner-dashboard__status">読み込み中...</p>}
      {dashboard && (
        <OwnerStoreList
          stores={dashboard.stores}
          inviteBusyStoreId={inviteBusyStoreId}
          ownerActiveStoreId={ownerActiveStoreId}
          ownerEmailSavingStoreId={ownerEmailSavingStoreId}
          storeNameSavingStoreId={storeNameSavingStoreId}
          onIssueInvite={onIssueInvite}
          onManageStore={onManageStore}
          onOwnerEmailSave={onOwnerEmailSave}
          onStoreNameSave={onStoreNameSave}
        />
      )}
    </section>
  )
}

function OwnerStoreList({
  stores,
  inviteBusyStoreId,
  ownerActiveStoreId,
  ownerEmailSavingStoreId,
  storeNameSavingStoreId,
  onIssueInvite,
  onManageStore,
  onOwnerEmailSave,
  onStoreNameSave,
}) {
  const [openStoreId, setOpenStoreId] = useState(null)
  const [emailDrafts, setEmailDrafts] = useState({})
  const [storeNameDrafts, setStoreNameDrafts] = useState({})

  useEffect(() => {
    setEmailDrafts(Object.fromEntries(stores.map(store => [store.id, store.ownerEmail || ''])))
    setStoreNameDrafts(Object.fromEntries(stores.map(store => [store.id, store.storeName || ''])))
  }, [stores])

  if (stores.length === 0) {
    return <p className="owner-dashboard__status owner-dashboard__status--empty">店舗はまだありません。「店舗を追加」から作ってください。</p>
  }

  return (
    <div className="owner-store-list">
      {stores.map(store => {
        const manager = describeOwnerStoreManager(store)
        const open = openStoreId === store.id
        return (
          <div key={store.id} className={`owner-store${manager.state === 'assigned' ? '' : ' is-waiting'}${open ? ' is-open' : ''}`}>
            <button type="button" onClick={() => setOpenStoreId(open ? null : store.id)} className="owner-store__row" aria-expanded={open}>
              <span className="owner-store__main">
                <span className="owner-store__name">{store.storeName}</span>
                <span className="owner-store__manager">{manager.label}</span>
              </span>
              {manager.state === 'assigned' ? (
                <span className="owner-store__sales">
                  {formatOwnerCurrency(store.todaySales)}
                  <small>本日 {store.todayCheckCount}件</small>
                </span>
              ) : (
                <span className="owner-store__badge">{manager.state === 'invited' ? '招待中' : '店長なし'}</span>
              )}
              <span className="owner-store__code">{store.storeCode || '-'}</span>
            </button>
            {open && (
              <div className="owner-store__detail">
                <label className="owner-store__field">
                  <span>店舗名</span>
                  <span className="owner-store__inline">
                    <input
                      value={storeNameDrafts[store.id] ?? store.storeName}
                      onChange={event => setStoreNameDrafts(prev => ({ ...prev, [store.id]: event.target.value }))}
                      maxLength={STORE_NAME_MAX_LENGTH}
                      aria-label={`${store.id}の店舗名`}
                      className="owner-store-name-edit__input"
                    />
                    <button
                      type="button"
                      onClick={() => onStoreNameSave({ storeId: store.id, storeName: storeNameDrafts[store.id] ?? store.storeName })}
                      disabled={
                        storeNameSavingStoreId === store.id ||
                        normalizeStoreName(storeNameDrafts[store.id] ?? store.storeName) === store.storeName
                      }
                      className="ui-button ui-button--soft"
                    >
                      {storeNameSavingStoreId === store.id ? '保存中' : '保存'}
                    </button>
                  </span>
                </label>
                <label className="owner-store__field">
                  <span>店長のメール（直すときだけ。ふだんは招待で決まる）</span>
                  <span className="owner-store__inline">
                    <input
                      value={emailDrafts[store.id] ?? ''}
                      onChange={event => setEmailDrafts(prev => ({ ...prev, [store.id]: event.target.value }))}
                      placeholder="未登録"
                      type="email"
                      aria-label={`${store.storeName}の店長のメール`}
                      className="owner-store-admin-email__input"
                    />
                    <button
                      type="button"
                      onClick={() => onOwnerEmailSave({ storeId: store.id, currentEmail: store.ownerEmail, nextEmail: emailDrafts[store.id] ?? '' })}
                      disabled={
                        ownerEmailSavingStoreId === store.id ||
                        (emailDrafts[store.id] ?? '').trim().toLowerCase() === (store.ownerEmail || '').trim().toLowerCase()
                      }
                      className="ui-button ui-button--soft"
                    >
                      {ownerEmailSavingStoreId === store.id ? '保存中' : '保存'}
                    </button>
                  </span>
                </label>
                <p className="owner-store__meta">
                  累計 {formatOwnerCurrency(store.allTimeSales)}・未会計 {store.openOrderCount}件・最終利用 {formatOwnerDateTime(store.lastActivityAt) || '-'}
                </p>
                <div className="owner-store__actions">
                  <button
                    type="button"
                    onClick={() => onIssueInvite(store)}
                    disabled={inviteBusyStoreId === store.id}
                    className="ui-button ui-button--soft"
                  >
                    {inviteBusyStoreId === store.id ? '作成中...' : manager.state === 'assigned' ? '店長を追加する招待' : '店長の招待を出す'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onManageStore(store)}
                    className={`ui-button ui-button--primary owner-store-manage-button${ownerActiveStoreId === store.id ? ' is-active' : ''}`}
                  >
                    {ownerActiveStoreId === store.id ? '管理中' : '詳細・管理'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
