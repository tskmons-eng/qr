import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp, increment } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import OptionModal from '../../components/OptionModal'
import SuggestionSheet from '../../components/SuggestionSheet'

function formatOptions(optionSelections) {
  if (!optionSelections || optionSelections.length === 0) return null
  return optionSelections.map(o => o.choice).join(' · ')
}

export default function StaffMenuPage() {
  const { tableId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { orderId, storeId } = location.state || {}

  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [activeCat, setActiveCat] = useState(null)
  const [cart, setCart] = useState([]) // { id, product, quantity, optionSelections }
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [optionTarget, setOptionTarget] = useState(null)
  const [suggestions, setSuggestions] = useState([])

  useEffect(() => {
    if (!storeId) return
    async function load() {
      const [catSnap, prodSnap] = await Promise.all([
        getDocs(query(collection(db, 'categories'), where('storeId', '==', storeId))),
        getDocs(query(collection(db, 'products'), where('storeId', '==', storeId))),
      ])
      const cats = catSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(c => c.isActive).sort((a, b) => a.sortOrder - b.sortOrder)
      const catGroupMap = Object.fromEntries(cats.map(c => [c.id, c.group ?? '']))
      const prods = prodSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.isVisible).sort((a, b) => a.sortOrder - b.sortOrder).map(p => ({ ...p, categoryGroup: catGroupMap[p.categoryId] ?? '' }))
      setCategories(cats)
      setProducts(prods)
      if (cats.length > 0) setActiveCat(cats[0].id)
      setLoading(false)
    }
    load()
  }, [storeId])

  function addToCart(product, optionSelections = []) {
    setCart(prev => {
      if (optionSelections.length === 0) {
        const idx = prev.findIndex(i => i.product.id === product.id && i.optionSelections.length === 0)
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 }
          return next
        }
      } else {
        const selKey = JSON.stringify(optionSelections.map(o => `${o.groupName}:${o.choice}`).sort())
        const idx = prev.findIndex(i =>
          i.product.id === product.id &&
          JSON.stringify(i.optionSelections.map(o => `${o.groupName}:${o.choice}`).sort()) === selKey
        )
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 }
          return next
        }
      }
      return [...prev, { id: `${product.id}_${Date.now()}`, product, quantity: 1, optionSelections }]
    })
  }

  function showSuggestionsFor(product) {
    const ids = product.linkedProductIds ?? []
    if (ids.length === 0) return
    const linked = products.filter(p => ids.includes(p.id))
    if (linked.length > 0) setSuggestions(linked)
  }

  function handleAddProduct(product) {
    if (product.isSoldOut) return
    const opts = product.options ?? []
    if (opts.length > 0) {
      setOptionTarget(product)
    } else {
      addToCart(product, [])
      showSuggestionsFor(product)
    }
  }

  function handleOptionConfirm(optionSelections) {
    const product = optionTarget
    addToCart(product, optionSelections)
    setOptionTarget(null)
    showSuggestionsFor(product)
  }

  function handleSuggestionAdd(product) {
    handleAddProduct(product)
    setSuggestions([])
  }

  function updateQty(cartItemId, qty) {
    if (qty <= 0) {
      setCart(prev => prev.filter(i => i.id !== cartItemId))
    } else {
      setCart(prev => prev.map(i => i.id === cartItemId ? { ...i, quantity: qty } : i))
    }
  }

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0)
  const cartTotal = cart.reduce((s, i) => {
    const extra = (i.optionSelections ?? []).reduce((e, o) => e + (o.extraPrice ?? 0), 0)
    return s + (i.product.price + extra) * i.quantity
  }, 0)
  const filtered = activeCat
    ? products.filter(p => p.categoryId === activeCat || (p.displayCategoryIds ?? []).includes(activeCat))
    : products

  async function handleSubmit() {
    if (cart.length === 0 || !orderId) return
    setSubmitting(true)
    try {
      const now = serverTimestamp()
      await Promise.all(cart.map(({ product, quantity, optionSelections }) => {
        const extra = (optionSelections ?? []).reduce((s, o) => s + (o.extraPrice ?? 0), 0)
        return addDoc(collection(db, 'orderItems'), {
          orderId,
          storeId,
          tableId,
          productId: product.id,
          productNameSnapshot: product.name,
          unitPriceSnapshot: product.price,
          categoryGroup: product.categoryGroup ?? '',
          quantity,
          lineTotal: (product.price + extra) * quantity,
          orderedBy: 'staff',
          itemStatus: 'ordered',
          optionSelections: optionSelections ?? [],
          orderedAt: now,
          updatedAt: now,
        })
      }))
      await updateDoc(doc(db, 'tables', tableId), {
        pendingCount: increment(cart.length),
        updatedAt: now,
      })
      navigate(`/staff/table/${tableId}`, { replace: true })
    } catch {
      alert('送信に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 48, color: '#999' }}>読み込み中...</div>

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', paddingBottom: cartCount > 0 ? 88 : 0 }}>
      {optionTarget && (
        <OptionModal
          product={optionTarget}
          onConfirm={handleOptionConfirm}
          onClose={() => setOptionTarget(null)}
        />
      )}
      {suggestions.length > 0 && !optionTarget && (
        <SuggestionSheet
          suggestions={suggestions}
          onAdd={handleSuggestionAdd}
          onClose={() => setSuggestions([])}
        />
      )}

      <div style={{ background: '#fff', padding: '12px 16px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 56, zIndex: 10 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#444' }}>←</button>
        <span style={{ fontSize: 16, fontWeight: 600 }}>注文追加（スタッフ）</span>
      </div>

      <div style={{ display: 'flex', overflowX: 'auto', background: '#fff', borderBottom: '1px solid #eee' }}>
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCat(cat.id)}
            style={{ padding: '11px 14px', border: 'none', background: 'none', fontSize: 14, fontWeight: activeCat === cat.id ? 700 : 400, color: activeCat === cat.id ? '#222' : '#888', borderBottom: activeCat === cat.id ? '2px solid #222' : '2px solid transparent', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            {cat.name}
          </button>
        ))}
      </div>

      <div>
        {filtered.map(product => {
          const cartItems = cart.filter(i => i.product.id === product.id)
          const simpleItem = cartItems.find(i => i.optionSelections.length === 0)
          const hasOptions = (product.options ?? []).length > 0
          return (
            <div key={product.id} style={{ display: 'flex', alignItems: 'center', padding: '13px 16px', borderBottom: '1px solid #f0f0f0', background: '#fff', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, color: product.isSoldOut ? '#bbb' : '#222' }}>{product.name}</div>
                <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>¥{product.price.toLocaleString()}</div>
                {hasOptions && !product.isSoldOut && (
                  <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>選択あり</div>
                )}
                {product.isSoldOut && <div style={{ fontSize: 12, color: '#dc2626', marginTop: 2 }}>売り切れ</div>}
                {cartItems.map(ci => ci.optionSelections.length > 0 && (
                  <div key={ci.id} style={{ fontSize: 11, color: '#1d4ed8', marginTop: 2 }}>
                    {formatOptions(ci.optionSelections)} × {ci.quantity}
                  </div>
                ))}
              </div>
              {!hasOptions && simpleItem ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button onClick={() => updateQty(simpleItem.id, simpleItem.quantity - 1)} style={{ width: 30, height: 30, borderRadius: '50%', border: '1px solid #ddd', background: '#fff', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                  <span style={{ fontSize: 16, fontWeight: 700, minWidth: 24, textAlign: 'center' }}>{simpleItem.quantity}</span>
                  <button onClick={() => updateQty(simpleItem.id, simpleItem.quantity + 1)} style={{ width: 30, height: 30, borderRadius: '50%', border: '1px solid #222', background: '#222', color: '#fff', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                </div>
              ) : (
                <button
                  onClick={() => handleAddProduct(product)}
                  disabled={product.isSoldOut}
                  style={{ width: 36, height: 36, borderRadius: '50%', border: product.isSoldOut ? '2px solid #ddd' : '2px solid #222', background: product.isSoldOut ? '#f5f5f5' : '#222', color: product.isSoldOut ? '#ccc' : '#fff', fontSize: 22, cursor: product.isSoldOut ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                >
                  +
                </button>
              )}
            </div>
          )
        })}
      </div>

      {cartCount > 0 && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '12px 16px', background: '#fff', borderTop: '1px solid #eee' }}>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{ width: '100%', padding: '14px', fontSize: 15, background: '#222', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <span style={{ background: '#fff', color: '#222', borderRadius: '50%', width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700 }}>{cartCount}</span>
            <span>{submitting ? '送信中...' : '注文を追加する'}</span>
            <span>¥{cartTotal.toLocaleString()}</span>
          </button>
        </div>
      )}
    </div>
  )
}
