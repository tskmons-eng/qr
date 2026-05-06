import { useState } from 'react'

export default function OptionModal({ product, onConfirm, onClose }) {
  const options = product.options ?? []
  const [selections, setSelections] = useState({})

  function handleSelect(groupName, choice) {
    setSelections(prev => ({ ...prev, [groupName]: choice }))
  }

  function handleConfirm() {
    const optionSelections = options
      .map(g => {
        const sel = selections[g.groupName]
        if (!sel) return null
        return {
          groupName: g.groupName,
          choice: sel.label,
          extraPrice: sel.extraPrice ?? 0,
        }
      })
      .filter(Boolean)
    onConfirm(optionSelections)
  }

  const allRequiredSelected = options.filter(g => g.required).every(g => selections[g.groupName])

  const totalExtra = Object.values(selections).reduce((sum, s) => sum + (s?.extraPrice ?? 0), 0)

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 24 }}
      onClick={onClose}
    >
      <div
        style={{ background: '#fff', borderRadius: 14, padding: 24, width: '100%', maxWidth: 340, maxHeight: '85vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 2 }}>{product.name}</div>
        <div style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>¥{product.price.toLocaleString()}{totalExtra > 0 && ` + ¥${totalExtra.toLocaleString()}`}</div>

        {options.map(group => (
          <div key={group.groupName} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              {group.groupName}
              {group.required
                ? <span style={{ fontSize: 11, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 4, padding: '1px 6px' }}>必須</span>
                : <span style={{ fontSize: 11, color: '#888', background: '#f5f5f5', border: '1px solid #e5e5e5', borderRadius: 4, padding: '1px 6px' }}>任意</span>
              }
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {(group.choices ?? []).map(choice => {
                const choiceLabel = typeof choice === 'string' ? choice : choice.label
                const extraPrice = typeof choice === 'string' ? 0 : (choice.extraPrice ?? 0)
                const selected = selections[group.groupName]?.label === choiceLabel || selections[group.groupName] === choice
                return (
                  <button
                    key={choiceLabel}
                    onClick={() => handleSelect(group.groupName, typeof choice === 'string' ? { label: choice, extraPrice: 0 } : choice)}
                    style={{
                      padding: '9px 14px', fontSize: 14,
                      border: selected ? '2px solid #222' : '1px solid #ddd',
                      borderRadius: 8,
                      background: selected ? '#f0f0f0' : '#fff',
                      fontWeight: selected ? 700 : 400,
                      cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                    }}
                  >
                    <span>{choiceLabel}</span>
                    {extraPrice > 0 && <span style={{ fontSize: 11, color: '#1d4ed8' }}>+¥{extraPrice.toLocaleString()}</span>}
                  </button>
                )
              })}
            </div>
          </div>
        ))}

        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '12px', fontSize: 14, background: '#fff', border: '1px solid #ddd', borderRadius: 8, cursor: 'pointer' }}>
            キャンセル
          </button>
          <button
            onClick={handleConfirm}
            disabled={!allRequiredSelected}
            style={{
              flex: 1, padding: '12px', fontSize: 14,
              background: allRequiredSelected ? '#222' : '#ccc',
              color: '#fff', border: 'none', borderRadius: 8,
              cursor: allRequiredSelected ? 'pointer' : 'default', fontWeight: 600,
            }}
          >
            {totalExtra > 0 ? `追加 +¥${totalExtra.toLocaleString()}` : '追加する'}
          </button>
        </div>
      </div>
    </div>
  )
}
