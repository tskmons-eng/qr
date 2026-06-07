export default function AdminTableGroupsPanel({
  editingGroupId,
  editingGroupName,
  groups,
  newGroupName,
  saving,
  onAddGroup,
  onCancelEditGroup,
  onDeleteGroup,
  onEditGroupNameChange,
  onNewGroupNameChange,
  onSaveGroupName,
  onStartEditGroup,
}) {
  return (
    <section className="admin-table-groups">
      <div className="admin-table-groups__header">
        <div>
          <h3 className="admin-table-groups__title">席グループ</h3>
          <p className="admin-table-groups__description">スタッフ席一覧の上に表示するタブを作れます。</p>
        </div>
      </div>
      <form onSubmit={onAddGroup} className="admin-table-groups__form">
        <input
          value={newGroupName}
          onChange={event => onNewGroupNameChange(event.target.value)}
          placeholder="例: 1階、2階、カウンター"
          className="admin-text-input"
        />
        <button type="submit" disabled={saving} className="button button-primary admin-form-submit">
          追加
        </button>
      </form>
      <div className="admin-table-groups__list">
        {groups.map(group => (
          <div key={group.id} className="admin-table-groups__row">
            {editingGroupId === group.id ? (
              <>
                <input
                  value={editingGroupName}
                  onChange={event => onEditGroupNameChange(event.target.value)}
                  className="admin-table-groups__edit-input"
                />
                <button type="button" onClick={() => onSaveGroupName(group)} className="button button-primary admin-table-groups__button">
                  保存
                </button>
                <button type="button" onClick={onCancelEditGroup} className="button button-secondary admin-table-groups__button">
                  戻る
                </button>
              </>
            ) : (
              <>
                <span className="admin-table-groups__name">{group.name}</span>
                <button type="button" onClick={() => onStartEditGroup(group)} className="button button-secondary admin-table-groups__button">
                  名前変更
                </button>
                <button type="button" onClick={() => onDeleteGroup(group)} className="button button-secondary admin-table-groups__delete">
                  削除
                </button>
              </>
            )}
          </div>
        ))}
        {groups.length === 0 && <p className="admin-table-groups__empty">グループはまだありません</p>}
      </div>
    </section>
  )
}
