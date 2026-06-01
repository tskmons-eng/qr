import { useState } from 'react'
import { serverTimestamp } from 'firebase/firestore'
import {
  buildCategoryPayload,
  buildCategoryUpdatePayload,
  buildQuickCategoryPayload,
  mergeTagsInput,
} from '../lib/productForm'
import { reorderById, swapSortOrderById } from '../lib/sortOrder'
import {
  batchUpdateCategorySortOrderRecords,
  createCategoryRecord,
  deleteCategoryRecordWithDisplayRefs,
  updateCategoryRecord,
  updateCategorySortOrderRecords,
} from '../services/productAdminService'

export default function useProductCategoryAdmin({
  storeId,
  categories,
  setCategories,
  products,
  setForm,
  loadData,
}) {
  const [showQuickCat, setShowQuickCat] = useState(false)
  const [quickCatName, setQuickCatName] = useState('')
  const [catGroupFilter, setCatGroupFilter] = useState('')

  const [newCatName, setNewCatName] = useState('')
  const [newCatGroup, setNewCatGroup] = useState('')
  const [addingCat, setAddingCat] = useState(false)
  const [editingCatId, setEditingCatId] = useState(null)
  const [editingCatName, setEditingCatName] = useState('')
  const [editingCatGroup, setEditingCatGroup] = useState('')
  const [newCatAutoTagMode, setNewCatAutoTagMode] = useState(false)
  const [newCatTagsInput, setNewCatTagsInput] = useState('')
  const [editingCatAutoTagMode, setEditingCatAutoTagMode] = useState(false)
  const [editingCatTagsInput, setEditingCatTagsInput] = useState('')

  function resetQuickCategory() {
    setShowQuickCat(false)
    setQuickCatName('')
    setCatGroupFilter('')
  }

  function changeCategoryGroupFilter(key) {
    setCatGroupFilter(key)
    setForm(form => ({ ...form, categoryId: '' }))
  }

  async function handleQuickAddCat(e) {
    e.preventDefault()
    if (!quickCatName.trim()) return

    const categoryId = await createCategoryRecord(buildQuickCategoryPayload({
      storeId,
      name: quickCatName,
      sortOrder: categories.length,
      timestamp: serverTimestamp(),
    }))
    setForm(form => ({ ...form, categoryId }))
    setQuickCatName('')
    setShowQuickCat(false)
    await loadData()
  }

  async function handleAddCat(e) {
    e.preventDefault()
    if (!newCatName.trim()) return

    setAddingCat(true)
    try {
      await createCategoryRecord(buildCategoryPayload({
        storeId,
        name: newCatName,
        group: newCatGroup,
        autoTagMode: newCatAutoTagMode,
        tagsInput: newCatTagsInput,
        sortOrder: categories.length,
        timestamp: serverTimestamp(),
      }))
      setNewCatName('')
      setNewCatGroup('')
      setNewCatAutoTagMode(false)
      setNewCatTagsInput('')
      await loadData()
    } finally {
      setAddingCat(false)
    }
  }

  async function toggleCatActive(cat) {
    await updateCategoryRecord(cat.id, { isActive: !cat.isActive, updatedAt: serverTimestamp() })
    await loadData()
  }

  async function deleteCat(cat) {
    const mainProducts = products.filter(product => product.categoryId === cat.id)
    const displayProducts = products.filter(product => (product.displayCategoryIds ?? []).includes(cat.id))
    const messages = [`「${cat.name}」を削除しますか？`]

    if (mainProducts.length > 0) {
      messages.push(`${mainProducts.length}件の商品がこのカテゴリに所属しています。削除後は商品編集で別カテゴリへ変更してください。`)
    }
    if (displayProducts.length > 0) {
      messages.push(`${displayProducts.length}件の商品から追加表示カテゴリの参照を外します。`)
    }
    if (!confirm(messages.join('\n'))) return

    await deleteCategoryRecordWithDisplayRefs(
      cat.id,
      displayProducts.map(product => ({
        id: product.id,
        displayCategoryIds: (product.displayCategoryIds ?? []).filter(id => id !== cat.id),
      }))
    )
    if (editingCatId === cat.id) setEditingCatId(null)
    await loadData()
  }

  function startEditCat(cat) {
    setEditingCatId(cat.id)
    setEditingCatName(cat.name)
    setEditingCatGroup(cat.group ?? '')
    setEditingCatAutoTagMode(!!cat.autoTagMode)
    setEditingCatTagsInput((cat.autoTags ?? []).join(', '))
  }

  async function saveCatName(cat) {
    if (!editingCatName.trim()) return

    await updateCategoryRecord(cat.id, buildCategoryUpdatePayload({
      name: editingCatName,
      group: editingCatGroup,
      autoTagMode: editingCatAutoTagMode,
      tagsInput: editingCatTagsInput,
      timestamp: serverTimestamp(),
    }))
    setEditingCatId(null)
    await loadData()
  }

  async function moveCat(cat, dir) {
    const result = swapSortOrderById(categories, cat.id, dir)
    if (!result) return

    setCategories(result.next)
    await updateCategorySortOrderRecords(result.updates)
  }

  async function reorderCategories(dragId, targetId) {
    const result = reorderById(categories, dragId, targetId)
    if (!result) return

    setCategories(result.next)
    await batchUpdateCategorySortOrderRecords(result.updates)
  }

  function applyTagTemplateToNewCategory(template) {
    setNewCatAutoTagMode(true)
    setNewCatTagsInput(value => mergeTagsInput(value, template.tags))
  }

  function applyTagTemplateToEditingCategory(template) {
    setEditingCatAutoTagMode(true)
    setEditingCatTagsInput(value => mergeTagsInput(value, template.tags))
  }

  return {
    showQuickCat,
    setShowQuickCat,
    quickCatName,
    setQuickCatName,
    catGroupFilter,
    resetQuickCategory,
    changeCategoryGroupFilter,
    handleQuickAddCat,
    newCatName,
    setNewCatName,
    newCatGroup,
    setNewCatGroup,
    addingCat,
    editingCatId,
    setEditingCatId,
    editingCatName,
    setEditingCatName,
    editingCatGroup,
    setEditingCatGroup,
    newCatAutoTagMode,
    setNewCatAutoTagMode,
    newCatTagsInput,
    setNewCatTagsInput,
    editingCatAutoTagMode,
    setEditingCatAutoTagMode,
    editingCatTagsInput,
    setEditingCatTagsInput,
    handleAddCat,
    toggleCatActive,
    deleteCat,
    startEditCat,
    saveCatName,
    moveCat,
    reorderCategories,
    applyTagTemplateToNewCategory,
    applyTagTemplateToEditingCategory,
  }
}
