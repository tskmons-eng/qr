export default function ProductTabHeader({
  showForm,
  productSearch,
  productCatFilter,
  categories,
  onAddProduct,
  onProductSearchChange,
  onProductCatFilterChange,
}) {
  return (
    <>
      <div className="product-tab-header">
        <h2 className="admin-page-title product-tab-title">商品管理</h2>
        <button type="button" onClick={onAddProduct} className="button button-primary product-add-button">
          + 商品追加
        </button>
      </div>

      {!showForm && (
        <div className="product-list-filter-row">
          <input
            value={productSearch}
            onChange={event => onProductSearchChange(event.target.value)}
            placeholder="商品名で検索..."
            className="product-list-search"
          />
          <select
            value={productCatFilter}
            onChange={event => onProductCatFilterChange(event.target.value)}
            className="product-list-filter-select"
          >
            <option value="">すべて</option>
            {categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </div>
      )}
    </>
  )
}
