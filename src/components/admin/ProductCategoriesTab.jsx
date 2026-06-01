import CategoryManager from './CategoryManager'

export default function ProductCategoriesTab({
  categoryState,
  templateState,
  dragState,
  actions,
}) {
  return (
    <CategoryManager
      categories={categoryState.categories}
      newCatName={categoryState.newCatName}
      newCatGroup={categoryState.newCatGroup}
      addingCat={categoryState.addingCat}
      newCatAutoTagMode={categoryState.newCatAutoTagMode}
      newCatTagsInput={categoryState.newCatTagsInput}
      editingCatId={categoryState.editingCatId}
      editingCatName={categoryState.editingCatName}
      editingCatGroup={categoryState.editingCatGroup}
      editingCatAutoTagMode={categoryState.editingCatAutoTagMode}
      editingCatTagsInput={categoryState.editingCatTagsInput}
      tagTemplates={templateState.tagTemplates}
      tagTemplateName={templateState.tagTemplateName}
      savingTagTemplate={templateState.savingTagTemplate}
      dragCategoryId={dragState.dragCategoryId}
      touchDrag={dragState.touchDrag}
      onAddCategory={actions.handleAddCat}
      onNewCatNameChange={actions.setNewCatName}
      onNewCatGroupChange={actions.setNewCatGroup}
      onToggleNewCatAutoTagMode={actions.toggleNewCatAutoTagMode}
      onNewCatTagsInputChange={actions.setNewCatTagsInput}
      onEditingCatNameChange={actions.setEditingCatName}
      onEditingCatGroupChange={actions.setEditingCatGroup}
      onToggleEditingCatAutoTagMode={actions.toggleEditingCatAutoTagMode}
      onEditingCatTagsInputChange={actions.setEditingCatTagsInput}
      onTagTemplateNameChange={actions.setTagTemplateName}
      onApplyTagTemplateToNewCategory={actions.applyTagTemplateToNewCategory}
      onApplyTagTemplateToEditingCategory={actions.applyTagTemplateToEditingCategory}
      onSaveTagTemplate={actions.saveTagTemplate}
      onDeleteTagTemplate={actions.deleteTagTemplate}
      onStartEditCategory={actions.startEditCat}
      onSaveCategory={actions.saveCatName}
      onCancelEditCategory={actions.cancelEditCategory}
      onDeleteCategory={actions.deleteCat}
      onToggleCategoryActive={actions.toggleCatActive}
      onMoveCategory={actions.moveCat}
      onReorderCategories={actions.reorderCategories}
      onSetDragCategoryId={actions.setDragCategoryId}
      onTouchStartReorder={actions.startTouchReorder}
      onTouchMoveReorder={actions.moveTouchReorder}
      onTouchEndReorder={actions.finishTouchReorder}
      onTouchCancelReorder={actions.cancelTouchReorder}
    />
  )
}
