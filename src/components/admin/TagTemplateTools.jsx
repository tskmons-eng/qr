export default function TagTemplateTools({
  currentValue,
  templates,
  templateName,
  saving,
  onTemplateNameChange,
  onApplyTemplate,
  onSave,
  onDelete,
}) {
  return (
    <div className="tag-template-tools">
      <div className="tag-template-title">タグセット</div>
      {templates.length > 0 ? (
        <div className="tag-template-list">
          {templates.map(template => (
            <span key={template.id} className="tag-template-chip">
              <button
                type="button"
                onClick={() => onApplyTemplate(template)}
                title={(template.tags ?? []).map(tag => `#${tag}`).join(' ')}
                className="tag-template-apply"
              >
                {template.name}
              </button>
              <button
                type="button"
                onClick={() => onDelete(template)}
                className="tag-template-delete"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : (
        <div className="tag-template-empty">よく使うタグの組み合わせを名前で保存できます。</div>
      )}
      <div className="tag-template-save-row">
        <input
          value={templateName}
          onChange={event => onTemplateNameChange(event.target.value)}
          placeholder="タグセット名 例: ランチ用"
          className="tag-template-name-input"
        />
        <button
          type="button"
          disabled={saving}
          onClick={() => onSave(currentValue)}
          className="tag-template-save-button"
        >
          名前で保存
        </button>
      </div>
    </div>
  )
}
