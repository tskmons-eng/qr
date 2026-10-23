import { useState } from 'react'
import MenuCategorySheet from '../../components/admin/MenuCategorySheet'
import MenuProductList from '../../components/admin/MenuProductList'
import MenuProductSheet from '../../components/admin/MenuProductSheet'
import { useStore } from '../../contexts/StoreContext'
import useMenuAdmin from '../../hooks/useMenuAdmin'
import useStoreConfig from '../../hooks/useStoreConfig'
import useTouchReorder from '../../hooks/useTouchReorder'

// メニュー管理（2026-10-23 商品設計で作り直し）。分類の見出しの下に1品1行。
// 商品と分類の追加・修正・削除は下から出るシートで。タブは分けない。
const FILTERS = [
  { key: 'all', label: 'すべて' },
  { key: 'soldOut', label: '売り切れ' },
  { key: 'hidden', label: 'お客様に出していない' },
]

function matchesFilter(product, filter) {
  if (filter === 'soldOut') return product.isSoldOut === true
  if (filter === 'hidden') return product.isVisible === false
  return true
}

export default function ProductPage() {
  const { storeId } = useStore()
  const storeConfig = useStoreConfig(storeId)
  const menu = useMenuAdmin(storeId)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [productSheet, setProductSheet] = useState(null)
  const [categorySheet, setCategorySheet] = useState(null)
  const [listError, setListError] = useState('')
  const reorder = useTouchReorder(async (type, dragId, targetId) => handleReorder(dragId, targetId))

  // 並べ替えは同じ分類の中だけ。
  async function handleReorder(dragId, targetId) {
    const dragged = menu.products.find(product => product.id === dragId)
    const target = menu.products.find(product => product.id === targetId)
    if (!dragged || !target || dragged.categoryId !== target.categoryId) return
    setListError((await menu.reorderProducts(dragId, targetId)) ?? '')
  }

  async function toggle(product, key) {
    setListError((await menu.toggleProductFlag(product, key)) ?? '')
  }

  const keyword = search.trim()
  const visibleProducts = menu.products.filter(product => (
    matchesFilter(product, filter) && (!keyword || String(product.name ?? '').includes(keyword))
  ))
  const categoryIds = new Set(menu.categories.map(category => category.id))
  const sections = [
    ...menu.categories.map(category => ({
      id: category.id,
      name: category.name,
      category,
      products: visibleProducts.filter(product => product.categoryId === category.id),
    })),
    {
      id: 'uncategorized',
      name: '分類なし',
      category: null,
      products: visibleProducts.filter(product => !categoryIds.has(product.categoryId)),
    },
  ].filter(section => section.products.length > 0 || (filter === 'all' && !keyword && section.category))
  const counts = {
    all: menu.products.length,
    soldOut: menu.products.filter(product => product.isSoldOut === true).length,
    hidden: menu.products.filter(product => product.isVisible === false).length,
  }
  const categoryIndex = categorySheet?.id ? menu.categories.findIndex(category => category.id === categorySheet.id) : -1

  return (
    <div className="menu-admin">
      <div className="menu-admin__bar">
        <input value={search} onChange={event => setSearch(event.target.value)} placeholder="商品名で探す" className="menu-admin__search" />
        <button type="button" onClick={() => setProductSheet({ product: null, categoryId: menu.categories[0]?.id ?? '' })} className="ui-button ui-button--primary">＋ 商品</button>
      </div>
      <div className="menu-admin__chips">
        {FILTERS.map(item => (
          <button key={item.key} type="button" onClick={() => setFilter(item.key)} className={`menu-admin__chip${filter === item.key ? ' is-on' : ''}`}>
            {item.label} {counts[item.key]}
          </button>
        ))}
        <button type="button" onClick={() => setCategorySheet({})} className="menu-admin__chip">＋ 分類</button>
      </div>
      {(menu.loadError || listError) && <p className="menu-sheet__error" role="alert">{menu.loadError || listError}</p>}
      {menu.loading ? (
        <p className="menu-admin__empty">読み込み中...</p>
      ) : menu.categories.length === 0 ? (
        <p className="menu-admin__empty">まず「＋ 分類」から分類（例：ビール・焼き鳥）を作ってください。</p>
      ) : (
        <MenuProductList
          sections={sections}
          touchDrag={reorder.touchDrag}
          reorderHandlers={{
            onDrop: handleReorder,
            onTouchStart: reorder.startTouchReorder,
            onTouchMove: reorder.moveTouchReorder,
            onTouchEnd: reorder.finishTouchReorder,
            onTouchCancel: reorder.cancelTouchReorder,
          }}
          onOpenProduct={product => setProductSheet({ product, categoryId: product.categoryId })}
          onToggleSoldOut={product => toggle(product, 'isSoldOut')}
          onToggleVisible={product => toggle(product, 'isVisible')}
          onOpenCategory={category => setCategorySheet(category)}
        />
      )}
      {productSheet && (
        <MenuProductSheet
          product={productSheet.product}
          initialCategoryId={productSheet.categoryId}
          categories={menu.categories}
          onSave={menu.saveProduct}
          onDelete={product => (storeConfig
            ? menu.deleteProduct(product, { guestAutoAddProductId: storeConfig.guestAutoAdd?.productId })
            // 設定を読み込む前は、人数分の自動追加に使う商品かどうか分からないので消さない。
            : Promise.resolve('店の設定を読み込んでいます。少し待ってから、もう一度お試しください'))}
          onQuickCategory={menu.createCategory}
          onClose={() => setProductSheet(null)}
        />
      )}
      {categorySheet && (
        <MenuCategorySheet
          category={categorySheet.id ? (menu.categories.find(category => category.id === categorySheet.id) ?? categorySheet) : null}
          isFirst={categoryIndex === 0}
          isLast={categoryIndex === menu.categories.length - 1}
          onSave={menu.saveCategory}
          onMove={menu.moveCategory}
          onDelete={menu.deleteCategory}
          onClose={() => setCategorySheet(null)}
        />
      )}
    </div>
  )
}
