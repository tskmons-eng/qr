import { useState, useEffect, useRef } from 'react'
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore'
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react'
import { db } from '../../lib/firebase'
import { useStore } from '../../contexts/StoreContext'

function generateToken() {
  const arr = new Uint8Array(16)
  crypto.getRandomValues(arr)
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
}

const statusLabel = { vacant: '空席', occupied: '使用中', checkout_pending: '会計待ち' }

const QR_POSTER_TEMPLATE_SRC = '/qr-poster-templates.png'
const QR_POSTER_TEMPLATES = {
  b: {
    source: { x: 29, y: 58, w: 646, h: 1028 },
    qrFrame: { x: 205, y: 446, w: 253, h: 253, radius: 18 },
    qrPadding: 29,
  },
  d: {
    source: { x: 714, y: 52, w: 660, h: 1038 },
    qrFrame: { x: 205, y: 462, w: 244, h: 244, radius: 16 },
    qrPadding: 28,
  },
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function fillRoundRect(ctx, x, y, w, h, r, fill, stroke = null, lineWidth = 1) {
  roundRect(ctx, x, y, w, h, r)
  ctx.fillStyle = fill
  ctx.fill()
  if (stroke) {
    ctx.strokeStyle = stroke
    ctx.lineWidth = lineWidth
    ctx.stroke()
  }
}

function centeredText(ctx, text, x, y, font, color, maxWidth = undefined) {
  ctx.font = font
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x, y, maxWidth)
}

function drawPhoneQrIcon(ctx, x, y, scale, color) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = 7 * scale
  roundRect(ctx, x, y, 74 * scale, 120 * scale, 16 * scale)
  ctx.stroke()
  ctx.fillRect(x + 25 * scale, y + 13 * scale, 24 * scale, 5 * scale)
  for (let r = 0; r < 3; r += 1) {
    for (let c = 0; c < 3; c += 1) {
      if ((r + c) % 2 === 0) ctx.fillRect(x + (19 + c * 16) * scale, y + (40 + r * 16) * scale, 9 * scale, 9 * scale)
    }
  }
  ctx.beginPath()
  ctx.moveTo(x + 48 * scale, y + 82 * scale)
  ctx.lineTo(x + 48 * scale, y + 137 * scale)
  ctx.quadraticCurveTo(x + 28 * scale, y + 122 * scale, x + 26 * scale, y + 102 * scale)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x + 72 * scale, y - 24 * scale)
  ctx.lineTo(x + 72 * scale, y - 5 * scale)
  ctx.moveTo(x + 91 * scale, y - 17 * scale)
  ctx.lineTo(x + 80 * scale, y)
  ctx.moveTo(x + 101 * scale, y + 4 * scale)
  ctx.lineTo(x + 84 * scale, y + 10 * scale)
  ctx.stroke()
  ctx.restore()
}

function drawHandPhone(ctx, x, y, scale, color) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = 4 * scale
  ctx.lineCap = 'round'
  roundRect(ctx, x, y, 82 * scale, 130 * scale, 10 * scale)
  ctx.stroke()
  ctx.strokeRect(x + 22 * scale, y + 45 * scale, 38 * scale, 32 * scale)
  ctx.beginPath()
  ctx.moveTo(x - 30 * scale, y + 118 * scale)
  ctx.lineTo(x + 10 * scale, y + 55 * scale)
  ctx.lineTo(x + 25 * scale, y + 155 * scale)
  ctx.moveTo(x + 26 * scale, y + 155 * scale)
  ctx.lineTo(x + 70 * scale, y + 168 * scale)
  ctx.stroke()
  ctx.restore()
}

function drawFeatureIcon(ctx, kind, x, y, color) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = 5
  ctx.lineCap = 'round'
  if (kind === 'order') {
    ctx.beginPath()
    ctx.moveTo(x - 18, y - 28)
    ctx.lineTo(x - 18, y + 28)
    ctx.moveTo(x - 30, y - 28)
    ctx.lineTo(x - 30, y + 10)
    ctx.moveTo(x - 6, y - 28)
    ctx.lineTo(x - 6, y + 10)
    ctx.moveTo(x + 18, y - 28)
    ctx.quadraticCurveTo(x + 42, y - 5, x + 19, y + 12)
    ctx.lineTo(x + 19, y + 30)
    ctx.stroke()
  }
  if (kind === 'call') {
    ctx.beginPath()
    ctx.arc(x, y + 4, 32, Math.PI, 0)
    ctx.lineTo(x + 32, y + 20)
    ctx.lineTo(x - 32, y + 20)
    ctx.closePath()
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x, y - 34)
    ctx.lineTo(x, y - 44)
    ctx.moveTo(x - 10, y + 28)
    ctx.quadraticCurveTo(x, y + 40, x + 10, y + 28)
    ctx.stroke()
  }
  if (kind === 'yen') {
    centeredText(ctx, '¥', x, y + 5, 'bold 74px sans-serif', color)
  }
  ctx.restore()
}

