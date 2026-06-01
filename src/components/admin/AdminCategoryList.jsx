export default function AdminCategoryList({ categories, onToggleActive }) {
  if (categories.length === 0) {
    return <p className="admin-category-empty">カテゴリーがまだありません</p>
  }

  return (
    <div className="admin-category-list">
      {categories.map(category => (
        <div key={category.id} className="admin-category-row">
          <span className={`admin-category-row__name${category.isActive ? '' : ' is-inactive'}`}>
            {category.name}
          </span>
          <button
            type="button"
            onClick={() => onToggleActive(category)}
            className={`admin-category-row__toggle${category.isActive ? '' : ' is-inactive'}`}
          >
            {category.isActive ? '表示中' : '非表示'}
          </button>
        </div>
      ))}
    </div>
  )
}
