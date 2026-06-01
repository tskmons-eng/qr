import { useEffect, useState } from 'react'
import AdminCategoryForm from '../../components/admin/AdminCategoryForm'
import AdminCategoryList from '../../components/admin/AdminCategoryList'
import { useStore } from '../../contexts/StoreContext'
import {
  createAdminCategory,
  subscribeAdminCategories,
  toggleAdminCategoryActive,
} from '../../services/adminCategoryService'

export default function CategoryPage() {
  const { storeId } = useStore()
  const [categories, setCategories] = useState([])
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    if (!storeId) return undefined
    return subscribeAdminCategories(storeId, setCategories)
  }, [storeId])

  async function handleAdd(event) {
    event.preventDefault()
    if (!newName.trim()) return
    setAdding(true)
    await createAdminCategory({
      storeId,
      name: newName,
      categoriesCount: categories.length,
    })
    setNewName('')
    setAdding(false)
  }

  return (
    <div className="admin-category">
      <h2 className="admin-category__title">カテゴリー管理</h2>
      <AdminCategoryForm
        adding={adding}
        name={newName}
        onNameChange={setNewName}
        onSubmit={handleAdd}
      />
      <AdminCategoryList
        categories={categories}
        onToggleActive={toggleAdminCategoryActive}
      />
    </div>
  )
}