function drawLogo(ctx, x, y, scale, dark = false) {
  const orange = '#f97316'
  drawPhoneQrIcon(ctx, x, y, scale, orange)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.font = `900 ${82 * scale}px sans-serif`
  ctx.fillStyle = dark ? '#fff' : '#111827'
  ctx.fillText('レジ', x + 120 * scale, y + 62 * scale)
  ctx.fillStyle = orange
  ctx.fillText('スク', x + 283 * scale, y + 62 * scale)
  ctx.font = `700 ${17 * scale}px sans-serif`
  ctx.fillStyle = dark ? '#f3f4f6' : '#1f2937'
  ctx.fillText('注文・呼び出し・会計を、もっと簡単に', x + 125 * scale, y + 118 * scale)
}

function drawDesignB(ctx, x, y, w, h, qrImage, tableName) {
  const gold = '#b99445'
  ctx.save()
  ctx.fillStyle = '#faf9f5'
  ctx.fillRect(x, y, w, h)
  ctx.strokeStyle = gold
  ctx.lineWidth = 5
  ctx.strokeRect(x + 14, y + 14, w - 28, h - 28)
  drawLogo(ctx, x + 350, y + 90, 1.35, false)
  centeredText(ctx, tableName, x + w / 2, y + 310, 'bold 36px sans-serif', gold)
  centeredText(ctx, 'スマホで簡単！', x + w / 2, y + 405, 'bold 48px sans-serif', gold)
  centeredText(ctx, 'QRコードを読み取って', x + w / 2, y + 535, 'bold 65px sans-serif', '#111827')
  centeredText(ctx, '注文・呼び出し・会計が', x + w / 2, y + 655, '900 72px sans-serif', '#111827')
  centeredText(ctx, 'できます', x + w / 2, y + 760, '900 72px sans-serif', '#111827')
  ctx.strokeStyle = gold
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(x + 230, y + 720)
  ctx.lineTo(x + w - 230, y + 720)
  ctx.stroke()
  drawHandPhone(ctx, x + 115, y + 930, 1.35, '#111827')
  fillRoundRect(ctx, x + 345, y + 820, 550, 550, 36, '#fff', '#333', 3)
  ctx.drawImage(qrImage, x + 385, y + 860, 470, 470)
  const features = [
    ['order', '注文', 'お好きなメニューを', 'ご注文いただけます'],
    ['call', '呼び出し', 'スタッフを', '呼び出せます'],
    ['yen', '会計', 'そのまま', 'お会計ができます'],
  ]
  features.forEach(([kind, title, line1, line2], idx) => {
    const cx = x + 215 + idx * 405
    ctx.beginPath()
    ctx.arc(cx, y + 1390, 110, 0, Math.PI * 2)
    ctx.strokeStyle = gold
    ctx.lineWidth = 2
    ctx.stroke()
    drawFeatureIcon(ctx, kind, cx, y + 1360, gold)
    centeredText(ctx, title, cx, y + 1484, '900 38px sans-serif', '#111827')
    centeredText(ctx, line1, cx, y + 1578, 'bold 24px sans-serif', '#111827')
    centeredText(ctx, line2, cx, y + 1628, 'bold 24px sans-serif', '#111827')
    if (idx < 2) {
      ctx.setLineDash([5, 14])
      ctx.strokeStyle = gold
      ctx.beginPath()
      ctx.moveTo(cx + 205, y + 1300)
      ctx.lineTo(cx + 205, y + 1640)
      ctx.stroke()
      ctx.setLineDash([])
    }
  })
  ctx.fillStyle = '#07111f'
  ctx.fillRect(x, y + h - 130, w, 130)
  centeredText(ctx, 'ご不明点はスタッフまでお声がけください', x + w / 2, y + h - 65, 'bold 36px sans-serif', '#fff')
  ctx.restore()
}

