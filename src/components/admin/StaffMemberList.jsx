export default function StaffMemberList({ loading, members, onDelete }) {
  if (loading) return <p className="admin-staff__status">読み込み中...</p>
  if (members.length === 0) return <p className="admin-staff__status admin-staff__status--empty">スタッフが登録されていません</p>

  return (
    <div className="admin-staff__list">
      {members.map((member, index) => (
        <div
          key={member.id}
          className={`admin-staff__row${index === members.length - 1 ? ' is-last' : ''}`}
        >
          <div>
            <span className="admin-staff__member-name">{member.name}</span>
            <span className="admin-staff__masked-code">{'●'.repeat(4)}</span>
          </div>
          <button type="button" onClick={() => onDelete(member.id)} className="admin-staff__delete">
            削除
          </button>
        </div>
      ))}
    </div>
  )
}
