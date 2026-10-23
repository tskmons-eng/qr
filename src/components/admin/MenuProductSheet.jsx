import { useEffect, useRef, useState } from 'react'
import { emptyProductForm, productFormFromProduct } from '../../lib/productForm'
import BottomSheet from '../ui/BottomSheet'
import MenuDiscountEditor from './MenuDiscountEditor'
import MenuOptionEditor from './MenuOptionEditor'

// 商品の追加・修正（2026-10-23 商品設計）。先に名前・値段・分類・写真だけ。
// 選ぶもの・期間割引は「くわしい設定」を開いたときだけ。保存のボタンは1つ。追加は「続けて追加」で次々入れられる。
export default function MenuProductSheet({ product, initialCategoryId, categories, onSave, onDelete, onQuickCategory, onClose }) {
  const isNew = !product?.id
  const [form, setForm] = useState(emptyProductForm)
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [existingImageUrl, setExistingImageUrl] = useState(null)
  const [showDetails, setShowDetails] = useState(false)
  const [view, setView] = useState('edit')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [newCategoryName, setNewCategoryName] = useState(null)
  const [createdId, setCreatedId] = useState(null)
  const fileInputRef = useRef(null)
  const nameInputRef = useRef(null)

  // 選び直したり閉じたりしたら、写真の確認用の一時URLを片付ける。
  useEffect(() => () => { if (imagePreview) URL.revokeObjectURL(imagePreview) }, [imagePreview])

  function resetForNew(categoryId) {
    setCreatedId(null)
    setForm({ ...emptyProductForm, categoryId: categoryId ?? '' })
    setImageFile(null)
    setImagePreview(null)
    setExistingImageUrl(null)
    setShowDetails(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  useEffect(() => {
    setView('edit')
    setError('')
    setNotice('')
    setNewCategoryName(null)
    setCreatedId(null)
    if (isNew) {
      resetForNew(initialCategoryId)
      return
    }
    const nextForm = productFormFromProduct(product)
    setForm(nextForm)
    setImageFile(null)
    setImagePreview(null)
    setExistingImageUrl(product.imageUrl ?? null)
    setShowDetails(nextForm.options.length > 0 || nextForm.discountConfig.enabled)
  }, [product?.id, initialCategoryId])

  const update = patch => { setForm(prev => ({ ...prev, ...patch })); setError('') }

  async function save(keepAdding) {
    setBusy(true)
    setError('')
    setNotice('')
    const removeImage = Boolean(product?.imageUrl) && !existingImageUrl && !imageFile
    const result = await onSave({ productId: product?.id ?? createdId, form, imageFile, existingImageUrl, removeImage })
    setBusy(false)
    if (result.error) {
      // 途中で失敗しても、もう作った商品はその id で直す（もう一度押しても2重にならない）。
      if (result.productId) setCreatedId(result.productId)
      setError(result.error)
      return
    }
    if (keepAdding) {
      setNotice(`「${form.name.trim()}」を追加しました。続けて入れてください`)
      resetForNew(form.categoryId)
      nameInputRef.current?.focus()
      return
    }
    onClose()
  }

  async function handleDelete() {
    setBusy(true)
    const failure = await onDelete(product)
    setBusy(false)
    if (failure) setError(failure)
    else onClose()
  }

  async function handleQuickCategory() {
    const name = (newCategoryName ?? '').trim()
    if (!name) return
    setBusy(true)
    const result = await onQuickCategory(name)
    setBusy(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setNewCategoryName(null)
    update({ categoryId: result.id })
  }

  const imageUrl = imagePreview ?? existingImageUrl
  const title = view === 'delete' ? `${product.name} を削除しますか？` : isNew ? '商品を追加' : product.name

  return (
    <BottomSheet open title={title} onClose={onClose}>
      {view === 'delete' ? (
        <div className="menu-sheet">
          <p className="menu-sheet__note">メニューから消えます。これまでの注文・会計・集計の記録は消えません。<br />しばらく出さないだけなら「お客様に出す」をオフにしてください。</p>
          {error && <p className="menu-sheet__error" role="alert">{error}</p>}
          <div className="menu-sheet__buttons">
            <button type="button" onClick={() => setView('edit')} className="ui-button ui-button--soft">やめる</button>
            <button type="button" disabled={busy} onClick={handleDelete} className="ui-button menu-sheet__danger">{busy ? '削除しています...' : '削除する'}</button>
          </div>
        </div>
      ) : (
        <form className="menu-sheet" onSubmit={event => { event.preventDefault(); save(false) }}>
          {notice && <p className="menu-sheet__notice">{notice}</p>}
          <div className="menu-sheet__row">
            <label className="menu-sheet__field">
              <span>商品名</span>
              <input ref={nameInputRef} value={form.name} onChange={event => update({ name: event.target.value })} placeholder="例：ハイボール" className="menu-sheet__input" />
            </label>
            <label className="menu-sheet__field menu-sheet__field--price">
              <span>値段（税込）</span>
              <input value={form.price} onChange={event => update({ price: event.target.value.replace(/[^0-9]/g, '') })} inputMode="numeric" placeholder="480" className="menu-sheet__input" />
            </label>
          </div>
          <div className="menu-sheet__field">
            <span>分類</span>
            <div className="menu-sheet__cats">
              {categories.map(category => (
                <button key={category.id} type="button" onClick={() => update({ categoryId: category.id })} className={form.categoryId === category.id ? 'is-on' : ''}>
                  {category.name}
                </button>
              ))}
              {newCategoryName === null ? (
                <button type="button" onClick={() => setNewCategoryName('')} className="menu-sheet__cat-new">＋ 新しい分類</button>
              ) : (
                <span className="menu-sheet__cat-input">
                  <input value={newCategoryName} onChange={event => setNewCategoryName(event.target.value)} placeholder="分類の名前" className="menu-sheet__input" autoFocus />
                  <button type="button" onClick={handleQuickCategory} disabled={busy} className="ui-button ui-button--soft">作る</button>
                </span>
              )}
            </div>
          </div>
          <div className="menu-sheet__field">
            <span>写真（なくてもよい）</span>
            <div className="menu-sheet__photo">
              {imageUrl ? <img src={imageUrl} alt="" className="menu-sheet__photo-img" /> : <span className="menu-sheet__photo-img menu-sheet__photo-img--empty">写真なし</span>}
              <button type="button" onClick={() => fileInputRef.current?.click()} className="ui-button ui-button--soft">{imageUrl ? '写真を変える' : '写真を選ぶ・撮る'}</button>
              {imageUrl && (
                <button type="button" onClick={() => { setImageFile(null); setImagePreview(null); setExistingImageUrl(null) }} className="ui-button ui-button--ghost">外す</button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.heic,.heif"
                onChange={event => {
                  const file = event.target.files?.[0]
                  if (!file) return
                  setImageFile(file)
                  setImagePreview(URL.createObjectURL(file))
                }}
                className="visually-hidden"
              />
            </div>
          </div>
          <div className="menu-sheet__toggles">
            <div className="menu-sheet__toggle">
              お客様に出す
              <button type="button" role="switch" aria-checked={form.isVisible} onClick={() => update({ isVisible: !form.isVisible })} className={`menu-switch${form.isVisible ? ' is-on' : ''}`} aria-label="お客様に出す" />
            </div>
            <div className="menu-sheet__toggle">
              売り切れ
              <button type="button" role="switch" aria-checked={form.isSoldOut} onClick={() => update({ isSoldOut: !form.isSoldOut })} className={`menu-switch${form.isSoldOut ? ' is-on' : ''}`} aria-label="売り切れ" />
            </div>
          </div>
          <button type="button" onClick={() => setShowDetails(open => !open)} className="menu-sheet__more" aria-expanded={showDetails}>
            くわしい設定（選ぶもの・期間割引）<span>{showDetails ? '▴' : '▾'}</span>
          </button>
          {showDetails && (
            <>
              <MenuOptionEditor options={form.options} onChange={options => update({ options })} />
              <MenuDiscountEditor discountConfig={form.discountConfig} onChange={discountConfig => update({ discountConfig })} />
            </>
          )}
          {error && <p className="menu-sheet__error" role="alert">{error}</p>}
          <div className="menu-sheet__buttons">
            {isNew ? (
              <button type="button" disabled={busy} onClick={() => save(true)} className="ui-button ui-button--soft">続けて追加</button>
            ) : (
              <button type="button" onClick={() => { setView('delete'); setError('') }} className="ui-button menu-sheet__danger menu-sheet__danger--small">削除</button>
            )}
            <button type="submit" disabled={busy} className="ui-button ui-button--primary">
              {busy ? '保存しています...' : isNew ? '追加する' : '保存する'}
            </button>
          </div>
        </form>
      )}
    </BottomSheet>
  )
}
