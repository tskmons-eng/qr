import { useState, useEffect, useRef, useCallback } from 'react'
import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useStore } from '../../contexts/StoreContext'
import { uploadProductImage, deleteProductImage } from '../../lib/imageUpload'

const emptyForm = {
  name: '', price: '', categoryId: '',
  isVisible: true, isSoldOut: false,
  optionsEnabled: false, options: [],
  linkedEnabled: false, linkedProductIds: [],
  displayCategoryIds: [],
}

function normalizeChoices(choices) {
  return (choices ?? []).map(c => typeof c === 'string' ? { label: c, extraPrice: 0 } : c)
}

export default function ProductPage() {
  const { storeId } = useStore()
  const [tab, setTab] = useState('products')
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])

  // product list filters
  const [productSearch, setProductSearch] = useState('')
  const [productCatFilter, setProductCatFilter] = useState('')

  // product form
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savingOptions, setSavingOptions] = useState(false)
  const [savingRelated, setSavingRelated] = useState(false)
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [existingImageUrl, setExistingImageUrl] = useState(null)
  const fileInputRef = useRef(null)

  // per-group new-choice input state
  const [newChoiceInputs, setNewChoiceInputs] = useState([])

  // inline quick-add category
  const [showQuickCat, setShowQuickCat] = useState(false)
  const [quickCatName, setQuickCatName] = useState('')

  // category group filter inside form (for narrowing category select)
  const [catGroupFilter, setCatGroupFilter] = useState('')

  // related products search/filter
  const [relatedSearch, setRelatedSearch] = useState('')
  const [relatedCatFilter, setRelatedCatFilter] = useState('')

  // category tab
  const [newCatName, setNewCatName] = useState('')
  const [newCatGroup, setNewCatGroup] = useState('')
  const [addingCat, setAddingCat] = useState(false)
  const [editingCatId, setEditingCatId] = useState(null)
  const [editingCatName, setEditingCatName] = useState('')
  const [editingCatGroup, setEditingCatGroup] = useState('')

  // ─── データ取得（onSnapshot → getDocs に変更、管理画面はリアルタイム不要）───
  const loadData = useCallback(async () => {
    if (!storeId) return
    const [prodSnap, catSnap] = await Promise.all([
      getDocs(query(collection(db, 'products'), where('storeId', '==', storeId))),
      getDocs(query(collection(db, 'categories'), where('storeId', '==', storeId))),
    ])
    setProducts(prodSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.sortOrder - b.sortOrder))
    setCategories(catSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.sortOrder - b.sortOrder))
  }, [storeId])

  useEffect(() => { loadData() }, [loadData])

  const activeCategories = categories.filter(c => c.isActive)

  // カテゴリグループ絞り込み済みリスト（フォーム内で使用）
  const catsForSelect = catGroupFilter
    ? activeCategories.filter(c => c.group === catGroupFilter)
    : activeCategories

  // 既存オプショングループ名サジェスト
  const allGroupNames = [...new Set(
    products.flatMap(p => (p.options ?? []).map(g => g.groupName)).filter(Boolean)
  )]

  // ─── 画像 ───
  function resetImageState() {
    setImageFile(null); setImagePreview(null); setExistingImageUrl(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ─── フォーム開閉 ───
  function openAdd() {
    setForm(emptyForm)
    setNewChoiceInputs([])
    setEditingId(null)
    setShowForm(true)
    setShowQuickCat(false)
    setQuickCatName('')
    setCatGroupFilter('')
    setRelatedSearch('')
    setRelatedCatFilter('')
    resetImageState()
  }

  function openEdit(p) {
    const opts = (p.options ?? []).map(g => ({ ...g, choices: normalizeChoices(g.choices) }))
    setForm({
      name: p.name, price: String(p.price), categoryId: p.categoryId,
      isVisible: p.isVisible, isSoldOut: p.isSoldOut,
      optionsEnabled: opts.length > 0, options: opts,
      linkedEnabled: (p.linkedProductIds ?? []).length > 0, linkedProductIds: p.linkedProductIds ?? [],
      displayCategoryIds: p.displayCategoryIds ?? [],
    })
    setNewChoiceInputs(opts.map(() => ({ label: '', extraPrice: '' })))
    setEditingId(p.id)
    setShowForm(true)
    setShowQuickCat(false)
    setQuickCatName('')
    setCatGroupFilter('')
    setRelatedSearch('')
    setRelatedCatFilter('')
    setImageFile(null); setImagePreview(null)
    setExistingImageUrl(p.imageUrl ?? null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleFileSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  function clearImage() {
    setImageFile(null); setImagePreview(null); setExistingImageUrl(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ─── オプション ───
  function toggleOptionsEnabled(val) {
    if (!val) { setForm(f => ({ ...f, optionsEnabled: false, options: [] })); setNewChoiceInputs([]) }
    else { setForm(f => ({ ...f, optionsEnabled: true })) }
  }

  function addOptionGroup() {
    setForm(f => ({ ...f, options: [...f.options, { groupName: '', required: true, choices: [] }] }))
    setNewChoiceInputs(prev => [...prev, { label: '', extraPrice: '' }])
  }

  function removeOptionGroup(idx) {
    setForm(f => ({ ...f, options: f.options.filter((_, i) => i !== idx) }))
    setNewChoiceInputs(prev => prev.filter((_, i) => i !== idx))
  }

  function addChoice(idx) {
    const input = newChoiceInputs[idx] ?? { label: '', extraPrice: '' }
    const label = input.label.trim()
    if (!label) return
    const extraPrice = Math.max(0, parseInt(input.extraPrice, 10) || 0)
    setForm(f => {
      const next = [...f.options]
      next[idx] = { ...next[idx], choices: [...(next[idx].choices ?? []), { label, extraPrice }] }
      return { ...f, options: next }
    })
    setNewChoiceInputs(prev => {
      const next = [...prev]; next[idx] = { label: '', extraPrice: '' }; return next
    })
  }

  function removeChoice(groupIdx, choiceIdx) {
    setForm(f => {
      const next = [...f.options]
      next[groupIdx] = { ...next[groupIdx], choices: next[groupIdx].choices.filter((_, i) => i !== choiceIdx) }
      return { ...f, options: next }
    })
  }

  function toggleLinked(productId) {
    setForm(f => {
      const ids = f.linkedProductIds ?? []
      return { ...f, linkedProductIds: ids.includes(productId) ? ids.filter(id => id !== productId) : [...ids, productId] }
    })
  }

  function toggleDisplayCat(catId) {
    setForm(f => {
      const ids = f.displayCategoryIds ?? []
      return { ...f, displayCategoryIds: ids.includes(catId) ? ids.filter(id => id !== catId) : [...ids, catId] }
    })
  }

  // ─── セクション単独保存 ───
  async function saveOptionsOnly() {
    if (!editingId) return
    setSavingOptions(true)
    try {
      const cleanOptions = form.optionsEnabled
        ? form.options.map(g => ({ groupName: g.groupName, required: g.required, choices: g.choices }))
        : []
      await updateDoc(doc(db, 'products', editingId), { options: cleanOptions, updatedAt: serverTimestamp() })
      await loadData()
    } finally { setSavingOptions(false) }
  }

  async function saveRelatedOnly() {
    if (!editingId) return
    setSavingRelated(true)
    try {
      await updateDoc(doc(db, 'products', editingId), {
        linkedProductIds: form.linkedEnabled ? (form.linkedProductIds ?? []) : [],
        updatedAt: serverTimestamp(),
      })
      await loadData()
    } finally { setSavingRelated(false) }
  }

  // ─── 商品保存 ───
  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim() || !form.price || !form.categoryId) return
    setSaving(true)
    try {
      let productId = editingId
      if (!productId) {
        const ref = await addDoc(collection(db, 'products'), {
          storeId, name: form.name.trim(), price: Number(form.price),
          categoryId: form.categoryId, isVisible: form.isVisible, isSoldOut: form.isSoldOut,
          sortOrder: products.length, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        })
        productId = ref.id
      }

      let imageUrl = existingImageUrl ?? null
      if (imageFile) {
        imageUrl = await uploadProductImage(storeId, productId, imageFile)
      } else if (existingImageUrl === null && editingId) {
        await deleteProductImage(storeId, editingId)
      }

      const cleanOptions = form.optionsEnabled
        ? form.options.map(g => ({ groupName: g.groupName, required: g.required, choices: g.choices }))
        : []

      await updateDoc(doc(db, 'products', productId), {
        name: form.name.trim(), price: Number(form.price),
        categoryId: form.categoryId,
        displayCategoryIds: (form.displayCategoryIds ?? []).filter(id => id !== form.categoryId),
        isVisible: form.isVisible, isSoldOut: form.isSoldOut,
        options: cleanOptions,
        linkedProductIds: form.linkedEnabled ? (form.linkedProductIds ?? []) : [],
        imageUrl: imageUrl ?? null, updatedAt: serverTimestamp(),
      })

      setShowForm(false)
      resetImageState()
      await loadData()
    } finally { setSaving(false) }
  }

  async function toggleSoldOut(p) {
    await updateDoc(doc(db, 'products', p.id), { isSoldOut: !p.isSoldOut, updatedAt: serverTimestamp() })
    await loadData()
  }

  async function toggleVisible(p) {
    await updateDoc(doc(db, 'products', p.id), { isVisible: !p.isVisible, updatedAt: serverTimestamp() })
    await loadData()
  }

  // ─── 商品ソート順変更 ───
  async function moveProduct(p, dir) {
    const idx = products.findIndex(x => x.id === p.id)
    const targetIdx = idx + dir
    if (targetIdx < 0 || targetIdx >= products.length) return
    const target = products[targetIdx]
    // optimistic update
    const next = [...products]
    next[idx] = { ...p, sortOrder: target.sortOrder }
    next[targetIdx] = { ...target, sortOrder: p.sortOrder }
    next.sort((a, b) => a.sortOrder - b.sortOrder)
    setProducts(next)
    await Promise.all([
      updateDoc(doc(db, 'products', p.id), { sortOrder: target.sortOrder, updatedAt: serverTimestamp() }),
      updateDoc(doc(db, 'products', target.id), { sortOrder: p.sortOrder, updatedAt: serverTimestamp() }),
    ])
  }

  // ─── カテゴリー管理 ───
  async function handleQuickAddCat(e) {
    e.preventDefault()
    if (!quickCatName.trim()) return
    const ref = await addDoc(collection(db, 'categories'), {
      storeId, name: quickCatName.trim(), sortOrder: categories.length,
      isActive: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    })
    setForm(f => ({ ...f, categoryId: ref.id }))
    setQuickCatName('')
    setShowQuickCat(false)
    await loadData()
  }

  async function handleAddCat(e) {
    e.preventDefault()
    if (!newCatName.trim()) return
    setAddingCat(true)
    await addDoc(collection(db, 'categories'), {
      storeId, name: newCatName.trim(), group: newCatGroup, sortOrder: categories.length,
      isActive: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    })
    setNewCatName('')
    setNewCatGroup('')
    setAddingCat(false)
    await loadData()
  }

  async function toggleCatActive(cat) {
    await updateDoc(doc(db, 'categories', cat.id), { isActive: !cat.isActive, updatedAt: serverTimestamp() })
    await loadData()
  }

  function startEditCat(cat) {
    setEditingCatId(cat.id); setEditingCatName(cat.name); setEditingCatGroup(cat.group ?? '')
  }

  async function saveCatName(cat) {
    if (!editingCatName.trim()) return
    await updateDoc(doc(db, 'categories', cat.id), { name: editingCatName.trim(), group: editingCatGroup, updatedAt: serverTimestamp() })
    setEditingCatId(null)
    await loadData()
  }

  // ─── カテゴリーソート順変更 ───
  async function moveCat(cat, dir) {
    const idx = categories.findIndex(x => x.id === cat.id)
    const targetIdx = idx + dir
    if (targetIdx < 0 || targetIdx >= categories.length) return
    const target = categories[targetIdx]
    const next = [...categories]
    next[idx] = { ...cat, sortOrder: target.sortOrder }
    next[targetIdx] = { ...target, sortOrder: cat.sortOrder }
    next.sort((a, b) => a.sortOrder - b.sortOrder)
    setCategories(next)
    await Promise.all([
      updateDoc(doc(db, 'categories', cat.id), { sortOrder: target.sortOrder, updatedAt: serverTimestamp() }),
      updateDoc(doc(db, 'categories', target.id), { sortOrder: cat.sortOrder, updatedAt: serverTimestamp() }),
    ])
  }

  const catName = id => categories.find(c => c.id === id)?.name ?? ''

  // ─── スタイル helpers ───
  const tabStyle = active => ({
    padding: '8px 20px', fontSize: 14, border: 'none',
    borderBottom: active ? '2px solid #222' : '2px solid transparent',
    background: 'none', cursor: 'pointer',
    color: active ? '#222' : '#888', fontWeight: active ? 600 : 400,
  })

  const toggleStyle = on => ({
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '4px 12px', borderRadius: 99, fontSize: 13, cursor: 'pointer',
    border: `1px solid ${on ? '#222' : '#ddd'}`,
    background: on ? '#222' : '#f5f5f5',
    color: on ? '#fff' : '#888', fontWeight: on ? 600 : 400,
  })

  const sectionSaveStyle = {
    width: '100%', padding: '9px', fontSize: 13,
    background: '#f0f9ff', color: '#0369a1',
    border: '1px solid #bae6fd', borderRadius: 8, cursor: 'pointer', fontWeight: 600,
  }

  const moveBtn = disabled => ({
    width: 26, height: 26, border: '1px solid #e0e0e0', borderRadius: 4,
    background: disabled ? '#f9f9f9' : '#fff', color: disabled ? '#ccc' : '#555',
    cursor: disabled ? 'default' : 'pointer', fontSize: 12,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  })

  const otherProducts = products.filter(p => p.id !== editingId)
  const filteredRelated = otherProducts.filter(p => {
    const matchCat = !relatedCatFilter || p.categoryId === relatedCatFilter
    const matchSearch = !relatedSearch || p.name.includes(relatedSearch)
    return matchCat && matchSearch
  })
  const displayedProducts = products.filter(p => {
    const matchCat = !productCatFilter || p.categoryId === productCatFilter
    const matchSearch = !productSearch || p.name.includes(productSearch)
    return matchCat && matchSearch
  })

  return (
    <div>
      <div style={{ display: 'flex', borderBottom: '1px solid #e5e5e5', marginBottom: 20 }}>
        <button style={tabStyle(tab === 'products')} onClick={() => { setTab('products'); setShowForm(false) }}>商品</button>
        <button style={tabStyle(tab === 'categories')} onClick={() => { setTab('categories'); setShowForm(false) }}>カテゴリー</button>
      </div>

      {/* ===== 商品タブ ===== */}
      {tab === 'products' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ fontSize: 18, margin: 0 }}>商品管理</h2>
            <button onClick={openAdd} style={{ padding: '8px 16px', background: '#222', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
              + 商品追加
            </button>
          </div>

          {!showForm && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
                placeholder="商品名で検索..."
                style={{ flex: 1, padding: '8px 12px', fontSize: 14, border: '1px solid #ddd', borderRadius: 6 }}
              />
              <select value={productCatFilter} onChange={e => setProductCatFilter(e.target.value)} style={{ padding: '8px 10px', fontSize: 14, border: '1px solid #ddd', borderRadius: 6 }}>
                <option value="">すべて</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          {showForm && (
            <div style={{ background: '#fff', border: '1px solid #ddd', borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <h3 style={{ fontSize: 15, marginTop: 0, marginBottom: 16 }}>{editingId ? '商品を編集' : '商品を追加'}</h3>
              <form onSubmit={handleSubmit}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                  {/* メインカテゴリー */}
                  <div>
                    <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>カテゴリー（メイン）</label>

                    {/* グループで絞り込み */}
                    <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                      {[
                        { key: '', label: 'すべて' },
                        { key: 'drink', label: '🥤 ドリンク' },
                        { key: 'food', label: '🍽 フード' },
                      ].map(({ key, label }) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => { setCatGroupFilter(key); setForm(f => ({ ...f, categoryId: '' })) }}
                          style={{ padding: '3px 10px', fontSize: 12, borderRadius: 99, border: catGroupFilter === key ? '1px solid #222' : '1px solid #ddd', background: catGroupFilter === key ? '#222' : '#f5f5f5', color: catGroupFilter === key ? '#fff' : '#666', cursor: 'pointer' }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    {activeCategories.length === 0 && !showQuickCat ? (
                      <div style={{ background: '#fff8e1', border: '1px solid #ffe082', borderRadius: 6, padding: '10px 14px', fontSize: 13, color: '#7c5c00', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>カテゴリーがまだありません</span>
                        <button type="button" onClick={() => setShowQuickCat(true)} style={{ padding: '4px 12px', fontSize: 13, background: '#222', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>+ 作成</button>
                      </div>
                    ) : showQuickCat ? (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input value={quickCatName} onChange={e => setQuickCatName(e.target.value)} placeholder="カテゴリー名" autoFocus style={{ flex: 1, padding: '8px 12px', fontSize: 14, border: '1px solid #ccc', borderRadius: 6 }} />
                        <button type="button" onClick={handleQuickAddCat} style={{ padding: '8px 14px', background: '#222', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>追加</button>
                        <button type="button" onClick={() => setShowQuickCat(false)} style={{ padding: '8px 12px', background: '#fff', border: '1px solid #ccc', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>戻る</button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <select value={form.categoryId} onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))} required style={{ flex: 1, padding: '8px 12px', fontSize: 15, border: '1px solid #ccc', borderRadius: 6 }}>
                          <option value="">選択してください</option>
                          {catsForSelect.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <button type="button" onClick={() => setShowQuickCat(true)} style={{ padding: '8px 12px', fontSize: 13, background: '#fff', border: '1px solid #ccc', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap', color: '#555' }}>+ 新規</button>
                      </div>
                    )}
                  </div>

                  {/* 追加カテゴリー（複数表示用） */}
                  {form.categoryId && activeCategories.length > 1 && (
                    <div>
                      <label style={{ display: 'block', fontSize: 13, color: '#555', marginBottom: 6 }}>追加カテゴリー（複数表示・任意）</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {activeCategories.filter(c => c.id !== form.categoryId).map(c => {
                          const checked = (form.displayCategoryIds ?? []).includes(c.id)
                          return (
                            <button key={c.id} type="button" onClick={() => toggleDisplayCat(c.id)}
                              style={{ padding: '4px 12px', fontSize: 13, borderRadius: 99, border: checked ? '1px solid #222' : '1px solid #ddd', background: checked ? '#222' : '#f5f5f5', color: checked ? '#fff' : '#666', cursor: 'pointer' }}>
                              {c.name}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* 商品名 */}
                  <div>
                    <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>商品名</label>
                    <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required style={{ width: '100%', padding: '8px 12px', fontSize: 15, border: '1px solid #ccc', borderRadius: 6, boxSizing: 'border-box' }} />
                  </div>

                  {/* 価格 */}
                  <div>
                    <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>価格（税込）</label>
                    <input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} required min="0" style={{ width: '100%', padding: '8px 12px', fontSize: 15, border: '1px solid #ccc', borderRadius: 6, boxSizing: 'border-box' }} />
                  </div>

                  {/* 画像 */}
                  <div>
                    <label style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>画像（任意）</label>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      {(imagePreview || existingImageUrl) ? (
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                          <img src={imagePreview ?? existingImageUrl} alt="" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8, border: '1px solid #ddd' }} />
                          <button type="button" onClick={clearImage} style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', background: '#dc2626', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                        </div>
                      ) : (
                        <div onClick={() => fileInputRef.current?.click()} style={{ width: 80, height: 80, borderRadius: 8, border: '2px dashed #ccc', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', gap: 4, flexShrink: 0 }}>
                          <span style={{ fontSize: 22 }}>📷</span>
                          <span style={{ fontSize: 10, color: '#aaa' }}>タップ</span>
                        </div>
                      )}
                      <div style={{ flex: 1 }}>
                        <button type="button" onClick={() => fileInputRef.current?.click()} style={{ padding: '7px 14px', fontSize: 13, background: '#fff', border: '1px solid #ccc', borderRadius: 6, cursor: 'pointer', width: '100%' }}>
                          {imagePreview || existingImageUrl ? '画像を変更' : '画像を選択'}
                        </button>
                        <div style={{ fontSize: 11, color: '#bbb', marginTop: 6 }}>JPEG / PNG / HEIC 対応・自動圧縮</div>
                      </div>
                    </div>
                    <input ref={fileInputRef} type="file" accept="image/*,.heic,.heif" onChange={handleFileSelect} style={{ display: 'none' }} />
                  </div>

                  {/* 表示・売切 */}
                  <div style={{ display: 'flex', gap: 20 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer' }}>
                      <input type="checkbox" checked={form.isVisible} onChange={e => setForm(f => ({ ...f, isVisible: e.target.checked }))} />
                      メニューに表示
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer' }}>
                      <input type="checkbox" checked={form.isSoldOut} onChange={e => setForm(f => ({ ...f, isSoldOut: e.target.checked }))} />
                      売り切れ
                    </label>
                  </div>

                  {/* ─── オプション設定 ─── */}
                  <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: form.optionsEnabled ? 12 : 0 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>オプション</div>
                        <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>塩/タレ選択・サイズ変更など</div>
                      </div>
                      <button type="button" onClick={() => toggleOptionsEnabled(!form.optionsEnabled)} style={toggleStyle(form.optionsEnabled)}>
                        {form.optionsEnabled ? 'ON' : 'OFF'}
                      </button>
                    </div>

                    {form.optionsEnabled && (
                      <div>
                        {form.options.map((opt, idx) => (
                          <div key={idx} style={{ border: '1px solid #e5e5e5', borderRadius: 8, padding: 12, marginBottom: 10, background: '#fafafa' }}>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                              <input
                                value={opt.groupName}
                                onChange={e => setForm(f => { const next = [...f.options]; next[idx] = { ...next[idx], groupName: e.target.value }; return { ...f, options: next } })}
                                placeholder="グループ名（例：タレ）"
                                list={`group-suggestions-${idx}`}
                                style={{ flex: 1, padding: '7px 10px', fontSize: 14, border: '1px solid #ccc', borderRadius: 6 }}
                              />
                              <datalist id={`group-suggestions-${idx}`}>
                                {allGroupNames.map(name => <option key={name} value={name} />)}
                              </datalist>
                              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                <input type="checkbox" checked={opt.required}
                                  onChange={e => setForm(f => { const next = [...f.options]; next[idx] = { ...next[idx], required: e.target.checked }; return { ...f, options: next } })} />
                                必須
                              </label>
                              <button type="button" onClick={() => removeOptionGroup(idx)} style={{ padding: '4px 8px', fontSize: 12, background: '#fff', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: 4, cursor: 'pointer' }}>削除</button>
                            </div>

                            {(opt.choices ?? []).map((c, ci) => (
                              <div key={ci} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                                <span style={{ flex: 1, fontSize: 14, padding: '5px 10px', background: '#fff', border: '1px solid #ddd', borderRadius: 6 }}>
                                  {c.label}
                                  {c.extraPrice > 0 && <span style={{ marginLeft: 6, fontSize: 12, color: '#1d4ed8' }}>+¥{c.extraPrice.toLocaleString()}</span>}
                                </span>
                                <button type="button" onClick={() => removeChoice(idx, ci)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#bbb', padding: '0 4px' }}>×</button>
                              </div>
                            ))}

                            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                              <input
                                value={newChoiceInputs[idx]?.label ?? ''}
                                onChange={e => setNewChoiceInputs(prev => { const next = [...prev]; next[idx] = { ...(next[idx] ?? {}), label: e.target.value }; return next })}
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addChoice(idx) } }}
                                placeholder="選択肢名"
                                style={{ flex: 2, padding: '6px 10px', fontSize: 13, border: '1px solid #ccc', borderRadius: 6 }}
                              />
                              <div style={{ display: 'flex', alignItems: 'center', flex: 1, border: '1px solid #ccc', borderRadius: 6, overflow: 'hidden' }}>
                                <span style={{ padding: '0 6px', fontSize: 12, color: '#888', background: '#f5f5f5', height: '100%', display: 'flex', alignItems: 'center' }}>+¥</span>
                                <input type="number"
                                  value={newChoiceInputs[idx]?.extraPrice ?? ''}
                                  onChange={e => setNewChoiceInputs(prev => { const next = [...prev]; next[idx] = { ...(next[idx] ?? {}), extraPrice: e.target.value }; return next })}
                                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addChoice(idx) } }}
                                  placeholder="0" min="0"
                                  style={{ flex: 1, padding: '6px 8px', fontSize: 13, border: 'none', outline: 'none', width: 0 }}
                                />
                              </div>
                              <button type="button" onClick={() => addChoice(idx)} style={{ padding: '6px 12px', fontSize: 13, background: '#222', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>追加</button>
                            </div>
                          </div>
                        ))}
                        <button type="button" onClick={addOptionGroup}
                          style={{ width: '100%', padding: '9px', fontSize: 13, background: '#fff', border: '1px dashed #ccc', borderRadius: 8, cursor: 'pointer', color: '#666' }}>
                          + グループを追加
                        </button>
                        {editingId && (
                          <button type="button" onClick={saveOptionsOnly} disabled={savingOptions} style={{ ...sectionSaveStyle, marginTop: 8 }}>
                            {savingOptions ? '保存中...' : 'オプションを保存'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* ─── 関連商品 ─── */}
                  <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: form.linkedEnabled ? 12 : 0 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>関連商品</div>
                        <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>「これもいかがですか？」に表示</div>
                      </div>
                      <button type="button"
                        onClick={() => setForm(f => ({ ...f, linkedEnabled: !f.linkedEnabled, linkedProductIds: !f.linkedEnabled ? f.linkedProductIds : [] }))}
                        style={toggleStyle(form.linkedEnabled)}>
                        {form.linkedEnabled ? 'ON' : 'OFF'}
                      </button>
                    </div>

                    {form.linkedEnabled && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <input value={relatedSearch} onChange={e => setRelatedSearch(e.target.value)}
                            placeholder="商品名で検索..."
                            style={{ flex: 1, padding: '7px 10px', fontSize: 13, border: '1px solid #ddd', borderRadius: 6 }} />
                          <select value={relatedCatFilter} onChange={e => setRelatedCatFilter(e.target.value)}
                            style={{ padding: '7px 8px', fontSize: 13, border: '1px solid #ddd', borderRadius: 6 }}>
                            <option value="">すべて</option>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>

                        {filteredRelated.length === 0 ? (
                          <p style={{ color: '#bbb', fontSize: 13, margin: 0 }}>該当する商品がありません</p>
                        ) : (
                          filteredRelated.map(p => (
                            <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: form.linkedProductIds.includes(p.id) ? '#f0f7ff' : '#fafafa', border: `1px solid ${form.linkedProductIds.includes(p.id) ? '#bfdbfe' : '#e5e5e5'}`, borderRadius: 8, cursor: 'pointer' }}>
                              <input type="checkbox" checked={form.linkedProductIds.includes(p.id)} onChange={() => toggleLinked(p.id)} />
                              <span style={{ fontSize: 14, flex: 1 }}>{p.name}</span>
                              <span style={{ fontSize: 12, color: '#aaa' }}>{catName(p.categoryId)}</span>
                              <span style={{ fontSize: 13, color: '#888' }}>¥{p.price.toLocaleString()}</span>
                            </label>
                          ))
                        )}

                        {editingId && (
                          <button type="button" onClick={saveRelatedOnly} disabled={savingRelated} style={sectionSaveStyle}>
                            {savingRelated ? '保存中...' : '関連商品を保存'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
                  <button type="submit" disabled={saving} style={{ padding: '8px 20px', background: '#222', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                    {saving ? '保存中...' : '保存'}
                  </button>
                  <button type="button" onClick={() => setShowForm(false)} style={{ padding: '8px 16px', background: '#fff', border: '1px solid #ccc', borderRadius: 6, cursor: 'pointer' }}>
                    キャンセル
                  </button>
                </div>
              </form>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {displayedProducts.map((p, i) => {
              const isFirst = products.indexOf(p) === 0
              const isLast = products.indexOf(p) === products.length - 1
              return (
                <div key={p.id} style={{ background: '#fff', padding: '12px 16px', borderRadius: 8, border: '1px solid #eee', opacity: p.isVisible ? 1 : 0.55 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {/* ↑↓ ソートボタン */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <button onClick={() => moveProduct(p, -1)} disabled={isFirst} style={moveBtn(isFirst)}>▲</button>
                        <button onClick={() => moveProduct(p, 1)} disabled={isLast} style={moveBtn(isLast)}>▼</button>
                      </div>
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt="" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: 48, height: 48, borderRadius: 6, background: '#f5f5f5', flexShrink: 0 }} />
                      )}
                      <div>
                        <div style={{ fontSize: 12, color: '#888', marginBottom: 2 }}>{catName(p.categoryId)}</div>
                        <div style={{ fontSize: 15, fontWeight: 600 }}>{p.name}</div>
                        <div style={{ fontSize: 13, color: '#555', marginTop: 2 }}>
                          ¥{p.price.toLocaleString()}
                          {(p.options ?? []).length > 0 && <span style={{ marginLeft: 8, fontSize: 11, color: '#888' }}>オプションあり</span>}
                          {(p.linkedProductIds ?? []).length > 0 && <span style={{ marginLeft: 6, fontSize: 11, color: '#888' }}>関連{p.linkedProductIds.length}件</span>}
                          {(p.displayCategoryIds ?? []).length > 0 && <span style={{ marginLeft: 6, fontSize: 11, color: '#1d4ed8' }}>+{p.displayCategoryIds.length}カテゴリー</span>}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {p.isSoldOut && <span style={{ fontSize: 11, background: '#fef2f2', color: '#dc2626', padding: '2px 8px', borderRadius: 4, border: '1px solid #fecaca' }}>売切</span>}
                      <button onClick={() => toggleSoldOut(p)} style={{ padding: '4px 10px', fontSize: 12, border: '1px solid #ddd', borderRadius: 4, cursor: 'pointer', background: '#fff' }}>
                        {p.isSoldOut ? '売切解除' : '売切'}
                      </button>
                      <button onClick={() => toggleVisible(p)} style={{ padding: '4px 10px', fontSize: 12, border: '1px solid #ddd', borderRadius: 4, cursor: 'pointer', background: '#fff' }}>
                        {p.isVisible ? '非表示' : '表示'}
                      </button>
                      <button onClick={() => openEdit(p)} style={{ padding: '4px 10px', fontSize: 12, border: '1px solid #ddd', borderRadius: 4, cursor: 'pointer', background: '#fff' }}>
                        編集
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
            {displayedProducts.length === 0 && (
              <p style={{ color: '#999', textAlign: 'center', padding: 32 }}>
                {productSearch || productCatFilter ? '該当する商品がありません' : '商品がまだありません'}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ===== カテゴリータブ ===== */}
      {tab === 'categories' && (
        <div>
          <h2 style={{ fontSize: 18, marginBottom: 16 }}>カテゴリー管理</h2>
          <form onSubmit={handleAddCat} style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
            <input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="カテゴリー名を入力" style={{ flex: 1, padding: '8px 12px', fontSize: 15, border: '1px solid #ccc', borderRadius: 6 }} />
            <select value={newCatGroup} onChange={e => setNewCatGroup(e.target.value)} style={{ padding: '8px 10px', fontSize: 14, border: '1px solid #ccc', borderRadius: 6 }}>
              <option value="">分類なし</option>
              <option value="drink">ドリンク</option>
              <option value="food">フード</option>
            </select>
            <button type="submit" disabled={addingCat} style={{ padding: '8px 16px', background: '#222', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>追加</button>
          </form>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {categories.map((cat, i) => {
              const isFirst = i === 0
              const isLast = i === categories.length - 1
              return (
                <div key={cat.id} style={{ background: '#fff', padding: '12px 16px', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, border: '1px solid #eee' }}>
                  {editingCatId === cat.id ? (
                    <>
                      <input value={editingCatName} onChange={e => setEditingCatName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveCatName(cat); if (e.key === 'Escape') setEditingCatId(null) }} autoFocus style={{ flex: 1, padding: '6px 10px', fontSize: 15, border: '1px solid #aaa', borderRadius: 6 }} />
                      <select value={editingCatGroup} onChange={e => setEditingCatGroup(e.target.value)} style={{ padding: '6px 8px', fontSize: 13, border: '1px solid #ccc', borderRadius: 6 }}>
                        <option value="">分類なし</option>
                        <option value="drink">ドリンク</option>
                        <option value="food">フード</option>
                      </select>
                      <button onClick={() => saveCatName(cat)} style={{ padding: '4px 12px', fontSize: 13, background: '#222', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>保存</button>
                      <button onClick={() => setEditingCatId(null)} style={{ padding: '4px 10px', fontSize: 13, background: '#fff', border: '1px solid #ddd', borderRadius: 4, cursor: 'pointer' }}>戻る</button>
                    </>
                  ) : (
                    <>
                      {/* ↑↓ ソートボタン */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <button onClick={() => moveCat(cat, -1)} disabled={isFirst} style={moveBtn(isFirst)}>▲</button>
                        <button onClick={() => moveCat(cat, 1)} disabled={isLast} style={moveBtn(isLast)}>▼</button>
                      </div>
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 15, color: cat.isActive ? '#222' : '#aaa' }}>{cat.name}</span>
                        {cat.group === 'drink' && <span style={{ fontSize: 11, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 4, padding: '1px 6px' }}>ドリンク</span>}
                        {cat.group === 'food' && <span style={{ fontSize: 11, background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: 4, padding: '1px 6px' }}>フード</span>}
                      </div>
                      <button onClick={() => startEditCat(cat)} style={{ padding: '4px 10px', fontSize: 13, border: '1px solid #ddd', borderRadius: 4, cursor: 'pointer', background: '#fff' }}>編集</button>
                      <button onClick={() => toggleCatActive(cat)} style={{ padding: '4px 12px', fontSize: 13, border: '1px solid #ddd', borderRadius: 4, cursor: 'pointer', background: '#fff', color: cat.isActive ? '#333' : '#aaa' }}>
                        {cat.isActive ? '表示中' : '非表示'}
                      </button>
                    </>
                  )}
                </div>
              )
            })}
            {categories.length === 0 && (
              <p style={{ color: '#999', textAlign: 'center', padding: 32 }}>カテゴリーがまだありません</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
