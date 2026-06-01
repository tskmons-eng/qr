import { useState, useEffect, useCallback } from 'react'
import { useStore } from '../../contexts/StoreContext'
import AdminTabs from '../../components/admin/AdminTabs'
import ProductCategoriesTab from '../../components/admin/ProductCategoriesTab'
import ProductProductsTab from '../../components/admin/ProductProductsTab'
import { isDiscountActive } from '../../lib/discounts'
import { normalizeTags, productMatchesCategory } from '../../lib/productTags'
import useProductActions from '../../hooks/useProductActions'
import useProductCategoryAdmin from '../../hooks/useProductCategoryAdmin'
import useProductFormState from '../../hooks/useProductFormState'
import useProductOptionForm from '../../hooks/useProductOptionForm'
import useProductTemplateAdmin from '../../hooks/useProductTemplateAdmin'
import useTouchReorder from '../../hooks/useTouchReorder'
import { discountLabel } from '../../lib/productForm'
import { loadProductAdminData } from '../../services/productAdminService'

export default function ProductPage() {
  const { storeId } = useStore()
  const [tab, setTab] = useState('products')
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [optionTemplates, setOptionTemplates] = useState([])
  const [tagTemplates, setTagTemplates] = useState([])

  // product list filters
  const [productSearch, setProductSearch] = useState('')
  const [productCatFilter, setProductCatFilter] = useState('')

  const [dragProductId, setDragProductId] = useState(null)
  const [dragCategoryId, setDragCategoryId] = useState(null)
  const productForm = useProductFormState()
  const optionForm = useProductOptionForm({ setForm: productForm.setForm })
  const { touchDrag, startTouchReorder, moveTouchReorder, finishTouchReorder, cancelTouchReorder } = useTouchReorder(handleTouchReorder)

  const loadData = useCallback(async () => {
    if (!storeId) return
    const data = await loadProductAdminData(storeId)
    setProducts(data.products)
    setCategories(data.categories)
    setOptionTemplates(data.optionTemplates)
    setTagTemplates(data.tagTemplates)
  }, [storeId])

  useEffect(() => { loadData() }, [loadData])

  const categoryAdmin = useProductCategoryAdmin({
    storeId,
    categories,
    setCategories,
    products,
    setForm: productForm.setForm,
    loadData,
  })
  const templateAdmin = useProductTemplateAdmin({
    storeId,
    form: productForm.form,
    setForm: productForm.setForm,
    optionTemplates,
    tagTemplates,
    loadData,
  })
  const productActions = useProductActions({
    storeId,
    products,
    setProducts,
    form: productForm.form,
    editingId: productForm.editingId,
    imageFile: productForm.imageFile,
    existingImageUrl: productForm.existingImageUrl,
    setShowForm: productForm.setShowForm,
    resetImageState: productForm.resetImageState,
    loadData,
  })

  const activeCategories = categories.filter(c => c.isActive)

  // カテゴリグループ絞り込み済みリスト（フォーム内で使用）
  const catsForSelect = categoryAdmin.catGroupFilter
    ? activeCategories.filter(c => c.group === categoryAdmin.catGroupFilter)
    : activeCategories

  // 既存オプショングループ名サジェスト
  const allGroupNames = [...new Set(
    [
      ...products.flatMap(p => (p.options ?? []).map(g => g.groupName)),
      ...optionTemplates.flatMap(t => (t.options ?? []).map(g => g.groupName)),
    ].filter(Boolean)
  )]

  // ─── 画像 ───
  // ─── フォーム開閉 ───
  function openAdd() {
    productForm.openAddBase()
    optionForm.setNewChoiceInputs([])
    categoryAdmin.resetQuickCategory()
  }

  function openEdit(p) {
    const opts = productForm.openEditBase(p)
    optionForm.setNewChoiceInputs(opts.map(() => ({ label: '', extraPrice: '' })))
    categoryAdmin.resetQuickCategory()
  }

  async function handleTouchReorder(type, dragId, targetId) {
    if (type === 'product') await productActions.reorderProducts(dragId, targetId)
    if (type === 'category') await categoryAdmin.reorderCategories(dragId, targetId)
  }

  // ─── セクション単独保存 ───
  const catName = id => categories.find(c => c.id === id)?.name ?? ''

  const otherProducts = products.filter(p => p.id !== productForm.editingId)
  const allProductTags = [...new Set(products.flatMap(p => normalizeTags(p.tags)))]
  const allTagSuggestions = [...new Set([
    ...allProductTags,
    ...tagTemplates.flatMap(t => normalizeTags(t.tags)),
  ])]
  const filteredRelated = otherProducts.filter(p => {
    const matchCat = !productForm.relatedCatFilter || p.categoryId === productForm.relatedCatFilter
    const matchSearch = !productForm.relatedSearch || p.name.includes(productForm.relatedSearch)
    return matchCat && matchSearch
  })
  const displayedProducts = products.filter(p => {
    const filterCat = categories.find(c => c.id === productCatFilter)
    const matchCat = !productCatFilter || productMatchesCategory(p, filterCat)
    const productTags = normalizeTags(p.tags)
    const matchSearch = !productSearch || p.name.includes(productSearch) || productTags.some(tag => tag.includes(productSearch))
    return matchCat && matchSearch
  })

  return (
    <div>
      <AdminTabs
        current={tab}
        tabs={[
          { key: 'products', label: '商品' },
          { key: 'categories', label: 'カテゴリー' },
        ]}
        onSelect={nextTab => {
          setTab(nextTab)
          productForm.setShowForm(false)
        }}
      />

      {tab === 'products' && (
        <ProductProductsTab
          productState={{ showForm: productForm.showForm, productSearch, productCatFilter }}
          productData={{
            products,
            displayedProducts,
            categories,
            activeCategories,
            catsForSelect,
            allTagSuggestions,
            allGroupNames,
          }}
          formState={{
            ...productForm,
            catGroupFilter: categoryAdmin.catGroupFilter,
            showQuickCat: categoryAdmin.showQuickCat,
            quickCatName: categoryAdmin.quickCatName,
            imageUrl: productForm.imagePreview ?? productForm.existingImageUrl,
            saving: productActions.saving,
          }}
          templateState={{
            ...templateAdmin,
            tagTemplates,
            optionTemplates,
          }}
          optionState={{ ...optionForm, savingOptions: productActions.savingOptions }}
          relatedState={{
            relatedSearch: productForm.relatedSearch,
            relatedCatFilter: productForm.relatedCatFilter,
            filteredRelated,
            savingRelated: productActions.savingRelated,
          }}
          dragState={{ dragProductId, touchDrag }}
          actions={{
            openAdd,
            openEdit,
            ...productForm,
            ...categoryAdmin,
            ...templateAdmin,
            ...optionForm,
            ...productActions,
            closeForm: () => productForm.setShowForm(false),
            setProductSearch,
            setProductCatFilter,
            showQuickCategory: () => categoryAdmin.setShowQuickCat(true),
            hideQuickCategory: () => categoryAdmin.setShowQuickCat(false),
            getCategoryName: catName,
            setDragProductId,
            startTouchReorder,
            moveTouchReorder,
            finishTouchReorder,
            cancelTouchReorder,
          }}
        />
      )}

      {tab === 'categories' && (
        <ProductCategoriesTab
          categoryState={{
            ...categoryAdmin,
            categories,
          }}
          templateState={{ ...templateAdmin, tagTemplates }}
          dragState={{ dragCategoryId, touchDrag }}
          actions={{
            ...categoryAdmin,
            ...templateAdmin,
            toggleNewCatAutoTagMode: () => categoryAdmin.setNewCatAutoTagMode(value => !value),
            toggleEditingCatAutoTagMode: () => categoryAdmin.setEditingCatAutoTagMode(value => !value),
            cancelEditCategory: () => categoryAdmin.setEditingCatId(null),
            setDragCategoryId,
            startTouchReorder,
            moveTouchReorder,
            finishTouchReorder,
            cancelTouchReorder,
          }}
        />
      )}
    </div>
  )
}
