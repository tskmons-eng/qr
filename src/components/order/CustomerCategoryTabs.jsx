const CATEGORY_GROUP_LABELS = {
  drink: 'ドリンク',
  food: 'フード',
}

export default function CustomerCategoryTabs({ categories, activeCategoryId, onSelect }) {
  return (
    <div className="customer-category-tabs">
      {categories.map(category => {
        const groupLabel = CATEGORY_GROUP_LABELS[category.group]

        return (
          <button
            key={category.id}
            type="button"
            className={`customer-category-tabs__button${activeCategoryId === category.id ? ' is-active' : ''}`}
            onClick={() => onSelect(category.id)}
          >
            <span className="customer-category-tabs__name">{category.name}</span>
            {groupLabel && (
              <span className={`customer-category-tabs__group customer-category-tabs__group--${category.group}`}>
                {groupLabel}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
