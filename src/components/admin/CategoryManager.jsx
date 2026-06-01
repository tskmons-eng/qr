import CategoryRow from './CategoryRow'
import TagTemplateTools from './TagTemplateTools'

export default function CategoryManager({
  categories,
  newCatName,
  newCatGroup,
  addingCat,
  newCatAutoTagMode,
  newCatTagsInput,
  editingCatId,
  editingCatName,
  editingCatGroup,
  editingCatAutoTagMode,
  editingCatTagsInput,
  tagTemplates,
  tagTemplateName,
  savingTagTemplate,
  dragCategoryId,
  touchDrag,
  onAddCategory,
  onNewCatNameChange,
  onNewCatGroupChange,
  onToggleNewCatAutoTagMode,
  onNewCatTagsInputChange,
  onEditingCatNameChange,
  onEditingCatGroupChange,
  onToggleEditingCatAutoTagMode,
  onEditingCatTagsInputChange,
  onTagTemplateNameChange,
  onApplyTagTemplateToNewCategory,
  onApplyTagTemplateToEditingCategory,
  onSaveTagTemplate,
  onDeleteTagTemplate,
  onStartEditCategory,
  onSaveCategory,
  onCancelEditCategory,
  onDeleteCategory,
  onToggleCategoryActive,
  onMoveCategory,
  onReorderCategories,
  onSetDragCategoryId,
  onTouchStartReorder,
  onTouchMoveReorder,
  onTouchEndReorder,
  onTouchCancelReorder,
}) {
  return (
    <div>
      <h2 className="admin-page-title">カテゴリー管理</h2>
      <form onSubmit={onAddCategory} className="category-add-form">
        <input
          value={newCatName}
          onChange={event => onNewCatNameChange(event.target.value)}
          placeholder="カテゴリー名を入力"
          className="admin-text-input"
        />
        <select
          value={newCatGroup}
          onChange={event => onNewCatGroupChange(event.target.value)}
          className="category-group-select"
        >
          <option value="">分類なし</option>
          <option value="drink">ドリンク</option>
          <option value="food">フード</option>
        </select>
        <button
          type="button"
          onClick={onToggleNewCatAutoTagMode}
          className={`button category-auto-toggle${newCatAutoTagMode ? ' is-active' : ''}`}
        >
          タグ自動{newCatAutoTagMode ? 'ON' : 'OFF'}
        </button>
        <button type="submit" disabled={addingCat} className="button button-primary admin-form-submit">
          追加
        </button>
        {newCatAutoTagMode && (
          <div className="category-auto-tags">
            <input
              value={newCatTagsInput}
              onChange={event => onNewCatTagsInputChange(event.target.value)}
              placeholder="集めるタグ 例: ランチ, おすすめ"
              className="category-tags-input"
            />
            <TagTemplateTools
              currentValue={newCatTagsInput}
              templates={tagTemplates}
              templateName={tagTemplateName}
              saving={savingTagTemplate}
              onTemplateNameChange={onTagTemplateNameChange}
              onApplyTemplate={onApplyTagTemplateToNewCategory}
              onSave={onSaveTagTemplate}
              onDelete={onDeleteTagTemplate}
            />
          </div>
        )}
      </form>
      <div className="admin-list-stack">
        {categories.map((category, index) => (
          <CategoryRow
            key={category.id}
            category={category}
            isFirst={index === 0}
            isLast={index === categories.length - 1}
            isEditing={editingCatId === category.id}
            editingCatName={editingCatName}
            editingCatGroup={editingCatGroup}
            editingCatAutoTagMode={editingCatAutoTagMode}
            editingCatTagsInput={editingCatTagsInput}
            tagTemplates={tagTemplates}
            tagTemplateName={tagTemplateName}
            savingTagTemplate={savingTagTemplate}
            dragCategoryId={dragCategoryId}
            touchDrag={touchDrag}
            onEditingCatNameChange={onEditingCatNameChange}
            onEditingCatGroupChange={onEditingCatGroupChange}
            onToggleEditingCatAutoTagMode={onToggleEditingCatAutoTagMode}
            onEditingCatTagsInputChange={onEditingCatTagsInputChange}
            onTagTemplateNameChange={onTagTemplateNameChange}
            onApplyTagTemplateToEditingCategory={onApplyTagTemplateToEditingCategory}
            onSaveTagTemplate={onSaveTagTemplate}
            onDeleteTagTemplate={onDeleteTagTemplate}
            onStartEditCategory={onStartEditCategory}
            onSaveCategory={onSaveCategory}
            onCancelEditCategory={onCancelEditCategory}
            onDeleteCategory={onDeleteCategory}
            onToggleCategoryActive={onToggleCategoryActive}
            onMoveCategory={onMoveCategory}
            onReorderCategories={onReorderCategories}
            onSetDragCategoryId={onSetDragCategoryId}
            onTouchStartReorder={onTouchStartReorder}
            onTouchMoveReorder={onTouchMoveReorder}
            onTouchEndReorder={onTouchEndReorder}
            onTouchCancelReorder={onTouchCancelReorder}
          />
        ))}
        {categories.length === 0 && (
          <p className="admin-empty-state">カテゴリーがまだありません</p>
        )}
      </div>
    </div>
  )
}
