const CATEGORY_GROUP_FILTERS = [
  { key: '', label: 'すべて' },
  { key: 'drink', label: '🥤 ドリンク' },
  { key: 'food', label: '🍽 フード' },
]

export default function ProductCategorySelector({
  activeCategories,
  categoriesForSelect,
  categoryId,
  displayCategoryIds,
  catGroupFilter,
  showQuickCat,
  quickCatName,
  onGroupFilterChange,
  onCategoryIdChange,
  onShowQuickCat,
  onHideQuickCat,
  onQuickCatNameChange,
  onQuickAddCategory,
  onToggleDisplayCategory,
}) {
  return (
    <>
      <div>
        <label className="product-form-label">カテゴリー（メイン）</label>
        <div className="category-filter-row">
          {CATEGORY_GROUP_FILTERS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => onGroupFilterChange(key)}
              className={`button chip-button${catGroupFilter === key ? ' is-active' : ''}`}
            >
              {label}
            </button>
          ))}
        </div>

        {activeCategories.length === 0 && !showQuickCat ? (
          <div className="category-empty-callout">
            <span>カテゴリーがまだありません</span>
            <button type="button" onClick={onShowQuickCat} className="button button-primary category-small-action">+ 作成</button>
          </div>
        ) : showQuickCat ? (
          <div className="category-quick-add-row">
            <input
              value={quickCatName}
              onChange={event => onQuickCatNameChange(event.target.value)}
              placeholder="カテゴリー名"
              autoFocus
              className="category-quick-input"
            />
            <button type="button" onClick={onQuickAddCategory} className="button button-primary category-quick-button">追加</button>
            <button type="button" onClick={onHideQuickCat} className="button button-secondary category-quick-button">戻る</button>
          </div>
        ) : (
          <div className="category-select-row">
            <select
              value={categoryId}
              onChange={event => onCategoryIdChange(event.target.value)}
              required
              className="category-main-select"
            >
              <option value="">選択してください</option>
              {categoriesForSelect.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
            <button type="button" onClick={onShowQuickCat} className="button button-secondary category-new-button">+ 新規</button>
          </div>
        )}
      </div>

      {categoryId && activeCategories.length > 1 && (
        <div>
          <label className="product-form-label product-form-label-muted">追加カテゴリー（複数表示・任意）</label>
          <div className="category-extra-row">
            {activeCategories.filter(category => category.id !== categoryId).map(category => {
              const checked = (displayCategoryIds ?? []).includes(category.id)
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => onToggleDisplayCategory(category.id)}
                  className={`button chip-button${checked ? ' is-active' : ''}`}
                >
                  {category.name}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}
