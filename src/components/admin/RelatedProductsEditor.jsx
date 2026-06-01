export default function RelatedProductsEditor({
  enabled,
  linkedProductIds,
  relatedSearch,
  relatedCatFilter,
  categories,
  filteredProducts,
  editingId,
  savingRelated,
  getCategoryName,
  onToggleEnabled,
  onRelatedSearchChange,
  onRelatedCatFilterChange,
  onToggleProduct,
  onSaveRelated,
}) {
  return (
    <div className="product-form-section">
      <div className={`product-section-header${enabled ? ' has-content' : ''}`}>
        <div>
          <div className="product-section-title">関連商品</div>
          <div className="product-section-help">「これもいかがですか？」に表示</div>
        </div>
        <button type="button" onClick={onToggleEnabled} className={`product-section-toggle${enabled ? ' is-active' : ''}`}>
          {enabled ? 'ON' : 'OFF'}
        </button>
      </div>

      {enabled && (
        <div className="related-products-editor">
          <div className="related-products-filter-row">
            <input
              value={relatedSearch}
              onChange={event => onRelatedSearchChange(event.target.value)}
              placeholder="商品名で検索..."
              className="related-products-search"
            />
            <select
              value={relatedCatFilter}
              onChange={event => onRelatedCatFilterChange(event.target.value)}
              className="related-products-category"
            >
              <option value="">すべて</option>
              {categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </div>

          {filteredProducts.length === 0 ? (
            <p className="related-products-empty">該当する商品がありません</p>
          ) : (
            filteredProducts.map(product => {
              const checked = linkedProductIds.includes(product.id)
              return (
                <label key={product.id} className={`related-product-row${checked ? ' is-selected' : ''}`}>
                  <input type="checkbox" checked={checked} onChange={() => onToggleProduct(product.id)} />
                  <span className="related-product-name">{product.name}</span>
                  <span className="related-product-category">{getCategoryName(product.categoryId)}</span>
                  <span className="related-product-price">¥{product.price.toLocaleString()}</span>
                </label>
              )
            })
          )}

          {editingId && (
            <button type="button" onClick={onSaveRelated} disabled={savingRelated} className="product-section-save">
              {savingRelated ? '保存中...' : '関連商品を保存'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
