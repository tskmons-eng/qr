const CATEGORY_GROUP_DESCRIPTIONS = {
  drink: 'ドリンク分類',
  food: 'フード分類',
}

export default function CustomerCategoryTabs({ categories, activeCategoryId, onSelect }) {
  return (
    <div className="customer-category-tabs">
      {categories.map(category => {
        const groupDescription = CATEGORY_GROUP_DESCRIPTIONS[category.group]
        const groupClassName = groupDescription ? ` customer-category-tabs__button--${category.group}` : ''
        const categoryLabel = groupDescription
          ? `${category.name}（${groupDescription}）`
          : category.name

        return (
          <button
            key={category.id}
            type="button"
            className={`customer-category-tabs__button${activeCategoryId === category.id ? ' is-active' : ''}${groupClassName}`}
            onClick={() => onSelect(category.id)}
            aria-label={categoryLabel}
            title={groupDescription}
          >
            {groupDescription && (
              <span
                className={`customer-category-tabs__marker customer-category-tabs__marker--${category.group}`}
                aria-hidden="true"
              />
            )}
            <span className="customer-category-tabs__name">{category.name}</span>
          </button>
        )
      })}
    </div>
  )
}
