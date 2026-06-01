import { useState } from 'react'
import { serverTimestamp } from 'firebase/firestore'
import { uploadProductImage, deleteProductImage } from '../lib/imageUpload'
import {
  buildNewProductPayload,
  buildOptionsUpdatePayload,
  buildProductUpdatePayload,
  buildRelatedProductsUpdatePayload,
} from '../lib/productForm'
import { reorderById, swapSortOrderById } from '../lib/sortOrder'
import {
  batchUpdateProductSortOrderRecords,
  createProductRecord,
  updateProductRecord,
  updateProductSortOrderRecords,
} from '../services/productAdminService'

export default function useProductActions({
  storeId,
  products,
  setProducts,
  form,
  editingId,
  imageFile,
  existingImageUrl,
  setShowForm,
  resetImageState,
  loadData,
}) {
  const [saving, setSaving] = useState(false)
  const [savingOptions, setSavingOptions] = useState(false)
  const [savingRelated, setSavingRelated] = useState(false)

  async function saveOptionsOnly() {
    if (!editingId) return
    setSavingOptions(true)
    try {
      await updateProductRecord(editingId, buildOptionsUpdatePayload({ form, timestamp: serverTimestamp() }))
      await loadData()
    } finally {
      setSavingOptions(false)
    }
  }

  async function saveRelatedOnly() {
    if (!editingId) return
    setSavingRelated(true)
    try {
      await updateProductRecord(editingId, buildRelatedProductsUpdatePayload({ form, timestamp: serverTimestamp() }))
      await loadData()
    } finally {
      setSavingRelated(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim() || !form.price || !form.categoryId) return

    setSaving(true)
    try {
      let productId = editingId
      if (!productId) {
        productId = await createProductRecord(buildNewProductPayload({
          storeId,
          form,
          sortOrder: products.length,
          timestamp: serverTimestamp(),
        }))
      }

      let imageUrl = existingImageUrl ?? null
      if (imageFile) {
        imageUrl = await uploadProductImage(storeId, productId, imageFile)
      } else if (existingImageUrl === null && editingId) {
        await deleteProductImage(storeId, editingId)
      }

      await updateProductRecord(productId, buildProductUpdatePayload({
        form,
        imageUrl,
        timestamp: serverTimestamp(),
      }))

      setShowForm(false)
      resetImageState()
      await loadData()
    } finally {
      setSaving(false)
    }
  }

  async function toggleSoldOut(product) {
    await updateProductRecord(product.id, {
      isSoldOut: !product.isSoldOut,
      updatedAt: serverTimestamp(),
    })
    await loadData()
  }

  async function toggleVisible(product) {
    await updateProductRecord(product.id, {
      isVisible: !product.isVisible,
      updatedAt: serverTimestamp(),
    })
    await loadData()
  }

  async function moveProduct(product, dir) {
    const result = swapSortOrderById(products, product.id, dir)
    if (!result) return
    setProducts(result.next)
    await updateProductSortOrderRecords(result.updates)
  }

  async function reorderProducts(dragId, targetId) {
    const result = reorderById(products, dragId, targetId)
    if (!result) return
    setProducts(result.next)
    await batchUpdateProductSortOrderRecords(result.updates)
  }

  return {
    saving,
    savingOptions,
    savingRelated,
    saveOptionsOnly,
    saveRelatedOnly,
    handleSubmit,
    toggleSoldOut,
    toggleVisible,
    moveProduct,
    reorderProducts,
  }
}
