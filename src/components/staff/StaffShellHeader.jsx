import { useEffect, useRef, useState } from 'react'

export default function StaffShellHeader({
  activeStaff,
  callCount,
  canCloseRegister,
  canManageMenu,
  canManageReservations,
  canManageSettings,
  canManageStaff,
  canManageTables,
  canUseKitchen,
  canViewHistory,
  showAdmin,
  onOpenOrders,
  onSwitchStaff,
  onOpenKitchen,
  onOpenHistory,
  onOpenMenuAdmin,
  onOpenReservations,
  onOpenSettings,
  onOpenStaffAdmin,
  onOpenSales,
  onOpenTables,
  onOpenAdmin,
  onLogout,
}) {
  const [managementOpen, setManagementOpen] = useState(false)
  const managementRef = useRef(null)
  const managementItems = [
    canCloseRegister && { key: 'sales', label: 'レジ締め', description: '日次締めと売上履歴', onSelect: onOpenSales },
    canManageTables && { key: 'tables', label: '席', description: '席とQRコード管理', onSelect: onOpenTables },
    canManageReservations && { key: 'reservations', label: '予約', description: '予約表と来店予定', onSelect: onOpenReservations },
    canManageMenu && { key: 'menu', label: 'メニュー', description: '商品・カテゴリ編集', onSelect: onOpenMenuAdmin },
    canViewHistory && { key: 'history', label: '履歴', description: '操作履歴の確認', onSelect: onOpenHistory },
    canManageSettings && { key: 'settings', label: '設定', description: '店舗設定と通知設定', onSelect: onOpenSettings },
    canManageStaff && { key: 'staff', label: 'スタッフ', description: 'スタッフと権限管理', onSelect: onOpenStaffAdmin },
    showAdmin && { key: 'admin', label: '管理画面', description: '管理者向け全体画面', onSelect: onOpenAdmin },
  ].filter(Boolean)
  const hasManagementItems = managementItems.length > 0

  useEffect(() => {
    if (!managementOpen) return undefined

    function handlePointerDown(event) {
      if (managementRef.current?.contains(event.target)) return
      setManagementOpen(false)
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') setManagementOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [managementOpen])

  function handleManagementSelect(item) {
    setManagementOpen(false)
    item.onSelect()
  }

  return (
    <header className="staff-shell__header">
      <div className="staff-shell__brand">
        <h1 className="staff-shell__title">スタッフ</h1>
        {callCount > 0 && <span className="staff-shell__call-count">{callCount}</span>}
      </div>
      <div className="staff-shell__actions">
        <span className="staff-shell__staff-name">{activeStaff.name}</span>
        <button
          type="button"
          onClick={onOpenOrders}
          className="staff-shell__button staff-shell__button--primary"
        >
          注文
        </button>
        <button type="button" onClick={onSwitchStaff} className="staff-shell__button staff-shell__button--compact">
          切替
        </button>
        {canUseKitchen && (
          <button type="button" onClick={onOpenKitchen} className="staff-shell__button">
            キッチン
          </button>
        )}
        {hasManagementItems && (
          <div className="staff-shell__management" ref={managementRef}>
            <button
              type="button"
              onClick={() => setManagementOpen(open => !open)}
              className="staff-shell__button staff-shell__button--management"
              aria-haspopup="menu"
              aria-expanded={managementOpen}
            >
              店舗管理
            </button>
            {managementOpen && (
              <div className="staff-shell__management-menu" role="menu" aria-label="店舗管理">
                {managementItems.map(item => (
                  <button
                    key={item.key}
                    type="button"
                    role="menuitem"
                    className="staff-shell__management-item"
                    onClick={() => handleManagementSelect(item)}
                  >
                    <span className="staff-shell__management-label">{item.label}</span>
                    <span className="staff-shell__management-description">{item.description}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <button type="button" onClick={onLogout} className="staff-shell__button">
          ログアウト
        </button>
      </div>
    </header>
  )
}
