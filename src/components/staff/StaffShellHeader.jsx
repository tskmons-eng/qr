export default function StaffShellHeader({
  activeStaff,
  callCount,
  notifStatus,
  showAdmin,
  onEnableNotif,
  onToggleSoundSettings,
  onRefresh,
  onSwitchStaff,
  onOpenKitchen,
  onOpenAdmin,
  onLogout,
}) {
  return (
    <header className="staff-shell__header">
      <div className="staff-shell__brand">
        <h1 className="staff-shell__title">スタッフ</h1>
        {callCount > 0 && <span className="staff-shell__call-count">{callCount}</span>}
      </div>
      <div className="staff-shell__actions">
        <span className="staff-shell__staff-name">{activeStaff.name}</span>
        {notifStatus !== 'ok' && (
          <button
            type="button"
            onClick={onEnableNotif}
            disabled={notifStatus === 'loading'}
            className={`staff-shell__notif-button${notifStatus === 'failed' ? ' is-failed' : ''}`}
          >
            {notifStatus === 'loading' ? '...' : notifStatus === 'failed' ? '通知❌' : '通知ON'}
          </button>
        )}
        <button
          type="button"
          onClick={onToggleSoundSettings}
          className="staff-shell__icon-button"
          title="通知音設定"
        >
          🔔
        </button>
        <button
          type="button"
          onClick={onRefresh}
          className="staff-shell__button staff-shell__button--strong"
          title="画面を更新"
        >
          更新
        </button>
        <button type="button" onClick={onSwitchStaff} className="staff-shell__button staff-shell__button--compact">
          切替
        </button>
        <button type="button" onClick={onOpenKitchen} className="staff-shell__button">
          キッチン
        </button>
        {showAdmin && (
          <button type="button" onClick={onOpenAdmin} className="staff-shell__button">
            管理
          </button>
        )}
        <button type="button" onClick={onLogout} className="staff-shell__button">
          ログアウト
        </button>
      </div>
    </header>
  )
}
