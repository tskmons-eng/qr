import { normalizeTags } from '../../lib/productTags'
import TagTemplateTools from './TagTemplateTools'

export default function ProductTagEditor({
  tagsInput,
  suggestions,
  tagTemplates,
  tagTemplateName,
  savingTagTemplate,
  onTagsInputChange,
  onTagTemplateNameChange,
  onApplyTemplate,
  onSaveTemplate,
  onDeleteTemplate,
}) {
  const selectedTags = normalizeTags(tagsInput)

  return (
    <div>
      <label className="product-form-label">タグ（自動カテゴリ用・任意）</label>
      <input
        value={tagsInput}
        onChange={event => onTagsInputChange(event.target.value)}
        placeholder="例: ランチ, おすすめ, 辛い"
        className="product-form-input"
      />
      <div className="product-form-help">カンマ・スペース区切り。カテゴリの自動表示モードで、このタグの商品を集められます。</div>
      <TagTemplateTools
        currentValue={tagsInput}
        templates={tagTemplates}
        templateName={tagTemplateName}
        saving={savingTagTemplate}
        onTemplateNameChange={onTagTemplateNameChange}
        onApplyTemplate={onApplyTemplate}
        onSave={onSaveTemplate}
        onDelete={onDeleteTemplate}
      />
      {suggestions.length > 0 && (
        <div className="product-tag-suggestions">
          <span className="product-tag-suggestions-label">既存タグ</span>
          {suggestions.map(tag => {
            const active = selectedTags.includes(tag)
            const nextTags = active ? selectedTags.filter(value => value !== tag) : [...selectedTags, tag]
            return (
              <button
                key={tag}
                type="button"
                onClick={() => onTagsInputChange(nextTags.join(', '))}
                className={`button chip-button${active ? ' is-active' : ''}`}
              >
                #{tag}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
