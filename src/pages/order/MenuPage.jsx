import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useOrder } from '../../contexts/OrderContext'
import { useCart } from '../../contexts/CartContext'
import OptionModal from '../../components/OptionModal'
import SuggestionSheet from '../../components/SuggestionSheet'
import CustomerBottomNav from '../../components/CustomerBottomNav'
import { getDiscountedProductPrice } from '../../lib/discounts'
import { productMatchesCategory } from '../../lib/productTags'

export default function MenuPage() {
  const { storeId, tableId, orderId, table } = useOrder()
  const { items, addItem, updateQuantity, count, total } = useCart()
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [activeCat, setActiveCat] = useState(null)
  const [loading, setLoading] = useState(true)
  const [callSent, setCallSent] = useState(false)
  const [checkoutSent, setCheckoutSent] = useState(false)
  const [optionTarget, setOptionTarget] = useState(null)
  const [suggestions, setSuggestions] = useState([])
  const cooldownRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => () => clearTimeout(cooldownRef.current), [])

  useEffect(() => {
    async function load() {
      const [catSnap, prodSnap] = await Promise.all([
        getDocs(query(collection(db, 'categories'), where('storeId', '==', storeId))),
        getDocs(query(collection(db, 'products'), where('storeId', '==', storeId))),
      ])
      const cats = catSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(c => c.isActive)
        .sort((a, b) => a.sortOrder - b.sortOrder)
      const catGroupMap = Object.fromEntries(cats.map(c => [c.id, c.group ?? '']))
      const prods = prodSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(p => p.isVisible)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(p => ({ ...p, categoryGroup: catGroupMap[p.categoryId] ?? '' }))
      setCategories(cats)
      setProducts(prods)
      if (cats.length > 0) setActiveCat(cats[0].id)
      setLoading(false)
    }
    load()
  }, [storeId])

  async function handleCall() {
    if (callSent) return
    await addDoc(collection(db, 'calls'), {
      storeId,
      tableId,
      tableName: table.tableName,
      orderId: orderId ?? null,
      type: 'call',
      status: 'pending',
      createdAt: serverTimestamp(),
    })
    setCallSent(true)
    cooldownRef.current = setTimeout(() => setCallSent(false), 30000)
  }

  async function handleCheckout() {
    if (checkoutSent) return
    await addDoc(collection(db, 'calls'), {
      storeId,
      tableId,
      tableName: table.tableName,
      orderId: orderId ?? null,
      type: 'checkout',
      status: 'pending',
      createdAt: serverTimestamp(),
    })
    setCheckoutSent(true)
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
      addItem(product, [])
      showSuggestionsFor(product)
    }
  }

  function handleOptionConfirm(optionSelections, quantity = 1) {
    const product = optionTarget
    if (Array.isArray(optionSelections) && optionSelections.every(item => Array.isArray(item?.optionSelections))) {
      optionSelections.forEach(item => addItem(product, item.optionSelections, item.quantity))
    } else {
      addItem(product, optionSelections, quantity)
    }
    setOptionTarget(null)
    showSuggestionsFor(product)
  }

  function handleSuggestionAdd(product) {
    handleAddProduct(product)
    setSuggestions([])
  }

  function setSimpleProductQuantity(product, value) {
    const nextQuantity = Math.min(99, Math.max(0, parseInt(value, 10) || 0))
    const item = items.find(i => i.product.id === product.id && i.optionSelections.length === 0)
    if (item) {
      updateQuantity(item.id, nextQuantity)
    } else if (nextQuantity > 0) {
      addItem(product, [], nextQuantity)
    }
  }

  const activeCategory = categories.find(c => c.id === activeCat)
  const filtered = activeCategory
    ? products.filter(p => productMatchesCategory(p, activeCategory))
    : products

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <p style={{ color: '#999' }}>読み込み中...</p>
    </div>
  )

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', paddingBottom: 88 }}>
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

      <header style={{ background: '#222', color: '#fff', padding: '12px 16px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div>
          <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 2 }}>{table.tableName}</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>メニュー</div>
        </div>
      </header>

      <div style={{ display: 'flex', overflowX: 'auto', background: '#fff', borderBottom: '1px solid #eee', position: 'sticky', top: 52, zIndex: 10 }}>
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
          const hasOptions = (product.options ?? []).length > 0
          const { originalPrice, discountAmount, discountedPrice } = getDiscountedProductPrice(product)
          const simpleItem = items.find(i => i.product.id === product.id && i.optionSelections.length === 0)
          const optionQuantity = items
            .filter(i => i.product.id === product.id && i.optionSelections.length > 0)
            .reduce((sum, i) => sum + i.quantity, 0)
          return (
            <div key={product.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #f0f0f0', background: '#fff', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, color: product.isSoldOut ? '#bbb' : '#222' }}>{product.name}</div>
                <div style={{ fontSize: 14, color: discountAmount > 0 ? '#dc2626' : '#666', marginTop: 3, fontWeight: discountAmount > 0 ? 700 : 400 }}>
                  ¥{discountedPrice.toLocaleString()}
                  {discountAmount > 0 && <span style={{ marginLeft: 6, fontSize: 12, color: '#999', textDecoration: 'line-through' }}>¥{originalPrice.toLocaleString()}</span>}
                </div>
                {hasOptions && !product.isSoldOut && (
                  <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                    オプションあり{optionQuantity > 0 && ` / ${optionQuantity}個選択中`}
                  </div>
                )}
                {product.isSoldOut && <div style={{ fontSize: 12, color: '#dc2626', marginTop: 3 }}>売り切れ</div>}
              </div>
              {product.imageUrl && (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }}
                />
              )}
              {hasOptions ? (
                <button
                  onClick={() => handleAddProduct(product)}
                  disabled={product.isSoldOut}
                  style={{ padding: '8px 12px', borderRadius: 8, border: product.isSoldOut ? '1px solid #ddd' : '1px solid #222', background: product.isSoldOut ? '#f5f5f5' : '#222', color: product.isSoldOut ? '#ccc' : '#fff', fontSize: 12, fontWeight: 700, cursor: product.isSoldOut ? 'default' : 'pointer', flexShrink: 0 }}
                >
                  選択
                </button>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <button
                    onClick={() => setSimpleProductQuantity(product, (simpleItem?.quantity ?? 0) - 1)}
                    disabled={product.isSoldOut || !simpleItem}
                    style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid #ddd', background: '#fff', color: simpleItem ? '#222' : '#ccc', fontSize: 18, cursor: product.isSoldOut || !simpleItem ? 'default' : 'pointer' }}
                  >
                    -
                  </button>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    max="99"
                    value={simpleItem?.quantity ?? ''}
                    onChange={e => setSimpleProductQuantity(product, e.target.value)}
                    placeholder="0"
                    disabled={product.isSoldOut}
                    style={{ width: 54, padding: '7px 6px', fontSize: 16, fontWeight: 700, textAlign: 'center', border: '1px solid #ddd', borderRadius: 8, background: product.isSoldOut ? '#f5f5f5' : '#fff' }}
                  />
                  <button
                    onClick={() => setSimpleProductQuantity(product, (simpleItem?.quantity ?? 0) + 1)}
                    disabled={product.isSoldOut}
                    style={{ width: 32, height: 32, borderRadius: '50%', border: product.isSoldOut ? '1px solid #ddd' : '1px solid #222', background: product.isSoldOut ? '#f5f5f5' : '#222', color: product.isSoldOut ? '#ccc' : '#fff', fontSize: 18, cursor: product.isSoldOut ? 'default' : 'pointer' }}
                  >
                    +
                  </button>
                </div>
              )}
            </div>
          )
        })}
        {filtered.length === 0 && (
          <p style={{ textAlign: 'center', padding: 40, color: '#bbb' }}>この分類に商品がありません</p>
        )}
      </div>

      <CustomerBottomNav
        current="menu"
        onCall={handleCall}
        callDisabled={callSent}
        onCheckout={handleCheckout}
        checkoutDisabled={checkoutSent}
        hideCart
      />
      {count > 0 && (
        <button
          type="button"
          onClick={() => navigate('../cart')}
          style={{
            position: 'fixed',
            right: 18,
            bottom: 92,
            zIndex: 46,
            minWidth: 118,
            height: 58,
            borderRadius: 999,
            border: 'none',
            background: '#111827',
            color: '#fff',
            boxShadow: '0 12px 28px rgba(17,24,39,0.32)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            cursor: 'pointer',
            padding: '0 16px',
          }}
          aria-label="カートを確認"
        >
          <span style={{ position: 'relative', fontSize: 25, lineHeight: 1 }}>
            🛒
            <span style={{ position: 'absolute', top: -10, right: -12, minWidth: 20, height: 20, padding: '0 5px', borderRadius: 999, background: '#f97316', color: '#fff', border: '2px solid #111827', fontSize: 12, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}>
              {count}
            </span>
          </span>
          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.15 }}>
            <span style={{ fontSize: 12, fontWeight: 800 }}>カート</span>
            <span style={{ fontSize: 14, fontWeight: 900 }}>¥{total.toLocaleString()}</span>
          </span>
        </button>
      )}
    </div>
  )
}
