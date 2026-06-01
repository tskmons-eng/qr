export default function ProductFormPanel({
  isEditing,
  saving,
  onSubmit,
  onCancel,
  children,
}) {
  return (
    <div className="product-form-panel">
      <h3 className="product-form-title">{isEditing ? '商品を編集' : '商品を追加'}</h3>
      <form onSubmit={onSubmit}>
        <div className="product-form-stack">
          {children}
        </div>
        <div className="product-form-actions">
          <button type="submit" disabled={saving} className="button button-primary product-form-save">
            {saving ? '保存中...' : '保存'}
          </button>
          <button type="button" onClick={onCancel} className="button button-secondary product-form-cancel">
            キャンセル
          </button>
        </div>
      </form>
    </div>
  )
}
