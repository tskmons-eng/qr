import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react'
import { buildTableOrderUrl } from '../../lib/adminTable'

export default function AdminTableQrDialog({
  table,
  baseUrl,
  qrCanvasRef,
  generatingPdf,
  onDownloadPosterPdf,
  onReissueQr,
  onClose,
}) {
  if (!table) return null

  const orderUrl = buildTableOrderUrl(baseUrl, table.qrToken)

  return (
    <div className="admin-modal-backdrop" onClick={onClose}>
      <div className="admin-dialog" onClick={event => event.stopPropagation()}>
        <h3 className="admin-dialog-title">{table.tableName}</h3>
        <QRCodeSVG value={orderUrl} size={200} />
        <div className="visually-hidden">
          <QRCodeCanvas ref={qrCanvasRef} value={orderUrl} size={1024} includeMargin level="H" />
        </div>
        <p className="admin-dialog-link">{orderUrl}</p>
        <p className="admin-dialog-note">席名やグループを変更しても、このURLは変わりません。QR再発行時だけ古いURLが使えなくなります。</p>
        <button
          type="button"
          onClick={() => onDownloadPosterPdf(table)}
          disabled={generatingPdf}
          className={`qr-poster-button${generatingPdf ? ' is-disabled' : ''}`}
        >
          {generatingPdf ? 'PDF作成中...' : 'A7 8面PDFをダウンロード'}
        </button>
        <div className="admin-dialog-actions">
          <button
            type="button"
            onClick={() => onReissueQr(table)}
            className="button button-secondary admin-dialog-action"
          >
            QR再発行
          </button>
          <button
            type="button"
            onClick={onClose}
            className="button button-primary admin-dialog-action admin-dialog-action-primary"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  )
}
