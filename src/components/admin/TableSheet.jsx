import { useRef, useState } from 'react'
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react'
import { buildTableOrderUrl, describeTableUse } from '../../lib/adminTable'
import { downloadQrPosterPdf } from '../../lib/qrPosterPdf'
import BottomSheet from '../ui/BottomSheet'

// 席を押したときのシート（2026-10-23 席設計）。名前の変更・注文用の QR・削除。
// QR の中身（表示・印刷・作り直し）は今までと同じ。見た目の作り直しは「QR」の回。
export default function TableSheet({ table, baseUrl, onRename, onReissueQr, onDelete, onClose }) {
  const [view, setView] = useState('edit')
  const [name, setName] = useState(table.tableName ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const qrCanvasRef = useRef(null)
  const orderUrl = buildTableOrderUrl(baseUrl, table.qrToken)
  const use = describeTableUse(table)

  function go(nextView) {
    setView(nextView)
    setError('')
    setNotice('')
  }

  async function run(action, onDone) {
    setBusy(true)
    setError('')
    const failure = await action()
    setBusy(false)
    if (failure) setError(failure)
    else onDone()
  }

  async function downloadPdf() {
    setBusy(true)
    setError('')
    try {
      await downloadQrPosterPdf(table, qrCanvasRef.current, baseUrl)
    } catch (pdfError) {
      console.error(pdfError)
      setError('PDFを作れませんでした。もう一度お試しください')
    } finally {
      setBusy(false)
    }
  }

  const titles = {
    edit: table.tableName,
    qr: `${table.tableName} の QR`,
    reissue: 'QR を作り直しますか？',
    delete: `${table.tableName} を削除しますか？`,
  }

  return (
    <BottomSheet open title={titles[view]} onClose={onClose}>
      <div className="table-sheet">
        {view === 'edit' && (
          <>
            <form className="table-sheet__field" onSubmit={event => { event.preventDefault(); run(() => onRename(table, name), () => setNotice('名前を変えました')) }}>
              <span>席の名前</span>
              <div className="table-sheet__inline">
                <input value={name} onChange={event => { setName(event.target.value); setNotice(''); setError('') }} className="table-sheet__input" />
                <button type="submit" disabled={busy || !name.trim() || name.trim() === table.tableName} className="ui-button ui-button--primary">保存</button>
              </div>
            </form>
            <p className="table-sheet__note">名前や並び順を変えても、注文用の QR はそのまま使えます。</p>
            {notice && <p className="table-sheet__notice">{notice}</p>}
            <button type="button" onClick={() => go('qr')} className="table-sheet__qr">
              <QRCodeSVG value={orderUrl} size={52} />
              <span><b>注文用の QR</b><small>表示・印刷・作り直し</small></span>
              <em>開く ›</em>
            </button>
            <button type="button" onClick={() => go('delete')} className="table-sheet__line table-sheet__line--danger">
              この席を削除<span aria-hidden="true">›</span>
            </button>
          </>
        )}

        {view === 'qr' && (
          <>
            <div className="table-sheet__qr-large">
              <QRCodeSVG value={orderUrl} size={180} />
              <p className="table-sheet__url">{orderUrl}</p>
            </div>
            <div className="visually-hidden">
              <QRCodeCanvas ref={qrCanvasRef} value={orderUrl} size={1024} includeMargin level="H" />
            </div>
            {notice && <p className="table-sheet__notice">{notice}</p>}
            <p className="table-sheet__note">席の名前や並び順を変えても、この QR は変わりません。作り直したときだけ、古い QR が使えなくなります。</p>
            <button type="button" disabled={busy} onClick={downloadPdf} className="ui-button ui-button--primary ui-button--block">
              {busy ? 'PDFを作っています...' : '印刷用のPDF（A7・8面）'}
            </button>
            <div className="table-sheet__buttons">
              <button type="button" onClick={() => go('edit')} className="ui-button ui-button--soft">戻る</button>
              <button type="button" onClick={() => go('reissue')} className="ui-button ui-button--soft">QR を作り直す</button>
            </div>
          </>
        )}

        {view === 'reissue' && (
          <>
            <p className="table-sheet__note table-sheet__note--strong">今の QR は使えなくなります。机に貼ってある QR も、印刷し直して貼り替えてください。<br />QR が人に知られたなど、困ったときだけ作り直してください。</p>
            <div className="table-sheet__buttons">
              <button type="button" onClick={() => go('qr')} className="ui-button ui-button--soft">やめる</button>
              <button type="button" disabled={busy} onClick={() => run(() => onReissueQr(table), () => { go('qr'); setNotice('QR を作り直しました。新しい QR を印刷して貼り替えてください') })} className="ui-button table-sheet__danger">
                {busy ? '作り直しています...' : '作り直す'}
              </button>
            </div>
          </>
        )}

        {view === 'delete' && (
          use.vacant ? (
            <>
              <p className="table-sheet__note table-sheet__note--strong">席の一覧から消え、この席の QR は使えなくなります。<br />これまでの注文・会計・集計の記録は消えません。</p>
              <div className="table-sheet__buttons">
                <button type="button" onClick={() => go('edit')} className="ui-button ui-button--soft">やめる</button>
                <button type="button" disabled={busy} onClick={() => run(() => onDelete(table), onClose)} className="ui-button table-sheet__danger">
                  {busy ? '削除しています...' : '削除する'}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="table-sheet__warn">お客様がいる席は削除できません。会計を終えて空き席になってから消してください。</p>
              <button type="button" onClick={() => go('edit')} className="ui-button ui-button--soft ui-button--block">戻る</button>
            </>
          )
        )}

        {error && <p className="table-sheet__error" role="alert">{error}</p>}
      </div>
    </BottomSheet>
  )
}
