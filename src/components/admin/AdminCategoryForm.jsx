export default function AdminCategoryForm({ adding, name, onNameChange, onSubmit }) {
  return (
    <form onSubmit={onSubmit} className="admin-category-form">
      <input
        value={name}
        onChange={event => onNameChange(event.target.value)}
        placeholder="カテゴリー名"
        className="admin-category-form__input"
      />
      <button
        type="submit"
        disabled={adding}
        className="admin-category-form__button"
      >
        追加
      </button>
    </form>
  )
}
