import { useEffect, useState } from 'react'
import { formatOwnerCurrency, formatOwnerDateTime } from '../../lib/ownerDashboard'
import { STORE_NAME_MAX_LENGTH, normalizeStoreName } from '../../lib/storeIdentity'

const summaryCards = [
  { key: 'storeCount', label: '登録店舗', format: value => `${value}件` },
  { key: 'activeStoreCount', label: '稼働中', format: value => `${value}件` },
  { key: 'todaySales', label: '本日売上', format: formatOwnerCurrency },
  { key: 'todayCheckCount', label: '本日会計', format: value => `${value}件` },
  { key: 'openOrderCount', label: '未会計注文', format: value => `${value}件` },
]

export default function OwnerStoreDashboard({
  dashboard,
  error,
  loading,
  ownerActiveStoreId,
  ownerEmailSavingStoreId,
  storeNameSavingStoreId,
  onManageStore,
  onOwnerEmailSave,
  onStoreNameSave,
  onRefresh,
}) {
  return (
    <section className="owner-dashboard">
      <div className="owner-dashboard__header">
        <div>
          <h2 className="owner-content__heading">店舗一覧</h2>
          {dashboard?.businessDate && (
            <div className="owner-dashboard__date">{dashboard.businessDate}</div>
          )}
        </div>
        <button type="button" onClick={onRefresh} disabled={loading} className="owner-dashboard__refresh">
          {loading ? '更新中...' : '更新'}
        </button>
      </div>

      {error && <p className="owner-dashboard__error">{error}</p>}
      {loading && !dashboard && <p className="owner-dashboard__status">読み込み中...</p>}

      {dashboard && (
        <>
          <div className="owner-summary-grid">
            {summaryCards.map(({ key, label, format }) => (
              <div key={key} className="owner-summary-card">
                <div className="owner-summary-card__label">{label}</div>
                <div className="owner-summary-card__value">{format(dashboard.summary[key])}</div>
              </div>
            ))}
          </div>

          <OwnerStoreTable
            ownerActiveStoreId={ownerActiveStoreId}
            ownerEmailSavingStoreId={ownerEmailSavingStoreId}
            storeNameSavingStoreId={storeNameSavingStoreId}
            stores={dashboard.stores}
            onManageStore={onManageStore}
            onOwnerEmailSave={onOwnerEmailSave}
            onStoreNameSave={onStoreNameSave}
          />
        </>
      )}
    </section>
  )
}

function OwnerStoreTable({
  ownerActiveStoreId,
  ownerEmailSavingStoreId,
  storeNameSavingStoreId,
  stores,
  onManageStore,
  onOwnerEmailSave,
  onStoreNameSave,
}) {
  const [emailDrafts, setEmailDrafts] = useState({})
  const [storeNameDrafts, setStoreNameDrafts] = useState({})

  useEffect(() => {
    setEmailDrafts(Object.fromEntries(stores.map(store => [store.id, store.ownerEmail || ''])))
    setStoreNameDrafts(Object.fromEntries(stores.map(store => [store.id, store.storeName || ''])))
  }, [stores])

  if (stores.length === 0) {
    return <p className="owner-dashboard__status owner-dashboard__status--empty">店舗はまだありません</p>
  }

  return (
    <div className="owner-store-table-wrap">
      <table className="owner-store-table">
        <thead>
          <tr>
            <th>店舗</th>
            <th>店舗コード</th>
            <th>状態</th>
            <th>名義メール</th>
            <th>本日売上</th>
            <th>本日会計</th>
            <th>未会計</th>
            <th>累計売上</th>
            <th>最終利用</th>
            <th>詳細</th>
          </tr>
        </thead>
        <tbody>
          {stores.map(store => (
            <tr key={store.id}>
              <td>
                <div className="owner-store-name-edit">
                  <input
                    value={storeNameDrafts[store.id] ?? store.storeName}
                    onChange={event => setStoreNameDrafts(prev => ({ ...prev, [store.id]: event.target.value }))}
                    maxLength={STORE_NAME_MAX_LENGTH}
                    aria-label={`${store.id}の店舗名`}
                    className="owner-store-name-edit__input"
                  />
                  <button
                    type="button"
                    onClick={() => onStoreNameSave({
                      storeId: store.id,
                      storeName: storeNameDrafts[store.id] ?? store.storeName,
                    })}
                    disabled={
                      storeNameSavingStoreId === store.id ||
                      normalizeStoreName(storeNameDrafts[store.id] ?? store.storeName) === store.storeName
                    }
                    className="owner-store-name-edit__button"
                  >
                    {storeNameSavingStoreId === store.id ? '保存中' : '保存'}
                  </button>
                </div>
                <div className="owner-store-table__id">{store.id}</div>
              </td>
              <td className="owner-store-table__code">{store.storeCode || '-'}</td>
              <td>
                <span className={`owner-store-status${store.status === '稼働中' ? ' is-active' : ' is-paused'}`}>
                  {store.status}
                </span>
              </td>
              <td>
                <div className="owner-store-admin-email">
                  <div className="owner-store-admin-email__field">
                    <input
                      value={emailDrafts[store.id] ?? ''}
                      onChange={event => setEmailDrafts(prev => ({ ...prev, [store.id]: event.target.value }))}
                      placeholder="owner@example.com"
                      type="email"
                      aria-label={`${store.storeName}の名義メール`}
                      className="owner-store-admin-email__input"
                    />
                    <span className="owner-store-admin-email__hint">店舗ID・履歴はそのまま</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOwnerEmailSave({
                      storeId: store.id,
                      currentEmail: store.ownerEmail,
                      nextEmail: emailDrafts[store.id] ?? '',
                    })}
                    disabled={
                      ownerEmailSavingStoreId === store.id ||
                      (emailDrafts[store.id] ?? '').trim().toLowerCase() === (store.ownerEmail || '').trim().toLowerCase()
                    }
                    className="owner-store-admin-email__button"
                  >
                    {ownerEmailSavingStoreId === store.id ? '保存中' : '保存'}
                  </button>
                </div>
              </td>
              <td className="owner-store-table__amount">{formatOwnerCurrency(store.todaySales)}</td>
              <td className="owner-store-table__number">{store.todayCheckCount}件</td>
              <td className="owner-store-table__number">{store.openOrderCount}件</td>
              <td className="owner-store-table__amount">{formatOwnerCurrency(store.allTimeSales)}</td>
              <td className="owner-store-table__date">{formatOwnerDateTime(store.lastActivityAt) || '-'}</td>
              <td>
                <button
                  type="button"
                  onClick={() => onManageStore(store)}
                  className={`owner-store-manage-button${ownerActiveStoreId === store.id ? ' is-active' : ''}`}
                >
                  {ownerActiveStoreId === store.id ? '管理中' : '詳細・管理'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
