import { useState } from 'react'
import { getDiscountedProductPrice } from '../lib/discounts'

export default function OptionModal({ product, onConfirm, onClose }) {
  const options = product.options ?? []
  const [selections, setSelections] = useState({})
  const [quantity, setQuantity] = useState(1)
  const [choiceQuantities, setChoiceQuantities] = useState({})
  const multiQuantityMode = options.length === 1

  function normalizeQuantity(value) {
    const n = parseInt(value, 10)
    if (isNaN(n)) return 1
    return Math.min(99, Math.max(1, n))
  }

  function normalizeChoiceQuantity(value) {
    const n = parseInt(value, 10)
    if (isNaN(n)) return 0
    return Math.min(99, Math.max(0, n))
  }

  function handleSelect(group, choice) {
    setSelections(prev => {
      const current = prev[group.groupName]
      const isSame = current?.label === choice.label
      if (isSame && !group.required) {
        const next = { ...prev }
        delete next[group.groupName]
        return next
      }
      return { ...prev, [group.groupName]: choice }
    })
  }

  function handleConfirm() {
    if (multiQuantityMode) {
      const group = options[0]
      const optionItems = (group.choices ?? [])
        .map(choice => {
          const normalized = typeof choice === 'string' ? { label: choice, extraPrice: 0 } : choice
          const qty = choiceQuantities[normalized.label] ?? 0
          if (qty <= 0) return null
          return {
            optionSelections: [{
              groupName: group.groupName,
              choice: normalized.label,
              extraPrice: normalized.extraPrice ?? 0,
            }],
            quantity: qty,
          }
        })
        .filter(Boolean)
      onConfirm(optionItems)
      return
    }

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
    onConfirm(optionSelections, quantity)
  }

  const choiceQuantityTotal = Object.values(choiceQuantities).reduce((sum, q) => sum + q, 0)
  const allRequiredSelected = multiQuantityMode
    ? choiceQuantityTotal > 0
    : options.filter(g => g.required).every(g => selections[g.groupName])
  const totalExtra = multiQuantityMode ? 0 : Object.values(selections).reduce((sum, s) => sum + (s?.extraPrice ?? 0), 0)
  const { originalPrice, discountAmount, discountedPrice } = getDiscountedProductPrice(product)
  const unitPrice = discountedPrice + totalExtra
  const multiQuantityTotal = multiQuantityMode
    ? (options[0]?.choices ?? []).reduce((sum, choice) => {
        const normalized = typeof choice === 'string' ? { label: choice, extraPrice: 0 } : choice
        const qty = choiceQuantities[normalized.label] ?? 0
        return sum + (discountedPrice + (normalized.extraPrice ?? 0)) * qty
      }, 0)
    : unitPrice * quantity

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 24 }}
      onClick={onClose}
    >
      <div
        style={{ background: '#fff', borderRadius: 14, padding: 24, width: '100%', maxWidth: 390, maxHeight: '85vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 2 }}>{product.name}</div>
        <div style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>
          ¥{unitPrice.toLocaleString()}
          {discountAmount > 0 && <span style={{ marginLeft: 6, color: '#dc2626' }}>通常¥{(originalPrice + totalExtra).toLocaleString()}</span>}
        </div>

        {multiQuantityMode ? (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              {options[0].groupName}
              <span style={{ fontSize: 11, color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 4, padding: '1px 6px' }}>選択肢ごとに数量</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(options[0].choices ?? []).map(choice => {
                const normalized = typeof choice === 'string' ? { label: choice, extraPrice: 0 } : choice
                const choiceLabel = normalized.label
                const extraPrice = normalized.extraPrice ?? 0
                const qty = choiceQuantities[choiceLabel] ?? 0
                const choicePrice = discountedPrice + extraPrice
                return (
                  <div key={choiceLabel} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px', border: qty > 0 ? '2px solid #222' : '1px solid #ddd', borderRadius: 10, background: qty > 0 ? '#f8fafc' : '#fff' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 700 }}>{choiceLabel}</div>
                      <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                        ¥{choicePrice.toLocaleString()}
                        {extraPrice > 0 && <span style={{ marginLeft: 4, color: '#1d4ed8' }}>+¥{extraPrice.toLocaleString()}</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => setChoiceQuantities(prev => ({ ...prev, [choiceLabel]: Math.max(0, qty - 1) }))}
                      style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid #ddd', background: '#fff', fontSize: 18, cursor: 'pointer' }}
                    >
                      -
                    </button>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      max="99"
                      value={qty || ''}
                      onChange={e => setChoiceQuantities(prev => ({ ...prev, [choiceLabel]: normalizeChoiceQuantity(e.target.value) }))}
                      placeholder="0"
                      style={{ width: 52, padding: '7px 6px', fontSize: 16, fontWeight: 700, textAlign: 'center', border: '1px solid #ddd', borderRadius: 8 }}
                    />
                    <button
                      onClick={() => setChoiceQuantities(prev => ({ ...prev, [choiceLabel]: Math.min(99, qty + 1) }))}
                      style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid #222', background: '#222', color: '#fff', fontSize: 18, cursor: 'pointer' }}
                    >
                      +
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <>
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
                    const normalized = typeof choice === 'string' ? { label: choice, extraPrice: 0 } : choice
                    const choiceLabel = normalized.label
                    const extraPrice = normalized.extraPrice ?? 0
                    const selected = selections[group.groupName]?.label === choiceLabel
                    return (
                      <button
                        key={choiceLabel}
                        onClick={() => handleSelect(group, normalized)}
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

            <div style={{ borderTop: '1px solid #eee', paddingTop: 16, marginTop: 4, marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>数量</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid #ddd', background: '#fff', fontSize: 18, cursor: 'pointer' }}
                >
                  -
                </button>
                <input
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max="99"
                  value={quantity}
                  onChange={e => setQuantity(normalizeQuantity(e.target.value))}
                  onBlur={e => setQuantity(normalizeQuantity(e.target.value))}
                  style={{ width: 72, padding: '8px 10px', fontSize: 18, fontWeight: 700, textAlign: 'center', border: '1px solid #ddd', borderRadius: 8 }}
                />
                <button
                  onClick={() => setQuantity(q => Math.min(99, q + 1))}
                  style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid #222', background: '#222', color: '#fff', fontSize: 18, cursor: 'pointer' }}
                >
                  +
                </button>
                <span style={{ marginLeft: 'auto', fontSize: 14, fontWeight: 700 }}>
                  ¥{(unitPrice * quantity).toLocaleString()}
                </span>
              </div>
            </div>
          </>
        )}

        {multiQuantityMode && (
          <div style={{ borderTop: '1px solid #eee', paddingTop: 14, marginBottom: 14, display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700 }}>
            <span>合計 {choiceQuantityTotal}個</span>
            <span>¥{multiQuantityTotal.toLocaleString()}</span>
          </div>
        )}

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
            {multiQuantityMode ? `${choiceQuantityTotal}個追加` : `${quantity}個追加`}
          </button>
        </div>
      </div>
    </div>
  )
}
