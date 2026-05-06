import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useOrder } from '../../contexts/OrderContext'
import { useCart } from '../../contexts/CartContext'
import OptionModal from '../../components/OptionModal'
import SuggestionSheet from '../../components/SuggestionSheet'

export default function MenuPage() {
  const { storeId, tableId, orderId, table } = useOrder()
  const { addItem, count, total } = useCart()
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [activeCat, setActiveCat] = useState(null)
  const [loading, setLoading] = useState(true)
  const [callSent, setCallSent] = useState(false)
  const [optionTarget, setOptionTarget] = useState(null)
  const [suggestions, setSuggestions] = useState([])
  const cooldownRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => () => clearTimeout(cooldownRef.current), [])

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

  function handleOptionConfirm(optionSelections) {
    const product = optionTarget
    addItem(product, optionSelections)
    setOptionTarget(null)
    showSuggestionsFor(product)
  }

  function handleSuggestionAdd(product) {
    handleAddProduct(product)
    setSuggestions([])
  }

  const filtered = activeCat
    ? products.filter(p => p.categoryId === activeCat || (p.displayCategoryIds ?? []).includes(activeCat))
    : products

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <p style={{ color: '#999' }}>読み込み中...</p>
    </div>
  )

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', paddingBottom: count > 0 ? 88 : 0 }}>
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

      <header style={{ background: '#222', color: '#fff', padding: '12px 16px', position: 'sticky', top: 0, zIndex: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 2 }}>{table.tableName}</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>メニュー</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleCall}
            disabled={callSent}
            style={{ background: callSent ? 'rgba(251,146,60,0.25)' : 'rgba(251,146,60,0.2)', border: '1px solid rgba(251,146,60,0.6)', color: callSent ? '#fed7aa' : '#fb923c', padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: callSent ? 'default' : 'pointer', fontWeight: 600 }}
          >
            {callSent ? '呼び出し中' : '呼び出す'}
          </button>
          <button
            onClick={() => navigate('../complete')}
            style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}
          >
            注文確認
          </button>
        </div>
      </header>

      <div style={{ display: 'flex', overflowX: 'auto', background: '#fff', borderBottom: '1px solid #eee', position: 'sticky', top: 52, zIndex: 10 }}>
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCat(cat.id)}
            style={{
              padding: '11px 14px',
              border: 'none',
              background: 'none',
              fontSize: 14,
              fontWeight: activeCat === cat.id ? 700 : 400,
              color: activeCat === cat.id ? '#222' : '#888',
              borderBottom: activeCat === cat.id ? '2px solid #222' : '2px solid transparent',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {cat.name}
          </button>
        ))}
      </div>

      <div>
        {filtered.map(product => (
          <div key={product.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #f0f0f0', background: '#fff', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, color: product.isSoldOut ? '#bbb' : '#222' }}>{product.name}</div>
              <div style={{ fontSize: 14, color: '#666', marginTop: 3 }}>¥{product.price.toLocaleString()}</div>
              {(product.options ?? []).length > 0 && !product.isSoldOut && (
                <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>選択あり</div>
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
            <button
              onClick={() => handleAddProduct(product)}
              disabled={product.isSoldOut}
              style={{
                width: 38, height: 38, borderRadius: '50%',
                border: product.isSoldOut ? '2px solid #ddd' : '2px solid #222',
                background: product.isSoldOut ? '#f5f5f5' : '#222',
                color: product.isSoldOut ? '#ccc' : '#fff',
                fontSize: 22, cursor: product.isSoldOut ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}
            >
              +
            </button>
          </div>
        ))}
        {filtered.length === 0 && (
          <p style={{ textAlign: 'center', padding: 40, color: '#bbb' }}>この分類に商品がありません</p>
        )}
      </div>

      {count > 0 && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '12px 16px', background: '#fff', borderTop: '1px solid #eee' }}>
          <button
            onClick={() => navigate('../cart')}
            style={{ width: '100%', padding: '14px 16px', fontSize: 15, background: '#222', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <span style={{ background: '#fff', color: '#222', borderRadius: '50%', width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700 }}>{count}</span>
            <span>カートを確認</span>
            <span>¥{total.toLocaleString()}</span>
          </button>
        </div>
      )}
    </div>
  )
}
