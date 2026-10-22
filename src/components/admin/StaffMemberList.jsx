import { describeStaffAccess, getStaffRoleDisplay } from '../../lib/staffPermissions'

// スタッフ一覧（2026-10-23 作り直し）。1人1行：名前・できること・役割。押すと詳細。
function getInitial(name) {
  return String(name ?? '').trim().slice(0, 1) || '？'
}

export default function StaffMemberList({ loading, members, onOpen }) {
  if (loading) return <p className="admin-staff__status">読み込み中...</p>
  if (members.length === 0) {
    return <p className="admin-staff__status admin-staff__status--empty">スタッフはまだいません。「スタッフを追加」から登録してください。</p>
  }

  return (
    <div className="admin-staff__list">
      {members.map(member => {
        const role = getStaffRoleDisplay(member)
        return (
          <button key={member.id} type="button" onClick={() => onOpen(member)} className="admin-staff__row">
            <span className="admin-staff__avatar" aria-hidden="true">{getInitial(member.name)}</span>
            <span className="admin-staff__main">
              <b>{member.name}</b>
              <span>{describeStaffAccess(member).can.join('・') || 'なし'}</span>
            </span>
            <span className={`admin-staff__role admin-staff__role--${role.key}`}>{role.label}</span>
            <span className="admin-staff__chev" aria-hidden="true">›</span>
          </button>
        )
      })}
    </div>
  )
}
