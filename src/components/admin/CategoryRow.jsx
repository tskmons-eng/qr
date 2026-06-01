import TagTemplateTools from './TagTemplateTools'

export default function CategoryRow({
  category,
  isFirst,
  isLast,
  isEditing,
  editingCatName,
  editingCatGroup,
  editingCatAutoTagMode,
  editingCatTagsInput,
  tagTemplates,
  tagTemplateName,
  savingTagTemplate,
  dragCategoryId,
  touchDrag,
  onEditingCatNameChange,
  onEditingCatGroupChange,
  onToggleEditingCatAutoTagMode,
  onEditingCatTagsInputChange,
  onTagTemplateNameChange,
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
  const isDragging = dragCategoryId === category.id || touchDrag?.id === category.id
  const className = [
    'category-list-item',
    isEditing ? 'is-editing' : '',
    touchDrag?.targetId === category.id ? 'is-reorder-target' : '',
    isDragging ? 'is-dragging' : '',
    touchDrag?.type === 'category' ? 'is-touch-reordering' : '',
  ].filter(Boolean).join(' ')

  return (
    <div
      data-reorder-type="category"
      data-reorder-id={category.id}
      draggable={!isEditing}
      onTouchStart={event => {
        if (!isEditing) onTouchStartReorder('category', category.id, event)
      }}
      onTouchMove={event => onTouchMoveReorder('category', event)}
      onTouchEnd={event => onTouchEndReorder('category', event)}
      onTouchCancel={onTouchCancelReorder}
      onDragStart={event => {
        onSetDragCategoryId(category.id)
        event.dataTransfer.effectAllowed = 'move'
      }}
      onDragOver={event => event.preventDefault()}
      onDrop={async event => {
        event.preventDefault()
        await onReorderCategories(dragCategoryId, category.id)
        onSetDragCategoryId(null)
      }}
      onDragEnd={() => onSetDragCategoryId(null)}
      className={className}
    >
      {isEditing ? (
        <CategoryEditRow
          category={category}
          editingCatName={editingCatName}
          editingCatGroup={editingCatGroup}
          editingCatAutoTagMode={editingCatAutoTagMode}
          editingCatTagsInput={editingCatTagsInput}
          tagTemplates={tagTemplates}
          tagTemplateName={tagTemplateName}
          savingTagTemplate={savingTagTemplate}
          onEditingCatNameChange={onEditingCatNameChange}
          onEditingCatGroupChange={onEditingCatGroupChange}
          onToggleEditingCatAutoTagMode={onToggleEditingCatAutoTagMode}
          onEditingCatTagsInputChange={onEditingCatTagsInputChange}
          onTagTemplateNameChange={onTagTemplateNameChange}
          onApplyTagTemplateToEditingCategory={onApplyTagTemplateToEditingCategory}
          onSaveTagTemplate={onSaveTagTemplate}
          onDeleteTagTemplate={onDeleteTagTemplate}
          onSaveCategory={onSaveCategory}
          onCancelEditCategory={onCancelEditCategory}
        />
      ) : (
        <CategoryDisplayRow
          category={category}
          isFirst={isFirst}
          isLast={isLast}
          onMoveCategory={onMoveCategory}
          onStartEditCategory={onStartEditCategory}
          onDeleteCategory={onDeleteCategory}
          onToggleCategoryActive={onToggleCategoryActive}
        />
      )}
    </div>
  )
}

function CategoryEditRow({
  category,
  editingCatName,
  editingCatGroup,
  editingCatAutoTagMode,
  editingCatTagsInput,
  tagTemplates,
  tagTemplateName,
  savingTagTemplate,
  onEditingCatNameChange,
  onEditingCatGroupChange,
  onToggleEditingCatAutoTagMode,
  onEditingCatTagsInputChange,
  onTagTemplateNameChange,
  onApplyTagTemplateToEditingCategory,
  onSaveTagTemplate,
  onDeleteTagTemplate,
  onSaveCategory,
  onCancelEditCategory,
}) {
  return (
    <>
      <input
        value={editingCatName}
        onChange={event => onEditingCatNameChange(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Enter') onSaveCategory(category)
          if (event.key === 'Escape') onCancelEditCategory()
        }}
        autoFocus
        className="category-edit-name-input"
      />
      <select
        value={editingCatGroup}
        onChange={event => onEditingCatGroupChange(event.target.value)}
        className="category-edit-group-select"
      >
        <option value="">分類なし</option>
        <option value="drink">ドリンク</option>
        <option value="food">フード</option>
      </select>
      <button
        type="button"
        onClick={onToggleEditingCatAutoTagMode}
        className={`button category-auto-toggle category-auto-toggle-small${editingCatAutoTagMode ? ' is-active' : ''}`}
      >
        タグ自動{editingCatAutoTagMode ? 'ON' : 'OFF'}
      </button>
      {editingCatAutoTagMode && (
        <input
          value={editingCatTagsInput}
          onChange={event => onEditingCatTagsInputChange(event.target.value)}
          placeholder="集めるタグ"
          className="category-edit-tags-input"
        />
      )}
      {editingCatAutoTagMode && (
        <div className="category-auto-tags">
          <TagTemplateTools
            currentValue={editingCatTagsInput}
            templates={tagTemplates}
            templateName={tagTemplateName}
            saving={savingTagTemplate}
            onTemplateNameChange={onTagTemplateNameChange}
            onApplyTemplate={onApplyTagTemplateToEditingCategory}
            onSave={onSaveTagTemplate}
            onDelete={onDeleteTagTemplate}
          />
        </div>
      )}
      <button type="button" onClick={() => onSaveCategory(category)} className="button button-primary category-row-action">
        保存
      </button>
      <button type="button" onClick={onCancelEditCategory} className="button button-secondary category-row-action">
        戻る
      </button>
    </>
  )
}

function CategoryDisplayRow({
  category,
  isFirst,
  isLast,
  onMoveCategory,
  onStartEditCategory,
  onDeleteCategory,
  onToggleCategoryActive,
}) {
  return (
    <>
      <div className="sort-button-stack">
        <button type="button" onClick={() => onMoveCategory(category, -1)} disabled={isFirst} className="sort-move-button">▲</button>
        <button type="button" onClick={() => onMoveCategory(category, 1)} disabled={isLast} className="sort-move-button">▼</button>
      </div>
      <div className="category-row-main">
        <span className={`category-name${category.isActive ? '' : ' is-inactive'}`}>{category.name}</span>
        {category.group === 'drink' && <span className="category-badge category-badge-drink">ドリンク</span>}
        {category.group === 'food' && <span className="category-badge category-badge-food">フード</span>}
        {category.autoTagMode && (
          <span className="category-badge category-badge-tags">
            タグ自動: {(category.autoTags ?? []).map(tag => `#${tag}`).join(' ')}
          </span>
        )}
      </div>
      <button type="button" onClick={() => onStartEditCategory(category)} className="button button-secondary category-row-action">
        編集
      </button>
      <button type="button" onClick={() => onDeleteCategory(category)} className="button category-row-danger">
        削除
      </button>
      <button type="button" onClick={() => onToggleCategoryActive(category)} className="button button-secondary category-row-action">
        {category.isActive ? '表示中' : '非表示'}
      </button>
    </>
  )
}
