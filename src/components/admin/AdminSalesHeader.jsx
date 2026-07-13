import { useEffect, useRef, useState } from 'react'

export default function AdminSalesHeader({
  activeView,
  allExportDisabled,
  canManageAssignees,
  filteredExportDisabled,
  onExportAll,
  onExportAssigneeSummary,
  onExportFiltered,
  onManageAssignees,
  onViewChange,
  summaryExportDisabled,
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)
  const menuTriggerRef = useRef(null)

  useEffect(() => {
    if (!menuOpen) return undefined

    function closeMenu(event) {
      if (event.key === 'Escape') {
        setMenuOpen(false)
        menuTriggerRef.current?.focus()
        return
      }
      if (!menuRef.current?.contains(event.target)) setMenuOpen(false)
    }

    document.addEventListener('keydown', closeMenu)
    document.addEventListener('mousedown', closeMenu)
    return () => {
      document.removeEventListener('keydown', closeMenu)
      document.removeEventListener('mousedown', closeMenu)
    }
  }, [menuOpen])

  function runMenuAction(action) {
    setMenuOpen(false)
    action()
  }

  return (
    <>
      <div className="admin-sales__header">
        <h2 className="admin-sales__title">売上・会計</h2>
        <div className="admin-sales-menu" ref={menuRef}>
          <button
            ref={menuTriggerRef}
            type="button"
            aria-expanded={menuOpen}
            aria-controls="admin-sales-more-actions"
            className="admin-sales-menu__trigger"
            onClick={() => setMenuOpen(open => !open)}
          >
            その他 <span aria-hidden="true">⋯</span>
          </button>
          {menuOpen && (
            <div id="admin-sales-more-actions" className="admin-sales-menu__panel">
              <button
                type="button"
                disabled={allExportDisabled}
                onClick={() => runMenuAction(onExportAll)}
              >
                全会計CSV（従来形式）
              </button>
              <button
                type="button"
                disabled={filteredExportDisabled}
                onClick={() => runMenuAction(onExportFiltered)}
              >
                表示中の会計CSV
              </button>
              <button
                type="button"
                disabled={summaryExportDisabled}
                onClick={() => runMenuAction(onExportAssigneeSummary)}
              >
                担当別集計CSV
              </button>
              {canManageAssignees && (
                <>
                  <div className="admin-sales-menu__separator" aria-hidden="true" />
                  <button
                    type="button"
                    onClick={() => runMenuAction(onManageAssignees)}
                  >
                    担当者管理
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="admin-sales-view-tabs" role="group" aria-label="売上画面の表示切替">
        <button
          type="button"
          aria-pressed={activeView === 'today'}
          className={activeView === 'today' ? 'is-active' : ''}
          onClick={() => onViewChange('today')}
        >
          本日・レジ締め
        </button>
        <button
          type="button"
          aria-pressed={activeView === 'history'}
          className={activeView === 'history' ? 'is-active' : ''}
          onClick={() => onViewChange('history')}
        >
          会計履歴
        </button>
      </div>
    </>
  )
}
