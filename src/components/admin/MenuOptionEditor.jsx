import { useState } from 'react'

// 「選ぶもの」（注文のときにお客様が選ぶ。例：味＝塩・タレ）。2026-10-23 商品設計。
// テンプレートは本番で使われていなかったので無くした。
const emptyChoice = { label: '', extraPrice: '' }

export default function MenuOptionEditor({ options, onChange }) {
  const [drafts, setDrafts] = useState({})

  function updateGroup(index, patch) {
    onChange(options.map((group, groupIndex) => (groupIndex === index ? { ...group, ...patch } : group)))
  }

  function addChoice(index) {
    const draft = drafts[index] ?? emptyChoice
    if (!draft.label.trim()) return
    const group = options[index]
    updateGroup(index, { choices: [...(group.choices ?? []), { label: draft.label.trim(), extraPrice: Math.max(0, Number(draft.extraPrice) || 0) }] })
    setDrafts(prev => ({ ...prev, [index]: emptyChoice }))
  }

  return (
    <div className="menu-sheet__box">
      <div className="menu-sheet__box-head"><b>選ぶもの</b><span>注文のときにお客様が選ぶ</span></div>
      {options.map((group, index) => (
        <div key={index} className="menu-option">
          <div className="menu-option__head">
            <input
              value={group.groupName}
              onChange={event => updateGroup(index, { groupName: event.target.value })}
              placeholder="例：味"
              className="menu-sheet__input"
            />
            <label className="menu-option__required">
              <input type="checkbox" checked={group.required !== false} onChange={event => updateGroup(index, { required: event.target.checked })} />
              必ず選ぶ
            </label>
            <button
              type="button"
              onClick={() => { setDrafts({}); onChange(options.filter((_, groupIndex) => groupIndex !== index)) }}
              className="menu-option__remove"
              aria-label="この選ぶものを消す"
            >×</button>
          </div>
          <div className="menu-option__choices">
            {(group.choices ?? []).map((choice, choiceIndex) => (
              <span key={choiceIndex} className="menu-option__choice">
                {choice.label}{choice.extraPrice > 0 && `（+¥${choice.extraPrice}）`}
                <button
                  type="button"
                  onClick={() => updateGroup(index, { choices: group.choices.filter((_, i) => i !== choiceIndex) })}
                  aria-label={`${choice.label}を消す`}
                >×</button>
              </span>
            ))}
          </div>
          {/* 選択肢を入れたまま別の所を押したら、「足す」を押したのと同じにする（入れたものを黙って捨てない）。 */}
          <div
            className="menu-option__add"
            onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) addChoice(index) }}
          >
            <input
              value={(drafts[index] ?? emptyChoice).label}
              onChange={event => setDrafts(prev => ({ ...prev, [index]: { ...(prev[index] ?? emptyChoice), label: event.target.value } }))}
              onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addChoice(index) } }}
              placeholder="選択肢（例：塩）"
              className="menu-sheet__input"
            />
            <input
              value={(drafts[index] ?? emptyChoice).extraPrice}
              onChange={event => setDrafts(prev => ({ ...prev, [index]: { ...(prev[index] ?? emptyChoice), extraPrice: event.target.value.replace(/[^0-9]/g, '') } }))}
              inputMode="numeric"
              placeholder="追加 ¥0"
              className="menu-sheet__input menu-option__price"
            />
            <button type="button" onClick={() => addChoice(index)} className="ui-button ui-button--soft">足す</button>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...options, { groupName: '', required: true, choices: [] }])}
        className="menu-sheet__add-line"
      >
        ＋ 選ぶものを足す
      </button>
    </div>
  )
}
