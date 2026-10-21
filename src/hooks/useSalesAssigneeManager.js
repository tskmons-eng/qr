import { useState } from 'react'
import { sortSalesAssignees } from '../lib/adminSales'
import { createSalesAssignee, updateSalesAssignee } from '../services/salesHistoryService'

function errorMessage(error, fallback) {
  return error?.message || fallback
}

// 売上担当者の追加・更新。売上画面のモーダルとスタッフ側の専用ページで共通に使う。
export default function useSalesAssigneeManager({ storeId, activeStaff, setAssignees }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  function resetMessages() {
    setError('')
    setSuccessMessage('')
  }

  async function handleCreate(name) {
    setSaving(true)
    resetMessages()
    try {
      const created = await createSalesAssignee({ storeId, name, activeStaff })
      setAssignees(previous => sortSalesAssignees([...previous, created]))
      setSuccessMessage(`担当者「${created.name}」を追加しました。`)
    } catch (saveError) {
      setError(errorMessage(saveError, '担当者を追加できませんでした。'))
      throw saveError
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdate(assignee, patch) {
    setSaving(true)
    resetMessages()
    try {
      const updated = await updateSalesAssignee({
        storeId,
        assigneeId: assignee.id,
        name: patch.name,
        isActive: patch.isActive,
        activeStaff,
      })
      setAssignees(previous => sortSalesAssignees(previous.map(item => (
        item.id === assignee.id ? { ...item, ...updated } : item
      ))))
      const nextIsActive = patch.isActive ?? assignee.isActive !== false
      const nextName = patch.name ?? assignee.name
      const activeChanged = (assignee.isActive !== false) !== nextIsActive
      setSuccessMessage(activeChanged
        ? `「${nextName}」を${nextIsActive ? '再有効化' : '無効に'}しました。`
        : `担当者名を「${nextName}」に変更しました。`)
    } catch (saveError) {
      setError(errorMessage(saveError, '担当者を更新できませんでした。'))
      throw saveError
    } finally {
      setSaving(false)
    }
  }

  return {
    resetMessages,
    modalProps: {
      error,
      saving,
      successMessage,
      onCreate: handleCreate,
      onUpdate: handleUpdate,
    },
  }
}
