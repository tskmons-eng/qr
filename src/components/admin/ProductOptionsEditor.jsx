export default function ProductOptionsEditor({
  enabled,
  options,
  optionTemplates,
  optionTemplateName,
  savingOptionTemplate,
  newChoiceInputs,
  allGroupNames,
  editingId,
  savingOptions,
  onToggleEnabled,
  onApplyTemplate,
  onDeleteTemplate,
  onOptionTemplateNameChange,
  onSaveTemplate,
  onUpdateOptionGroup,
  onRemoveOptionGroup,
  onRemoveChoice,
  onNewChoiceInputChange,
  onAddChoice,
  onAddOptionGroup,
  onSaveOptions,
}) {
  return (
    <div className="product-form-section">
      <div className={`product-section-header${enabled ? ' has-content' : ''}`}>
        <div>
          <div className="product-section-title">オプション</div>
          <div className="product-section-help">塩/タレ選択・サイズ変更など</div>
        </div>
        <button type="button" onClick={() => onToggleEnabled(!enabled)} className={`product-section-toggle${enabled ? ' is-active' : ''}`}>
          {enabled ? 'ON' : 'OFF'}
        </button>
      </div>

      {enabled && (
        <div>
          <OptionTemplatePanel
            optionTemplates={optionTemplates}
            optionTemplateName={optionTemplateName}
            savingOptionTemplate={savingOptionTemplate}
            onApplyTemplate={onApplyTemplate}
            onDeleteTemplate={onDeleteTemplate}
            onOptionTemplateNameChange={onOptionTemplateNameChange}
            onSaveTemplate={onSaveTemplate}
          />
          {options.map((optionGroup, index) => (
            <OptionGroupEditor
              key={index}
              index={index}
              optionGroup={optionGroup}
              newChoiceInput={newChoiceInputs[index] ?? { label: '', extraPrice: '' }}
              allGroupNames={allGroupNames}
              onUpdateOptionGroup={onUpdateOptionGroup}
              onRemoveOptionGroup={onRemoveOptionGroup}
              onRemoveChoice={onRemoveChoice}
              onNewChoiceInputChange={onNewChoiceInputChange}
              onAddChoice={onAddChoice}
            />
          ))}
          <button type="button" onClick={onAddOptionGroup} className="button option-add-group-button">
            + グループを追加
          </button>
          {editingId && (
            <button type="button" onClick={onSaveOptions} disabled={savingOptions} className="product-section-save product-section-save-spaced">
              {savingOptions ? '保存中...' : 'オプションを保存'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function OptionTemplatePanel({
  optionTemplates,
  optionTemplateName,
  savingOptionTemplate,
  onApplyTemplate,
  onDeleteTemplate,
  onOptionTemplateNameChange,
  onSaveTemplate,
}) {
  return (
    <div className="option-template-panel">
      <div className="option-template-title">オプションテンプレート</div>
      {optionTemplates.length > 0 ? (
        <div className="option-template-list">
          {optionTemplates.map(template => (
            <div key={template.id} className="option-template-row">
              <button
                type="button"
                onClick={() => onApplyTemplate(template.options)}
                className="option-template-apply"
                title={(template.options ?? []).map(group => `${group.groupName}: ${(group.choices ?? []).map(choice => choice.label).join('/')}`).join('\n')}
              >
                {template.name}
                <span className="option-template-count">{(template.options ?? []).length}グループ</span>
              </button>
              <button type="button" onClick={() => onDeleteTemplate(template)} className="button option-template-delete">
                削除
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="option-template-empty">まだテンプレートがありません。下の入力欄で名前を付けて保存できます。</div>
      )}
      <div className="option-template-save-row">
        <input
          value={optionTemplateName}
          onChange={event => onOptionTemplateNameChange(event.target.value)}
          placeholder="テンプレート名（例：焼鳥 塩/タレ）"
          className="option-template-name-input"
        />
        <button type="button" onClick={onSaveTemplate} disabled={savingOptionTemplate} className="button option-template-save-button">
          {savingOptionTemplate ? '保存中...' : '名前で保存'}
        </button>
      </div>
      <div className="option-template-help">現在編集中のオプション内容を、名前付きテンプレートとして保存します。</div>
    </div>
  )
}

function OptionGroupEditor({
  index,
  optionGroup,
  newChoiceInput,
  allGroupNames,
  onUpdateOptionGroup,
  onRemoveOptionGroup,
  onRemoveChoice,
  onNewChoiceInputChange,
  onAddChoice,
}) {
  return (
    <div className="option-group-editor">
      <div className="option-group-header">
        <input
          value={optionGroup.groupName}
          onChange={event => onUpdateOptionGroup(index, { groupName: event.target.value })}
          placeholder="グループ名（例：タレ）"
          list={`group-suggestions-${index}`}
          className="option-group-name-input"
        />
        <datalist id={`group-suggestions-${index}`}>
          {allGroupNames.map(name => <option key={name} value={name} />)}
        </datalist>
        <label className="option-required-toggle">
          <input
            type="checkbox"
            checked={optionGroup.required}
            onChange={event => onUpdateOptionGroup(index, { required: event.target.checked })}
          />
          必須
        </label>
        <button type="button" onClick={() => onRemoveOptionGroup(index)} className="button option-delete-button">
          削除
        </button>
      </div>

      {(optionGroup.choices ?? []).map((choice, choiceIndex) => (
        <div key={choiceIndex} className="option-choice-row">
          <span className="option-choice-label">
            {choice.label}
            {choice.extraPrice > 0 && <span className="option-choice-price">+¥{choice.extraPrice.toLocaleString()}</span>}
          </span>
          <button type="button" onClick={() => onRemoveChoice(index, choiceIndex)} className="option-choice-remove">×</button>
        </div>
      ))}

      <div className="option-choice-add-row">
        <input
          value={newChoiceInput.label}
          onChange={event => onNewChoiceInputChange(index, { label: event.target.value })}
          onKeyDown={event => {
            if (event.key === 'Enter') {
              event.preventDefault()
              onAddChoice(index)
            }
          }}
          placeholder="選択肢名"
          className="option-choice-name-input"
        />
        <div className="option-choice-price-input-wrap">
          <span className="option-choice-price-prefix">+¥</span>
          <input
            type="number"
            value={newChoiceInput.extraPrice}
            onChange={event => onNewChoiceInputChange(index, { extraPrice: event.target.value })}
            onKeyDown={event => {
              if (event.key === 'Enter') {
                event.preventDefault()
                onAddChoice(index)
              }
            }}
            placeholder="0"
            min="0"
            className="option-choice-price-input"
          />
        </div>
        <button type="button" onClick={() => onAddChoice(index)} className="button button-primary option-choice-add-button">
          追加
        </button>
      </div>
    </div>
  )
}
