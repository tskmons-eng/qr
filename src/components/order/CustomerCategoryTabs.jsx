export default function CustomerCategoryTabs({ categories, activeCategoryId, onSelect }) {
  return (
    <div className="customer-category-tabs">
      {categories.map(category => (
        <button
          key={category.id}
          type="button"
          className={`customer-category-tabs__button${activeCategoryId === category.id ? ' is-active' : ''}`}
          onClick={() => onSelect(category.id)}
        >
          {category.name}
        </button>
      ))}
    </div>
  )
}
