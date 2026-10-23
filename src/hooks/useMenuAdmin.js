import { useCallback, useEffect, useState } from 'react'
import { serverTimestamp } from 'firebase/firestore'
import { deleteProductImage, uploadProductImage } from '../lib/imageUpload'
import {
  buildCategoryPayload,
  buildCategoryUpdatePayload,
  buildNewProductPayload,
  buildProductUpdatePayload,
  nextSortOrder,
  validateProductForm,
} from '../lib/productForm'
import { reorderById, swapSortOrderById } from '../lib/sortOrder'
import {
  batchUpdateCategorySortOrderRecords,
  batchUpdateProductSortOrderRecords,
  createCategoryRecord,
  createProductRecord,
  deleteCategoryRecord,
  deleteProductRecord,
  loadProductAdminData,
  updateCategoryRecord,
  updateProductRecord,
} from '../services/productAdminService'

const SAVE_FAILED = '保存できませんでした。通信を確かめて、もう一度お試しください'

// メニュー管理の状態と操作（2026-10-23 商品設計で作り直し。以前の5つの hook をまとめた）。
// 操作は失敗したら文言を返し、成功したら null を返す（シートに出す）。
export default function useMenuAdmin(storeId) {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const loadData = useCallback(async () => {
    if (!storeId) return
    try {
      const data = await loadProductAdminData(storeId)
      setProducts(data.products)
      setCategories(data.categories)
      setLoadError('')
    } catch {
      setLoadError('メニューを読み込めませんでした。通信を確かめてください')
    } finally {
      setLoading(false)
    }
  }, [storeId])

  useEffect(() => { loadData() }, [loadData])

  // removeImage：もともと写真があった商品で「外す」を押したときだけ、保存先の写真も消す。
  // 返す値は { error, productId }。新しい商品は選ぶもの・割引まで1回で作り、写真だけ後から足す。
  // 写真で失敗しても作った id を返すので、もう一度押すと同じ商品を直す（2重に登録しない）。
  async function saveProduct({ productId, form, imageFile, existingImageUrl, removeImage = false }) {
    const validationError = validateProductForm(form)
    if (validationError) return { error: validationError, productId }
    let id = productId
    try {
      if (!id) {
        id = await createProductRecord({
          ...buildProductUpdatePayload({ form, imageUrl: null, timestamp: serverTimestamp() }),
          ...buildNewProductPayload({
            storeId,
            form,
            sortOrder: nextSortOrder(products),
            timestamp: serverTimestamp(),
          }),
        })
        if (!imageFile) {
          await loadData()
          return { error: null, productId: id }
        }
      }
      let imageUrl = existingImageUrl ?? null
      if (imageFile) {
        imageUrl = await uploadProductImage(storeId, id, imageFile)
      } else if (removeImage && productId) {
        await deleteProductImage(storeId, productId)
      }
      await updateProductRecord(id, buildProductUpdatePayload({ form, imageUrl, timestamp: serverTimestamp() }))
      await loadData()
      return { error: null, productId: id }
    } catch {
      if (id && !productId) await loadData().catch(() => {})
      return { error: SAVE_FAILED, productId: id }
    }
  }

  // 売り切れ・お客様に出す：押したらすぐ保存し、画面も先に変える（失敗したら戻す）。
  async function toggleProductFlag(product, key) {
    const nextValue = key === 'isVisible' ? product.isVisible === false : !product.isSoldOut
    setProducts(prev => prev.map(item => (item.id === product.id ? { ...item, [key]: nextValue } : item)))
    try {
      await updateProductRecord(product.id, { [key]: nextValue, updatedAt: serverTimestamp() })
      return null
    } catch {
      setProducts(prev => prev.map(item => (item.id === product.id ? { ...item, [key]: product[key] } : item)))
      return SAVE_FAILED
    }
  }

  // 削除：過去の注文・会計・集計は注文の側に名前と値段を残しているので消えない。人数分の自動追加に使う商品は消さない。
  async function deleteProduct(product, { guestAutoAddProductId } = {}) {
    if (guestAutoAddProductId && guestAutoAddProductId === product.id) {
      return 'この商品は人数分の自動追加に使っています。先に設定で別の商品にしてください'
    }
    try {
      await deleteProductRecord(product.id)
      if (product.imageUrl) await deleteProductImage(storeId, product.id)
      setProducts(prev => prev.filter(item => item.id !== product.id))
      return null
    } catch {
      return '削除できませんでした。通信を確かめて、もう一度お試しください'
    }
  }

  async function reorderProducts(dragId, targetId) {
    const result = reorderById(products, dragId, targetId)
    if (!result) return null
    setProducts(result.next)
    try {
      await batchUpdateProductSortOrderRecords(result.updates)
      return null
    } catch {
      await loadData()
      return SAVE_FAILED
    }
  }

  async function saveCategory({ categoryId, name, group, isActive }) {
    if (!name.trim()) return '分類の名前を入れてください'
    try {
      if (categoryId) {
        await updateCategoryRecord(categoryId, buildCategoryUpdatePayload({ name, group, isActive, timestamp: serverTimestamp() }))
      } else {
        await createCategoryRecord(buildCategoryPayload({
          storeId,
          name,
          group,
          sortOrder: nextSortOrder(categories),
          timestamp: serverTimestamp(),
        }))
      }
      await loadData()
      return null
    } catch {
      return SAVE_FAILED
    }
  }

  // 商品の入力の途中で、新しい分類をその場で作る（作った分類をすぐ選べるように id を返す）。
  async function createCategory(name) {
    if (!name.trim()) return { error: '分類の名前を入れてください' }
    try {
      const id = await createCategoryRecord(buildCategoryPayload({
        storeId,
        name,
        group: '',
        sortOrder: nextSortOrder(categories),
        timestamp: serverTimestamp(),
      }))
      await loadData()
      return { id }
    } catch {
      return { error: SAVE_FAILED }
    }
  }

  async function moveCategory(categoryId, direction) {
    const result = swapSortOrderById(categories, categoryId, direction)
    if (!result) return null
    setCategories(result.next)
    try {
      await batchUpdateCategorySortOrderRecords(result.updates)
      return null
    } catch {
      await loadData()
      return SAVE_FAILED
    }
  }

  // 商品が入っている分類は消さない（商品がどこにも出なくなるため）。
  async function deleteCategory(category) {
    if (products.some(product => product.categoryId === category.id)) {
      return '商品が入っている分類は削除できません。先に商品を別の分類へ移してください'
    }
    try {
      await deleteCategoryRecord(category.id)
      setCategories(prev => prev.filter(item => item.id !== category.id))
      return null
    } catch {
      return '削除できませんでした。通信を確かめて、もう一度お試しください'
    }
  }

  return {
    products,
    categories,
    loading,
    loadError,
    saveProduct,
    toggleProductFlag,
    deleteProduct,
    reorderProducts,
    saveCategory,
    createCategory,
    moveCategory,
    deleteCategory,
  }
}
