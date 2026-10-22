import { useRef, useState } from 'react'
import BottomSheet from '../ui/BottomSheet'
import StaffIcon from './StaffIcon'

// スタッフ画面の上の帯と「店舗管理」。管理の画面はここに一本化した（2026-10-22 整理 第3章）。
// 見た目は「すっきり明るい」（.claude/rules/ui.md 3章）。スマホでは店舗管理が下から出るシートになる。
export default function StaffShellHeader({
  activeStaff,
  storeName,
  storeCode,
  callCount,
  canCloseRegister,
  canManageMenu,
  canManageReservations,
  canManageSettings,
  canManageStaff,
  canManageTables,
  canUseKitchen,
  canViewHistory,
  onOpenOrders,
  onSwitchStaff,
  onOpenKitchen,
  onOpenHistory,
  onOpenMenuAdmin,
  onOpenReservations,
  onOpenSalesAssignees,
  onOpenSettings,
  onOpenStaffAdmin,
  onOpenSales,
  onOpenTables,
  onLogout,
}) {
  const [managementOpen, setManagementOpen] = useState(false)
  const [codeCopied, setCodeCopied] = useState(false)
  const managementButtonRef = useRef(null)
  const managementItems = [
    canCloseRegister && { key: 'sales', icon: 'cash', label: 'レジ締め', description: '日次締めと売上履歴', onSelect: onOpenSales },
    !canCloseRegister && canManageStaff && {
      key: 'sales-assignees',
      icon: 'cash',
      label: '売上担当',
      description: '会計に設定する担当者',
      onSelect: onOpenSalesAssignees,
    },
    canManageTables && { key: 'tables', icon: 'seat', label: '席', description: '席とQRコード', onSelect: onOpenTables },
    canManageReservations && { key: 'reservations', icon: 'calendar', label: '予約', description: '予約表と来店予定', onSelect: onOpenReservations },
    canManageMenu && { key: 'menu', icon: 'menu', label: 'メニュー', description: '商品・カテゴリ', onSelect: onOpenMenuAdmin },
    canViewHistory && { key: 'history', icon: 'log', label: '操作ログ', description: 'スタッフの操作', onSelect: onOpenHistory },
    canManageSettings && { key: 'settings', icon: 'gear', label: '設定', description: '店舗と端末の設定', onSelect: onOpenSettings },
    canManageStaff && { key: 'staff', icon: 'people', label: 'スタッフ', description: 'スタッフと権限', onSelect: onOpenStaffAdmin },
  ].filter(Boolean)
  const hasManagementItems = managementItems.length > 0

  function handleManagementSelect(item) {
    setManagementOpen(false)
    item.onSelect()
  }

  function handleCopyCode() {
    navigator.clipboard?.writeText(storeCode).then(() => {
      setCodeCopied(true)
      setTimeout(() => setCodeCopied(false), 2000)
    })
  }

  return (
    <header className="staff-topbar">
      <div className="staff-topbar__store">
        <span className="staff-topbar__store-name">
          {storeName || 'スタッフ'}
          {callCount > 0 && <span className="staff-topbar__call-count" aria-label={`呼び出し ${callCount}件`}>{callCount}</span>}
        </span>
        <span className="staff-topbar__who">
          <span className="staff-topbar__who-name">{activeStaff.name}</span>
          {activeStaff.isStoreManager && <span className="ui-badge ui-badge--admin">管理者</span>}
        </span>
      </div>
      <div className="staff-topbar__actions">
        <button type="button" onClick={onOpenOrders} className="ui-button ui-button--primary">
          注文
        </button>
        {canUseKitchen && (
          <button type="button" onClick={onOpenKitchen} className="ui-button ui-button--soft ui-button--icon" aria-label="キッチン">
            <StaffIcon name="kitchen" />
          </button>
        )}
        {onSwitchStaff && (
          <button type="button" onClick={onSwitchStaff} className="ui-button ui-button--soft">
            切替
          </button>
        )}
        {hasManagementItems ? (
          <button
            ref={managementButtonRef}
            type="button"
            onClick={() => setManagementOpen(true)}
            className="ui-button ui-button--soft"
            aria-haspopup="dialog"
            aria-expanded={managementOpen}
          >
            <StaffIcon name="grid" />
            店舗管理
          </button>
        ) : (
          <button type="button" onClick={onLogout} className="ui-button ui-button--ghost">
            ログアウト
          </button>
        )}
      </div>

      <BottomSheet
        open={managementOpen}
        title="店舗管理"
        onClose={() => setManagementOpen(false)}
        returnFocusRef={managementButtonRef}
      >
        {storeCode && (
          <div className="staff-sheet__store-code">
            <div>
              <small>店舗コード</small>
              <strong>{storeCode}</strong>
            </div>
            <button type="button" onClick={handleCopyCode} className="ui-button ui-button--surface">
              {codeCopied ? 'コピー済み' : 'コピー'}
            </button>
          </div>
        )}
        <div className="staff-sheet__grid">
          {managementItems.map(item => (
            <button
              key={item.key}
              type="button"
              className="staff-sheet__tile"
              onClick={() => handleManagementSelect(item)}
            >
              <span className="staff-sheet__tile-icon"><StaffIcon name={item.icon} /></span>
              <span className="staff-sheet__tile-label">{item.label}</span>
              <span className="staff-sheet__tile-description">{item.description}</span>
            </button>
          ))}
        </div>
        <div className="staff-sheet__footer">
          <button type="button" onClick={onLogout} className="ui-button ui-button--ghost">
            ログアウト
          </button>
        </div>
      </BottomSheet>
    </header>
  )
}
