import { useState } from 'react'
import { cleanOptionGroups, mergeTagsInput } from '../lib/productForm'
import { normalizeTags } from '../lib/productTags'
import {
  deleteOptionTemplateRecord,
  deleteTagTemplateRecord,
  saveOptionTemplateRecord,
  saveTagTemplateRecord,
} from '../services/productAdminService'

export default function useProductTemplateAdmin({
  storeId,
  form,
  setForm,
  optionTemplates,
  tagTemplates,
  loadData,
}) {
  const [savingOptionTemplate, setSavingOptionTemplate] = useState(false)
  const [optionTemplateName, setOptionTemplateName] = useState('')
  const [savingTagTemplate, setSavingTagTemplate] = useState(false)
  const [tagTemplateName, setTagTemplateName] = useState('')

  async function saveOptionTemplate() {
    const name = optionTemplateName.trim()
    if (!name) {
      alert('テンプレート名を入力してください。')
      return
    }

    const options = cleanOptionGroups(form.options)
    if (options.length === 0) {
      alert('保存できるオプションがありません。グループ名と選択肢を入力してください。')
      return
    }

    const existing = optionTemplates.find(template => template.name === name)
    if (existing && !confirm(`「${name}」を上書きしますか？`)) return

    setSavingOptionTemplate(true)
    try {
      await saveOptionTemplateRecord({ storeId, templateId: existing?.id, name, options })
      setOptionTemplateName('')
      await loadData()
    } finally {
      setSavingOptionTemplate(false)
    }
  }

  async function deleteOptionTemplate(template) {
    if (!confirm(`「${template.name}」を削除しますか？\n商品に適用済みのオプションは消えません。`)) return
    await deleteOptionTemplateRecord(template.id)
    await loadData()
  }

  function applyTagTemplateToProduct(template) {
    setForm(form => ({ ...form, tagsInput: mergeTagsInput(form.tagsInput, template.tags) }))
  }

  async function saveTagTemplate(tagsSource) {
    const name = tagTemplateName.trim()
    if (!name) {
      alert('タグセット名を入力してください。')
      return
    }

    const tags = normalizeTags(tagsSource)
    if (tags.length === 0) {
      alert('保存するタグを入力してください。')
      return
    }

    const existing = tagTemplates.find(template => template.name === name)
    if (existing && !confirm(`「${name}」を上書きしますか？`)) return

    setSavingTagTemplate(true)
    try {
      await saveTagTemplateRecord({ storeId, templateId: existing?.id, name, tags })
      setTagTemplateName('')
      await loadData()
    } finally {
      setSavingTagTemplate(false)
    }
  }

  async function deleteTagTemplate(template) {
    if (!confirm(`「${template.name}」を削除しますか？\n商品やカテゴリに適用済みのタグは消えません。`)) return
    await deleteTagTemplateRecord(template.id)
    await loadData()
  }

  return {
    savingOptionTemplate,
    optionTemplateName,
    setOptionTemplateName,
    saveOptionTemplate,
    deleteOptionTemplate,
    savingTagTemplate,
    tagTemplateName,
    setTagTemplateName,
    applyTagTemplateToProduct,
    saveTagTemplate,
    deleteTagTemplate,
  }
}