function drawDesignD(ctx, x, y, w, h, qrImage, tableName) {
  ctx.save()
  ctx.fillStyle = '#151515'
  ctx.fillRect(x, y, w, h)
  ctx.strokeStyle = '#e5e7eb'
  ctx.lineWidth = 4
  ctx.strokeRect(x + 24, y + 24, w - 48, h - 48)
  ctx.strokeStyle = '#9ca3af'
  ctx.lineWidth = 2
  ctx.strokeRect(x + 42, y + 42, w - 84, h - 84)
  drawLogo(ctx, x + 295, y + 95, 1.45, true)
  centeredText(ctx, tableName, x + w / 2, y + 335, 'bold 34px sans-serif', '#d1d5db')
  ctx.save()
  ctx.translate(x + w / 2, y + 455)
  ctx.rotate(-0.04)
  fillRoundRect(ctx, -255, -45, 510, 90, 8, 'transparent', '#e5e7eb', 4)
  centeredText(ctx, 'スマホで簡単！', 0, 0, '900 50px sans-serif', '#fff')
  ctx.restore()
  centeredText(ctx, 'QRコードを読み取って', x + w / 2, y + 590, '900 60px sans-serif', '#fff')
  ctx.font = '900 56px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#f6c344'
  ctx.fillText('注文', x + 345, y + 685)
  ctx.fillStyle = '#85c45a'
  ctx.fillText('・呼び出し', x + 550, y + 685)
  ctx.fillStyle = '#7db7e8'
  ctx.fillText('・会計', x + 790, y + 685)
  ctx.fillStyle = '#fff'
  ctx.fillText('ができます', x + 1015, y + 685)
  ctx.setLineDash([4, 12])
  ctx.strokeStyle = '#e5e7eb'
  ctx.beginPath()
  ctx.moveTo(x + 95, y + 750)
  ctx.lineTo(x + w - 95, y + 750)
  ctx.stroke()
  ctx.setLineDash([])
  drawHandPhone(ctx, x + 130, y + 875, 1.35, '#f9fafb')
  fillRoundRect(ctx, x + 410, y + 815, 550, 550, 34, '#fff', '#f3f4f6', 6)
  ctx.drawImage(qrImage, x + 450, y + 855, 470, 470)
  fillRoundRect(ctx, x + 65, y + 1290, w - 130, 305, 26, 'rgba(0,0,0,0.2)', '#e5e7eb', 2)
  const features = [
    ['order', '注文', '#d5b16b', 'お好きなメニューを', 'ご注文いただけます'],
    ['call', '呼び出し', '#86b85d', 'スタッフを', '呼び出せます'],
    ['yen', '会計', '#7db7e8', 'そのまま', 'お会計ができます'],
  ]
  features.forEach(([kind, title, color, line1, line2], idx) => {
    const cx = x + 230 + idx * 390
    ctx.beginPath()
    ctx.arc(cx, y + 1375, 62, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.globalAlpha = 0.85
    ctx.fill()
    ctx.globalAlpha = 1
    drawFeatureIcon(ctx, kind, cx, y + 1368, '#fff')
    centeredText(ctx, title, cx, y + 1488, '900 37px sans-serif', color)
    centeredText(ctx, line1, cx, y + 1560, 'bold 22px sans-serif', '#fff')
    centeredText(ctx, line2, cx, y + 1602, 'bold 22px sans-serif', '#fff')
    if (idx < 2) {
      ctx.setLineDash([5, 12])
      ctx.strokeStyle = '#d5b16b'
      ctx.beginPath()
      ctx.moveTo(cx + 195, y + 1320)
      ctx.lineTo(cx + 195, y + 1575)
      ctx.stroke()
      ctx.setLineDash([])
    }
  })
  fillRoundRect(ctx, x + 320, y + 1640, 600, 72, 0, '#e0b86d')
  centeredText(ctx, 'ご不明点はスタッフまでお声がけください', x + w / 2, y + 1676, 'bold 28px sans-serif', '#111827')
  ctx.restore()
}

function safeFileName(name) {
  return String(name || 'table').replace(/[\\/:*?"<>|]/g, '_')
}

function drawScaledPoster(ctx, drawFn, x, y, w, h, qrImage, tableName) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(w / 1240, h / 1754)
  drawFn(ctx, 0, 0, 1240, 1754, qrImage, tableName)
  ctx.restore()
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function drawTemplatePoster(ctx, templateImage, template, x, y, w, h, qrImage) {
  const { source, qrFrame, qrPadding } = template
  const scale = Math.min(w / source.w, h / source.h)
  const drawW = source.w * scale
  const drawH = source.h * scale
  const drawX = x + (w - drawW) / 2
  const drawY = y + (h - drawH) / 2

  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.clip()
  ctx.drawImage(templateImage, source.x, source.y, source.w, source.h, drawX, drawY, drawW, drawH)

  const frameX = drawX + qrFrame.x * scale
  const frameY = drawY + qrFrame.y * scale
  const frameW = qrFrame.w * scale
  const frameH = qrFrame.h * scale
  fillRoundRect(ctx, frameX, frameY, frameW, frameH, qrFrame.radius * scale, '#fff', 'rgba(0,0,0,0.18)', Math.max(1, 2 * scale))

  const padding = qrPadding * scale
  ctx.drawImage(qrImage, frameX + padding, frameY + padding, frameW - padding * 2, frameH - padding * 2)
  ctx.restore()
}

async function downloadQrPosterPdf(table, qrCanvas, baseUrl) {
  if (!qrCanvas) throw new Error('QR canvas is not ready')
  const { jsPDF } = await import('jspdf')
  const [qrImage, templateImage] = await Promise.all([
    loadImage(qrCanvas.toDataURL('image/png')),
    loadImage(QR_POSTER_TEMPLATE_SRC),
  ])
  const canvas = document.createElement('canvas')
  canvas.width = 3508
  canvas.height = 2480
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const panelW = canvas.width / 4
  const panelH = canvas.height / 2
  const designs = [
    QR_POSTER_TEMPLATES.b,
    QR_POSTER_TEMPLATES.d,
    QR_POSTER_TEMPLATES.b,
    QR_POSTER_TEMPLATES.d,
    QR_POSTER_TEMPLATES.b,
    QR_POSTER_TEMPLATES.d,
    QR_POSTER_TEMPLATES.b,
    QR_POSTER_TEMPLATES.d,
  ]
  designs.forEach((template, idx) => {
    const col = idx % 4
    const row = Math.floor(idx / 4)
    drawTemplatePoster(ctx, templateImage, template, col * panelW, row * panelH, panelW, panelH, qrImage)
  })

  ctx.strokeStyle = '#d1d5db'
  ctx.lineWidth = 2
  ctx.setLineDash([18, 14])
  ctx.beginPath()
  for (let col = 1; col < 4; col += 1) {
    ctx.moveTo(col * panelW, 0)
    ctx.lineTo(col * panelW, canvas.height)
  }
  ctx.moveTo(0, panelH)
  ctx.lineTo(canvas.width, panelH)
  ctx.stroke()
  ctx.setLineDash([])

  ctx.font = '24px sans-serif'
  ctx.fillStyle = '#9ca3af'
  ctx.textAlign = 'left'
  ctx.fillText(`${baseUrl}/order/${table.qrToken}`, 70, 2440)

  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true })
  pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 297, 210)
  pdf.save(`QR_${safeFileName(table.tableName)}_A7_8面.pdf`)
}

