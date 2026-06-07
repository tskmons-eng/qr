import { useNavigate } from 'react-router-dom'
import { useStaffMember } from '../contexts/StaffMemberContext'
import { hasStaffPermission } from '../lib/staffPermissions'

export default function StaffBottomNav({
  current,
  tableId,
  orderId,
  storeId,
  guestCount,
  pendingCount = 0,
}) {
  const navigate = useNavigate()
  const staffContext = useStaffMember()
  const canUseKitchen = hasStaffPermission(staffContext?.activeStaff, 'useKitchen')
  const hasTable = !!tableId
  const hasOrder = !!orderId
  const checkoutState = { orderId, storeId, guestCount }

  function itemClassName(active, disabled = false) {
    return [
      'staff-bottom-nav__item',
      active ? 'is-active' : '',
      disabled ? 'is-disabled' : '',
    ].filter(Boolean).join(' ')
  }

  return (
    <nav className="staff-bottom-nav">
      <div className="staff-bottom-nav__inner">
        <button
          type="button"
          onClick={() => navigate(hasTable ? `/staff/table/${tableId}` : '/staff')}
          className={itemClassName(current === 'seat')}
        >
          <span className="staff-bottom-nav__icon">席</span>
          <span>戻る</span>
        </button>
        {canUseKitchen && (
          <button
            type="button"
            onClick={() => navigate('/staff/kitchen')}
            className={itemClassName(current === 'kitchen')}
          >
            <span className="staff-bottom-nav__icon">厨房</span>
            <span>パネル</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => hasOrder && navigate(`/staff/table/${tableId}/remaining`, { state: { orderId, storeId } })}
          disabled={!hasOrder}
          className={itemClassName(current === 'remaining', !hasOrder)}
        >
          <span className="staff-bottom-nav__icon">残り</span>
          <span>{pendingCount > 0 ? `${pendingCount}点` : '確認'}</span>
        </button>
        <button
          type="button"
          onClick={() => hasOrder && navigate(`/staff/table/${tableId}/checkout`, { state: checkoutState })}
          disabled={!hasOrder}
          className={itemClassName(current === 'checkout', !hasOrder)}
        >
          <span className="staff-bottom-nav__icon">会計</span>
          <span>精算</span>
        </button>
      </div>
    </nav>
  )
}
