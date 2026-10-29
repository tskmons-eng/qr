import { useRef, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { buildTableOrderUrl } from '../../lib/adminTable'
import { BULK_CARDS_PER_PAGE, downloadAllTablesQrPdf } from '../../lib/qrPosterPdf'
import BottomSheet from '../ui/BottomSheet'

// 全部の席のQRをまとめて印刷（2026-10-28 QR 第1章）。A4に8席分のカード。席の並び順のとおり。
// 1席だけ印刷するときは、席を押して「注文用のQR」から（今までどおり）。
const PREVIEW_COUNT = 5

export default function TableQrPrintSheet({ tables: allTables, baseUrl, onClose }) {
  const tables = allTables.filter(table => table.qrToken)
  const canvasRefs = useRef({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pageCount = Math.ceil(tables.length / BULK_CARDS_PER_PAGE)

  async function handlePrint() {
    setBusy(true)
    setError('')
    try {
      await downloadAllTablesQrPdf(tables.map(table => ({ table, qrCanvas: canvasRefs.current[table.id] })))
    } catch (printError) {
      console.error(printError)
      setError('PDFを作れませんでした。もう一度お試しください')
    } finally {
      setBusy(false)
    }
  }

  return (
    <BottomSheet open title="QRをまとめて印刷" onClose={onClose}>
      <div className="table-sheet">
        {tables.length === 0 ? (
          <p className="table-sheet__note table-sheet__note--strong">まだ席がありません。先に「＋ 席」から席を作ってください。</p>
        ) : (
          <>
            <p className="table-sheet__note table-sheet__note--strong">
              全部の席（{tables.length}席）のQRを、A4に{BULK_CARDS_PER_PAGE}席分ずつ並べたPDFを作ります。印刷して点線で切り、それぞれの席に置いてください。
            </p>
            <div className="table-sheet__preview">
              {tables.slice(0, PREVIEW_COUNT).map(table => <span key={table.id}>{table.tableName}</span>)}
              {tables.length > PREVIEW_COUNT && <span>…ほか{tables.length - PREVIEW_COUNT}席</span>}
            </div>
            <div className="visually-hidden" aria-hidden="true">
              {tables.map(table => (
                <QRCodeCanvas
                  key={table.id}
                  ref={node => { canvasRefs.current[table.id] = node }}
                  value={buildTableOrderUrl(baseUrl, table.qrToken)}
                  size={512}
                  includeMargin
                  level="H"
                />
              ))}
            </div>
            {error && <p className="table-sheet__error" role="alert">{error}</p>}
            <button type="button" disabled={busy} onClick={handlePrint} className="ui-button ui-button--primary ui-button--block">
              {busy ? 'PDFを作っています...' : `PDFを作る（${pageCount}枚）`}
            </button>
            <p className="table-sheet__note">1席だけ印刷するときは、席を押して「注文用のQR」から。</p>
          </>
        )}
      </div>
    </BottomSheet>
  )
}