export default function TablePage() {
  const { storeId } = useStore()
  const [tables, setTables] = useState([])
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [qrTarget, setQrTarget] = useState(null)
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [editingTableId, setEditingTableId] = useState(null)
  const [editingTableName, setEditingTableName] = useState('')
  const [savingTableName, setSavingTableName] = useState(false)
  const qrCanvasRef = useRef(null)

  useEffect(() => {
    if (!storeId) return
    const q = query(collection(db, 'tables'), where('storeId', '==', storeId))
    return onSnapshot(q, snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      data.sort((a, b) => (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0))
      setTables(data)
    })
  }, [storeId])

  async function handleAdd(e) {
    e.preventDefault()
    if (!newName.trim()) return
    setAdding(true)
    await addDoc(collection(db, 'tables'), {
      storeId,
      tableName: newName.trim(),
      qrToken: generateToken(),
      status: 'vacant',
      guestCount: 0,
      currentOrderId: null,
      startedAt: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    setNewName('')
    setAdding(false)
  }

  async function reissueQr(table) {
    if (!confirm(`「${table.tableName}」のQRを再発行しますか？\n古いQRは使えなくなります。`)) return
    await updateDoc(doc(db, 'tables', table.id), {
      qrToken: generateToken(),
      updatedAt: serverTimestamp(),
    })
    setQrTarget(null)
  }

  function startEditTableName(table) {
    setEditingTableId(table.id)
    setEditingTableName(table.tableName ?? '')
  }

  async function saveTableName(table) {
    const name = editingTableName.trim()
    if (!name || savingTableName) return
    setSavingTableName(true)
    try {
      await updateDoc(doc(db, 'tables', table.id), {
        tableName: name,
        updatedAt: serverTimestamp(),
      })
      setEditingTableId(null)
      setEditingTableName('')
    } finally {
      setSavingTableName(false)
    }
  }

  async function handleDownloadPosterPdf(table) {
    if (generatingPdf) return
    setGeneratingPdf(true)
    try {
      await downloadQrPosterPdf(table, qrCanvasRef.current, baseUrl)
    } catch (error) {
      console.error(error)
      alert('PDFの作成に失敗しました。もう一度お試しください。')
    } finally {
      setGeneratingPdf(false)
    }
  }

  const baseUrl = window.location.origin

  return (
    <div>
      <h2 style={{ fontSize: 18, marginBottom: 16 }}>席管理</h2>

      <form onSubmit={handleAdd} style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="席名（例: 1番テーブル）"
          style={{ flex: 1, padding: '8px 12px', fontSize: 15, border: '1px solid #ccc', borderRadius: 6 }}
        />
        <button
          type="submit"
          disabled={adding}
          style={{ padding: '8px 16px', background: '#222', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
        >
          追加
        </button>
      </form>

      {qrTarget && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={() => setQrTarget(null)}
        >
          <div style={{ background: '#fff', padding: 28, borderRadius: 12, textAlign: 'center', maxWidth: 360 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, marginBottom: 16 }}>{qrTarget.tableName}</h3>
            <QRCodeSVG value={`${baseUrl}/order/${qrTarget.qrToken}`} size={200} />
            <div style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
              <QRCodeCanvas ref={qrCanvasRef} value={`${baseUrl}/order/${qrTarget.qrToken}`} size={1024} includeMargin level="H" />
            </div>
            <p style={{ fontSize: 11, color: '#aaa', wordBreak: 'break-all', margin: '12px 0' }}>
              {baseUrl}/order/{qrTarget.qrToken}
            </p>
            <button
              onClick={() => handleDownloadPosterPdf(qrTarget)}
              disabled={generatingPdf}
              style={{ width: '100%', marginBottom: 10, padding: '10px 14px', fontSize: 13, background: generatingPdf ? '#999' : '#f97316', color: '#fff', border: 'none', borderRadius: 8, cursor: generatingPdf ? 'default' : 'pointer', fontWeight: 700 }}
            >
              {generatingPdf ? 'PDF作成中...' : 'A7 8面PDFをダウンロード'}
            </button>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button
                onClick={() => reissueQr(qrTarget)}
                style={{ padding: '8px 16px', fontSize: 13, border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer', background: '#fff' }}
              >
                QR再発行
              </button>
              <button
                onClick={() => setQrTarget(null)}
                style={{ padding: '8px 20px', fontSize: 13, background: '#222', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {tables.map(table => (
          <div key={table.id} style={{ background: '#fff', padding: '12px 16px', borderRadius: 8, border: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {editingTableId === table.id ? (
                <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                  <input
                    value={editingTableName}
                    onChange={e => setEditingTableName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') saveTableName(table)
                      if (e.key === 'Escape') setEditingTableId(null)
                    }}
                    autoFocus
                    style={{ flex: 1, minWidth: 0, padding: '7px 10px', fontSize: 15, border: '1px solid #aaa', borderRadius: 6 }}
                  />
                  <button
                    onClick={() => saveTableName(table)}
                    disabled={savingTableName}
                    style={{ padding: '7px 10px', fontSize: 13, border: 'none', borderRadius: 6, background: '#222', color: '#fff', cursor: savingTableName ? 'default' : 'pointer' }}
                  >
                    保存
                  </button>
                  <button
                    onClick={() => setEditingTableId(null)}
                    style={{ padding: '7px 10px', fontSize: 13, border: '1px solid #ddd', borderRadius: 6, background: '#fff', cursor: 'pointer' }}
                  >
                    戻る
                  </button>
                </div>
              ) : (
                <div style={{ fontSize: 15, fontWeight: 600 }}>{table.tableName}</div>
              )}
              <div style={{ fontSize: 13, color: table.status === 'vacant' ? '#16a34a' : '#ca8a04', marginTop: 2 }}>
                {statusLabel[table.status] ?? table.status}
                {table.guestCount > 0 && ` · ${table.guestCount}名`}
              </div>
            </div>
            {editingTableId !== table.id && (
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button
                  onClick={() => startEditTableName(table)}
                  style={{ padding: '6px 12px', fontSize: 13, border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer', background: '#fff' }}
                >
                  名前変更
                </button>
                <button
                  onClick={() => setQrTarget(table)}
                  style={{ padding: '6px 14px', fontSize: 13, border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer', background: '#fff' }}
                >
                  QR表示
                </button>
              </div>
            )}
          </div>
        ))}
        {tables.length === 0 && (
          <p style={{ color: '#999', textAlign: 'center', padding: 32 }}>席がまだありません</p>
        )}
      </div>
    </div>
  )
}
