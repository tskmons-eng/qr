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

const A4_LANDSCAPE_PX = { width: 3508, height: 2480 }
const PANELS_PER_ROW = 4
const PANEL_ROWS = 2
const PDF_SIZE_MM = { width: 297, height: 210 }

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
  if (!stroke) return
  ctx.strokeStyle = stroke
  ctx.lineWidth = lineWidth
  ctx.stroke()
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function safeFileName(name) {
  return String(name || 'table').replace(/[\\/:*?"<>|]/g, '_')
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

function drawCutGuides(ctx, panelW, panelH) {
  ctx.strokeStyle = '#d1d5db'
  ctx.lineWidth = 2
  ctx.setLineDash([18, 14])
  ctx.beginPath()
  for (let col = 1; col < PANELS_PER_ROW; col += 1) {
    ctx.moveTo(col * panelW, 0)
    ctx.lineTo(col * panelW, A4_LANDSCAPE_PX.height)
  }
  for (let row = 1; row < PANEL_ROWS; row += 1) {
    ctx.moveTo(0, row * panelH)
    ctx.lineTo(A4_LANDSCAPE_PX.width, row * panelH)
  }
  ctx.stroke()
  ctx.setLineDash([])
}

async function createQrPosterCanvas(table, qrCanvas, baseUrl) {
  if (!qrCanvas) throw new Error('QR canvas is not ready')

  const [qrImage, templateImage] = await Promise.all([
    loadImage(qrCanvas.toDataURL('image/png')),
    loadImage(QR_POSTER_TEMPLATE_SRC),
  ])

  const canvas = document.createElement('canvas')
  canvas.width = A4_LANDSCAPE_PX.width
  canvas.height = A4_LANDSCAPE_PX.height

  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const panelW = canvas.width / PANELS_PER_ROW
  const panelH = canvas.height / PANEL_ROWS
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
    const col = idx % PANELS_PER_ROW
    const row = Math.floor(idx / PANELS_PER_ROW)
    drawTemplatePoster(ctx, templateImage, template, col * panelW, row * panelH, panelW, panelH, qrImage)
  })

  drawCutGuides(ctx, panelW, panelH)

  ctx.font = '24px sans-serif'
  ctx.fillStyle = '#9ca3af'
  ctx.textAlign = 'left'
  ctx.fillText(`${baseUrl}/order/${table.qrToken}`, 70, 2440)

  return canvas
}

// 全部の席のQRをまとめて印刷（2026-10-28 QR 第1章）。A4横に8席分。台紙は白い方（デザインB）。
// 席ごとに違うQRを入れ、台紙の下の帯に席名を大きく入れる（どの机に置くか分かるように）。席の並び順のとおりに並べる。
const BULK_NAME_BAND = { x: 2, y: 947, w: 642, h: 77 }

function drawBulkCard(ctx, templateImage, x, y, w, h, qrImage, tableName) {
  const template = QR_POSTER_TEMPLATES.b
  drawTemplatePoster(ctx, templateImage, template, x, y, w, h, qrImage)
  const { source } = template
  const scale = Math.min(w / source.w, h / source.h)
  const drawX = x + (w - source.w * scale) / 2
  const drawY = y + (h - source.h * scale) / 2
  const band = {
    x: drawX + BULK_NAME_BAND.x * scale,
    y: drawY + BULK_NAME_BAND.y * scale,
    w: BULK_NAME_BAND.w * scale,
    h: BULK_NAME_BAND.h * scale,
  }
  ctx.save()
  ctx.fillStyle = '#0d1424'
  ctx.fillRect(band.x, band.y, band.w, band.h)
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  let fontSize = Math.round(band.h * 0.56)
  ctx.font = `900 ${fontSize}px "M PLUS Rounded 1c", sans-serif`
  while (fontSize > 18 && ctx.measureText(tableName).width > band.w * 0.9) {
    fontSize -= 2
    ctx.font = `900 ${fontSize}px "M PLUS Rounded 1c", sans-serif`
  }
  ctx.fillText(tableName, band.x + band.w / 2, band.y + band.h / 2)
  ctx.restore()
}

export const BULK_CARDS_PER_PAGE = PANELS_PER_ROW * PANEL_ROWS

// entries：[{ table, qrCanvas }]（席の並び順）。8席ずつ1枚にして、全部を1つのPDFにする。
export async function downloadAllTablesQrPdf(entries, storeName = '') {
  if (entries.length === 0) throw new Error('No tables to print')
  const { jsPDF } = await import('jspdf')
  const templateImage = await loadImage(QR_POSTER_TEMPLATE_SRC)
  // 席が多くてもスマホのメモリーが足りなくならないよう、QRの画像は1枚（8席）ずつ読む。
  const loadPageQrImages = pageEntries => Promise.all(pageEntries.map(({ qrCanvas }) => {
    if (!qrCanvas) throw new Error('QR canvas is not ready')
    return loadImage(qrCanvas.toDataURL('image/png'))
  }))
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true })
  const pageCount = Math.ceil(entries.length / BULK_CARDS_PER_PAGE)
  for (let page = 0; page < pageCount; page += 1) {
    const canvas = document.createElement('canvas')
    canvas.width = A4_LANDSCAPE_PX.width
    canvas.height = A4_LANDSCAPE_PX.height
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    const panelW = canvas.width / PANELS_PER_ROW
    const panelH = (canvas.height - 40) / PANEL_ROWS
    const pageEntries = entries.slice(page * BULK_CARDS_PER_PAGE, (page + 1) * BULK_CARDS_PER_PAGE)
    const qrImages = await loadPageQrImages(pageEntries)
    pageEntries.forEach(({ table }, idx) => {
      const col = idx % PANELS_PER_ROW
      const row = Math.floor(idx / PANELS_PER_ROW)
      drawBulkCard(ctx, templateImage, col * panelW, row * panelH, panelW, panelH, qrImages[idx], table.tableName ?? '')
    })
    ctx.strokeStyle = '#d1d5db'
    ctx.lineWidth = 2
    ctx.setLineDash([18, 14])
    ctx.beginPath()
    for (let col = 1; col < PANELS_PER_ROW; col += 1) {
      ctx.moveTo(col * panelW, 0)
      ctx.lineTo(col * panelW, panelH * PANEL_ROWS)
    }
    ctx.moveTo(0, panelH)
    ctx.lineTo(canvas.width, panelH)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.font = '26px sans-serif'
    ctx.fillStyle = '#9ca3af'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    ctx.fillText(`${storeName ? `${storeName}　` : ''}${page + 1} / ${pageCount} 枚目　点線で切って、それぞれの席に置いてください`, 40, canvas.height - 12)
    if (page > 0) pdf.addPage('a4', 'landscape')
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, PDF_SIZE_MM.width, PDF_SIZE_MM.height)
  }
  pdf.save(`QR_全席_${entries.length}席.pdf`)
}

export async function downloadQrPosterPdf(table, qrCanvas, baseUrl) {
  const { jsPDF } = await import('jspdf')
  const canvas = await createQrPosterCanvas(table, qrCanvas, baseUrl)
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true })
  pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, PDF_SIZE_MM.width, PDF_SIZE_MM.height)
  pdf.save(`QR_${safeFileName(table.tableName)}_A7_8面.pdf`)
}
