import ProductBasicFields from './ProductBasicFields'
import ProductCategorySelector from './ProductCategorySelector'
import ProductDiscountEditor from './ProductDiscountEditor'
import ProductFormPanel from './ProductFormPanel'
import ProductImagePicker from './ProductImagePicker'
import ProductList from './ProductList'
import ProductOptionsEditor from './ProductOptionsEditor'
import ProductTabHeader from './ProductTabHeader'
import ProductTagEditor from './ProductTagEditor'
import RelatedProductsEditor from './RelatedProductsEditor'

export default function ProductProductsTab({
  productState,
  productData,
  formState,
  templateState,
  optionState,
  relatedState,
  dragState,
  actions,
}) {
  const { showForm, productSearch, productCatFilter } = productState
  const {
    products,
    displayedProducts,
    categories,
    activeCategories,
    catsForSelect,
    allTagSuggestions,
    allGroupNames,
  } = productData
  const {
    form,
    editingId,
    catGroupFilter,
    showQuickCat,
    quickCatName,
    fileInputRef,
    imageUrl,
    saving,
  } = formState
  const {
    tagTemplates,
    tagTemplateName,
    savingTagTemplate,
    optionTemplates,
    optionTemplateName,
    savingOptionTemplate,
  } = templateState
  const { newChoiceInputs, savingOptions } = optionState
  const { relatedSearch, relatedCatFilter, filteredRelated, savingRelated } = relatedState
  const { dragProductId, touchDrag } = dragState

  return (
    <div>
      <ProductTabHeader
        showForm={showForm}
        productSearch={productSearch}
        productCatFilter={productCatFilter}
        categories={categories}
        onAddProduct={actions.openAdd}
        onProductSearchChange={actions.setProductSearch}
        onProductCatFilterChange={actions.setProductCatFilter}
      />

      {showForm && (
        <ProductFormPanel
          isEditing={Boolean(editingId)}
          saving={saving}
          onSubmit={actions.handleSubmit}
          onCancel={actions.closeForm}
        >
          <ProductCategorySelector
            activeCategories={activeCategories}
            categoriesForSelect={catsForSelect}
            categoryId={form.categoryId}
            displayCategoryIds={form.displayCategoryIds}
            catGroupFilter={catGroupFilter}
            showQuickCat={showQuickCat}
            quickCatName={quickCatName}
            onGroupFilterChange={actions.changeCategoryGroupFilter}
            onCategoryIdChange={value => actions.updateFormField('categoryId', value)}
            onShowQuickCat={actions.showQuickCategory}
            onHideQuickCat={actions.hideQuickCategory}
            onQuickCatNameChange={actions.setQuickCatName}
            onQuickAddCategory={actions.handleQuickAddCat}
            onToggleDisplayCategory={actions.toggleDisplayCat}
          />

          <ProductBasicFields
            name={form.name}
            price={form.price}
            isVisible={form.isVisible}
            isSoldOut={form.isSoldOut}
            onNameChange={value => actions.updateFormField('name', value)}
            onPriceChange={value => actions.updateFormField('price', value)}
            onVisibleChange={value => actions.updateFormField('isVisible', value)}
            onSoldOutChange={value => actions.updateFormField('isSoldOut', value)}
          />

          <ProductTagEditor
            tagsInput={form.tagsInput}
            suggestions={allTagSuggestions}
            tagTemplates={tagTemplates}
            tagTemplateName={tagTemplateName}
            savingTagTemplate={savingTagTemplate}
            onTagsInputChange={value => actions.updateFormField('tagsInput', value)}
            onTagTemplateNameChange={actions.setTagTemplateName}
            onApplyTemplate={actions.applyTagTemplateToProduct}
            onSaveTemplate={actions.saveTagTemplate}
            onDeleteTemplate={actions.deleteTagTemplate}
          />

          <ProductImagePicker
            inputRef={fileInputRef}
            imageUrl={imageUrl}
            onFileSelect={actions.handleFileSelect}
            onClear={actions.clearImage}
          />

          <ProductDiscountEditor
            discountConfig={form.discountConfig}
            onUpdate={actions.updateDiscountConfig}
            onToggleWeekday={actions.toggleDiscountWeekday}
          />

          <ProductOptionsEditor
            enabled={form.optionsEnabled}
            options={form.options}
            optionTemplates={optionTemplates}
            optionTemplateName={optionTemplateName}
            savingOptionTemplate={savingOptionTemplate}
            newChoiceInputs={newChoiceInputs}
            allGroupNames={allGroupNames}
            editingId={editingId}
            savingOptions={savingOptions}
            onToggleEnabled={actions.toggleOptionsEnabled}
            onApplyTemplate={actions.applyOptionPreset}
            onDeleteTemplate={actions.deleteOptionTemplate}
            onOptionTemplateNameChange={actions.setOptionTemplateName}
            onSaveTemplate={actions.saveOptionTemplate}
            onUpdateOptionGroup={actions.updateOptionGroup}
            onRemoveOptionGroup={actions.removeOptionGroup}
            onRemoveChoice={actions.removeChoice}
            onNewChoiceInputChange={actions.updateNewChoiceInput}
            onAddChoice={actions.addChoice}
            onAddOptionGroup={actions.addOptionGroup}
            onSaveOptions={actions.saveOptionsOnly}
          />

          <RelatedProductsEditor
            enabled={form.linkedEnabled}
            linkedProductIds={form.linkedProductIds}
            relatedSearch={relatedSearch}
            relatedCatFilter={relatedCatFilter}
            categories={categories}
            filteredProducts={filteredRelated}
            editingId={editingId}
            savingRelated={savingRelated}
            getCategoryName={actions.getCategoryName}
            onToggleEnabled={actions.toggleLinkedEnabled}
            onRelatedSearchChange={actions.setRelatedSearch}
            onRelatedCatFilterChange={actions.setRelatedCatFilter}
            onToggleProduct={actions.toggleLinked}
            onSaveRelated={actions.saveRelatedOnly}
          />
        </ProductFormPanel>
      )}

      <ProductList
        products={products}
        displayedProducts={displayedProducts}
        productSearch={productSearch}
        productCatFilter={productCatFilter}
        dragProductId={dragProductId}
        touchDrag={touchDrag}
        getCategoryName={actions.getCategoryName}
        onMove={actions.moveProduct}
        onReorder={actions.reorderProducts}
        onSetDragProductId={actions.setDragProductId}
        onTouchStart={actions.startTouchReorder}
        onTouchMove={actions.moveTouchReorder}
        onTouchEnd={actions.finishTouchReorder}
        onTouchCancel={actions.cancelTouchReorder}
        onToggleSoldOut={actions.toggleSoldOut}
        onToggleVisible={actions.toggleVisible}
        onEdit={actions.openEdit}
      />
    </div>
  )
}
