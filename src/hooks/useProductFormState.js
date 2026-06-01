import { useRef, useState } from 'react'
import { emptyProductForm, normalizeChoices, normalizeDiscountConfig } from '../lib/productForm'

export default function useProductFormState() {
  const [form, setForm] = useState(emptyProductForm)
  const [editingId, setEditingId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [relatedSearch, setRelatedSearch] = useState('')
  const [relatedCatFilter, setRelatedCatFilter] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [existingImageUrl, setExistingImageUrl] = useState(null)
  const fileInputRef = useRef(null)

  function resetImageState() {
    setImageFile(null)
    setImagePreview(null)
    setExistingImageUrl(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function resetRelatedFilters() {
    setRelatedSearch('')
    setRelatedCatFilter('')
  }

  function openAddBase() {
    setForm(emptyProductForm)
    setEditingId(null)
    setShowForm(true)
    resetRelatedFilters()
    resetImageState()
  }

  function openEditBase(product) {
    const options = (product.options ?? []).map(group => ({
      ...group,
      choices: normalizeChoices(group.choices),
    }))

    setForm({
      name: product.name,
      price: String(product.price),
      categoryId: product.categoryId,
      isVisible: product.isVisible,
      isSoldOut: product.isSoldOut,
      optionsEnabled: options.length > 0,
      options,
      linkedEnabled: (product.linkedProductIds ?? []).length > 0,
      linkedProductIds: product.linkedProductIds ?? [],
      displayCategoryIds: product.displayCategoryIds ?? [],
      tagsInput: (product.tags ?? []).join(', '),
      discountConfig: normalizeDiscountConfig(product.discountConfig),
    })
    setEditingId(product.id)
    setShowForm(true)
    resetRelatedFilters()
    setImageFile(null)
    setImagePreview(null)
    setExistingImageUrl(product.imageUrl ?? null)
    if (fileInputRef.current) fileInputRef.current.value = ''

    return options
  }

  function handleFileSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  function clearImage() {
    resetImageState()
  }

  function updateFormField(key, value) {
    setForm(form => ({ ...form, [key]: value }))
  }

  function toggleLinked(productId) {
    setForm(form => {
      const ids = form.linkedProductIds ?? []
      return {
        ...form,
        linkedProductIds: ids.includes(productId)
          ? ids.filter(id => id !== productId)
          : [...ids, productId],
      }
    })
  }

  function toggleLinkedEnabled() {
    setForm(form => ({
      ...form,
      linkedEnabled: !form.linkedEnabled,
      linkedProductIds: !form.linkedEnabled ? form.linkedProductIds : [],
    }))
  }

  function toggleDisplayCat(catId) {
    setForm(form => {
      const ids = form.displayCategoryIds ?? []
      return {
        ...form,
        displayCategoryIds: ids.includes(catId)
          ? ids.filter(id => id !== catId)
          : [...ids, catId],
      }
    })
  }

  function updateDiscountConfig(patch) {
    setForm(form => ({ ...form, discountConfig: { ...form.discountConfig, ...patch } }))
  }

  function toggleDiscountWeekday(day) {
    setForm(form => {
      const current = form.discountConfig.weekdays ?? []
      const weekdays = current.includes(day)
        ? current.filter(d => d !== day)
        : [...current, day].sort((a, b) => a - b)
      return { ...form, discountConfig: { ...form.discountConfig, weekdays } }
    })
  }

  return {
    form,
    setForm,
    editingId,
    setEditingId,
    showForm,
    setShowForm,
    relatedSearch,
    setRelatedSearch,
    relatedCatFilter,
    setRelatedCatFilter,
    imageFile,
    imagePreview,
    existingImageUrl,
    fileInputRef,
    resetImageState,
    openAddBase,
    openEditBase,
    handleFileSelect,
    clearImage,
    updateFormField,
    toggleLinked,
    toggleLinkedEnabled,
    toggleDisplayCat,
    updateDiscountConfig,
    toggleDiscountWeekday,
  }
}
