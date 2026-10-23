import { useState } from 'react'
import { buildBulkTableNames } from '../../lib/tableOrder'
import BottomSheet from '../ui/BottomSheet'

// 席の追加（2026-10-23 席設計）。「1つだけ」か「番号でまとめて」（例：テーブル1〜8）。
// 同じ名前の席がもうあるときは作らずに飛ばす。作った席は並びの一番下に入る。
export default function TableAddSheet({ tables, onAdd, onClose }) {
  const [mode, setMode] = useState(tables.length === 0 ? 'bulk' : 'single')
  const [name, setName] = useState('')
  const [prefix, setPrefix] = useState('テーブル')
  const [from, setFrom] = useState('1')
  const [to, setTo] = useState('8')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const existingNames = tables.map(table => String(table.tableName ?? '').trim())
  const bulk = buildBulkTableNames({ prefix, from, to, existingNames })
  const singleName = name.trim()
  const singleDuplicate = existingNames.includes(singleName)
  const names = mode === 'single' ? (singleName && !singleDuplicate ? [singleName] : []) : bulk.names

  async function submit(event) {
    event.preventDefault()
    if (names.length === 0 || busy) return
    setBusy(true)
    setError('')
    const failure = await onAdd(names)
    setBusy(false)
    if (failure) setError(failure)
    else onClose()
  }

  const onlyDigits = value => value.replace(/[^0-9]/g, '')

  return (
    <BottomSheet open title="席を追加" onClose={onClose}>
      <form className="table-sheet" onSubmit={submit}>
        <div className="table-sheet__seg" role="tablist" aria-label="追加のしかた">
          <button type="button" onClick={() => setMode('single')} className={mode === 'single' ? 'is-on' : ''}>1つだけ</button>
          <button type="button" onClick={() => setMode('bulk')} className={mode === 'bulk' ? 'is-on' : ''}>番号でまとめて</button>
        </div>
        {mode === 'single' ? (
          <>
            <label className="table-sheet__field">
              <span>席の名前</span>
              <input value={name} onChange={event => { setName(event.target.value); setError('') }} placeholder="例：カウンター1" className="table-sheet__input" autoFocus />
            </label>
            {singleDuplicate && <p className="table-sheet__warn">同じ名前の席がもうあります</p>}
          </>
        ) : (
          <>
            <label className="table-sheet__field">
              <span>頭に付ける文字</span>
              <input value={prefix} onChange={event => { setPrefix(event.target.value); setError('') }} placeholder="例：テーブル（なしでもよい）" className="table-sheet__input" />
            </label>
            <div className="table-sheet__row">
              <label className="table-sheet__field">
                <span>はじめの番号</span>
                <input value={from} onChange={event => setFrom(onlyDigits(event.target.value))} inputMode="numeric" className="table-sheet__input" />
              </label>
              <label className="table-sheet__field">
                <span>おわりの番号</span>
                <input value={to} onChange={event => setTo(onlyDigits(event.target.value))} inputMode="numeric" className="table-sheet__input" />
              </label>
            </div>
            {bulk.error ? (
              <p className="table-sheet__warn">{bulk.error}</p>
            ) : (
              <div className="table-sheet__field">
                <span>できる席（{bulk.names.length}席）</span>
                <div className="table-sheet__preview">
                  {bulk.names.map(item => <span key={item}>{item}</span>)}
                </div>
                {bulk.skipped.length > 0 && <p className="table-sheet__note">もうある席は作りません：{bulk.skipped.join('・')}</p>}
              </div>
            )}
          </>
        )}
        {error && <p className="table-sheet__error" role="alert">{error}</p>}
        <button type="submit" disabled={busy || names.length === 0} className="ui-button ui-button--primary ui-button--block">
          {busy ? '追加しています...' : names.length > 1 ? `${names.length}席を追加する` : '追加する'}
        </button>
      </form>
    </BottomSheet>
  )
}
