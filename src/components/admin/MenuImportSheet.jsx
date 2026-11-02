import { useState } from 'react'
import { decodeCsvBytes, MAX_IMPORT_ROWS, planProductImport, SAMPLE_CSV } from '../../lib/productCsv'
import BottomSheet from '../ui/BottomSheet'

const STATUS_LABEL = { add: '登録', skip: '飛ばす', error: '直す' }

// 商品のまとめて登録（2026-11-02）。CSV を選ぶ → 一覧で確かめる → 登録。写真・選ぶもの・割引は後から1品ずつ。
// blocked：メニューを読み込めていない間は、今ある分類・商品が分からず2重に作るので登録させない。
export default function MenuImportSheet({ products, categories, blocked, onImport, onClose }) {
  const [plan, setPlan] = useState(null)
  const [fileName, setFileName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function readFile(file) {
    if (!file) return
    setError('')
    try {
      const text = decodeCsvBytes(await file.arrayBuffer())
      const result = planProductImport({ text, products, categories })
      if (result.error) {
        setError(result.error)
        setPlan(null)
        return
      }
      setFileName(file.name)
      setPlan(result)
    } catch {
      setError('ファイルを読めませんでした。表計算で「CSV」として保存したファイルを選んでください')
    }
  }

  function saveSample() {
    const url = URL.createObjectURL(new Blob(['\uFEFF', SAMPLE_CSV], { type: 'text/csv' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'メニュー見本.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  async function submit() {
    setBusy(true)
    setError('')
    const failure = await onImport(plan)
    setBusy(false)
    if (!failure) {
      onClose()
      return
    }
    // 途中まで登録できていることがあるので、同じ一覧のまま押し直させない（読み込み直すと、登録できた分は飛ばす）。
    setPlan(null)
    setError(failure)
  }

  const count = status => plan?.rows.filter(row => row.status === status).length ?? 0
  const addCount = count('add')

  return (
    // 登録の途中で閉じて開き直すと、同じファイルを2重に登録できてしまうので、終わるまで閉じさせない。
    <BottomSheet open title="商品をまとめて登録" onClose={() => { if (!busy) onClose() }} closeLabel={busy ? '' : '閉じる'}>
      <div className="menu-sheet">
        {!plan ? (
          <>
            <p className="menu-sheet__note">
              表計算（Excel など）で「分類・商品名・値段」の3列を作り、CSV で保存したファイルを選んでください。
              1行目は見出しでも、いきなり商品でもかまいません。一度に{MAX_IMPORT_ROWS}品まで。
              写真・選ぶもの・割引は、登録した後に1品ずつ足せます。
            </p>
            <div className="menu-import__sample" aria-label="CSV の見本">
              <span>分類</span><span>商品名</span><span>値段</span>
              <span>ビール</span><span>生ビール（中）</span><span>550</span>
              <span>焼き鳥</span><span>もも（塩）</span><span>180</span>
            </div>
            {error && <p className="menu-sheet__error" role="alert">{error}</p>}
            {blocked && !error && <p className="menu-sheet__error" role="alert">メニューを読み込めていません。通信を確かめて画面を開き直してください</p>}
            <div className="menu-sheet__buttons">
              <button type="button" onClick={saveSample} className="ui-button ui-button--soft">見本を保存</button>
              <label className={`ui-button ui-button--primary menu-import__pick${blocked ? ' is-disabled' : ''}`}>
                ファイルを選ぶ
                <input type="file" disabled={blocked} accept=".csv,.txt,text/csv" onChange={event => { readFile(event.target.files?.[0]); event.target.value = '' }} />
              </label>
            </div>
          </>
        ) : (
          <>
            <div className="menu-import__summary">
              <b>{fileName}</b>
              <span>登録 {addCount}品</span>
              {plan.newCategoryNames.length > 0 && <span>新しい分類 {plan.newCategoryNames.length}</span>}
              {count('skip') > 0 && <span>飛ばす {count('skip')}</span>}
              {count('error') > 0 && <span className="is-error">直す {count('error')}</span>}
            </div>
            {plan.newCategoryNames.length > 0 && (
              <p className="menu-sheet__note">
                新しく作る分類：{plan.newCategoryNames.join('・')}（厨房での分け方は「その他」で作ります。あとで「分類を直す」から選べます）
              </p>
            )}
            {count('error') > 0 && (
              <p className="menu-sheet__note">「直す」の行は登録しません。ファイルを直して選び直すか、そのまま残りだけ登録できます。</p>
            )}
            <div className="menu-import__list">
              {plan.rows.map(row => (
                <div key={row.line} className={`menu-import__row is-${row.status}`}>
                  <span className="menu-import__line">{row.line}</span>
                  <span className="menu-import__cat">
                    {row.categoryName || '—'}
                    {row.isNewCategory && row.status === 'add' && <em>新</em>}
                  </span>
                  <span className="menu-import__name">{row.name || '—'}</span>
                  <span className="menu-import__price">{row.price === null ? (row.priceText || '—') : `¥${row.price.toLocaleString()}`}</span>
                  <span className="menu-import__status">{row.message || STATUS_LABEL[row.status]}</span>
                </div>
              ))}
            </div>
            {error && <p className="menu-sheet__error" role="alert">{error}</p>}
            <div className="menu-sheet__buttons menu-import__actions">
              <button type="button" onClick={() => { setPlan(null); setError('') }} className="ui-button ui-button--soft">選び直す</button>
              <button type="button" disabled={busy || blocked || addCount === 0} onClick={submit} className="ui-button ui-button--primary">
                {busy ? '登録しています...' : `${addCount}品を登録する`}
              </button>
            </div>
          </>
        )}
      </div>
    </BottomSheet>
  )
}
