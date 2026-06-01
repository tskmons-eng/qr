export default function StaffMenuCategoryTabs({ categories, activeCategoryId, onSelect }) {
  return (
    <div className="staff-menu-categories">
      {categories.map(category => (
        <button
          key={category.id}
          type="button"
          className={activeCategoryId === category.id ? 'is-active' : ''}
          onClick={() => onSelect(category.id)}
        >
          {category.name}
        </button>
      ))}
    </div>
  )
}
