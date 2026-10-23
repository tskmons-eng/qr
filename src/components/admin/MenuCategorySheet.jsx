import { useEffect, useState } from 'react'
import { CATEGORY_GROUPS } from '../../lib/productForm'
import BottomSheet from '../ui/BottomSheet'

// 分類の追加・修正（2026-10-23 商品設計）。一覧の見出しから開く。
// フード／ドリンク／その他は厨房の表示と集計に使う。商品が入っている分類は削除できない。
export default function MenuCategorySheet({ category, isFirst, isLast, onSave, onMove, onDelete, onClose }) {
  const isNew = !category?.id
  const [name, setName] = useState('')
  const [group, setGroup] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [view, setView] = useState('edit')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setName(category?.name ?? '')
    setGroup(category?.group ?? '')
    setIsActive(category?.isActive !== false)
    setView('edit')
    setError('')
  }, [category?.id])

  async function run(action, closeAfter) {
    setBusy(true)
    setError('')
    const failure = await action()
    setBusy(false)
    if (failure) setError(failure)
    else if (closeAfter) onClose()
  }

  const title = view === 'delete' ? `分類「${category.name}」を削除しますか？` : isNew ? '分類を追加' : '分類を直す'

  return (
    <BottomSheet open title={title} onClose={onClose}>
      {view === 'delete' ? (
        <div className="menu-sheet">
          <p className="menu-sheet__note">この分類がメニューから消えます。商品が入っている分類は削除できません。</p>
          {error && <p className="menu-sheet__error" role="alert">{error}</p>}
          <div className="menu-sheet__buttons">
            <button type="button" onClick={() => setView('edit')} className="ui-button ui-button--soft">やめる</button>
            <button type="button" disabled={busy} onClick={() => run(() => onDelete(category), true)} className="ui-button menu-sheet__danger">削除する</button>
          </div>
        </div>
      ) : (
        <form className="menu-sheet" onSubmit={event => { event.preventDefault(); run(() => onSave({ categoryId: category?.id ?? null, name, group, isActive }), true) }}>
          <label className="menu-sheet__field">
            <span>分類の名前</span>
            <input value={name} onChange={event => { setName(event.target.value); setError('') }} placeholder="例：焼き鳥" className="menu-sheet__input" autoFocus={isNew} />
          </label>
          <div className="menu-sheet__field">
            <span>厨房での分け方（キッチンの表示と集計に使います）</span>
            <div className="menu-seg">
              {CATEGORY_GROUPS.map(item => (
                <button key={item.key || 'other'} type="button" onClick={() => setGroup(item.key)} className={group === item.key ? 'is-on' : ''}>{item.label}</button>
              ))}
            </div>
          </div>
          <div className="menu-sheet__toggle">
            お客様に出す
            <button type="button" role="switch" aria-checked={isActive} onClick={() => setIsActive(value => !value)} className={`menu-switch${isActive ? ' is-on' : ''}`} aria-label="お客様に出す" />
          </div>
          {!isNew && (
            <div className="menu-sheet__order">
              <span>並び順</span>
              <button type="button" disabled={busy || isFirst} onClick={() => run(() => onMove(category.id, -1), false)} className="ui-button ui-button--soft">上へ</button>
              <button type="button" disabled={busy || isLast} onClick={() => run(() => onMove(category.id, 1), false)} className="ui-button ui-button--soft">下へ</button>
            </div>
          )}
          {error && <p className="menu-sheet__error" role="alert">{error}</p>}
          <div className="menu-sheet__buttons">
            {!isNew && <button type="button" onClick={() => { setView('delete'); setError('') }} className="ui-button menu-sheet__danger menu-sheet__danger--small">削除</button>}
            <button type="submit" disabled={busy} className="ui-button ui-button--primary">{busy ? '保存しています...' : isNew ? '追加する' : '保存する'}</button>
          </div>
        </form>
      )}
    </BottomSheet>
  )
}
