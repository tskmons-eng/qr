// 商品のまとめて登録（2026-11-02）。表計算で作った CSV（分類・商品名・値段）から、登録する中身を組み立てる。
// 写真・選ぶもの・割引は CSV では入れない（1品ずつ直す）。同じ分類に同じ名前の商品があれば飛ばす（2重登録を防ぐ）。
export const MAX_IMPORT_ROWS = 300

export const SAMPLE_CSV = '分類,商品名,値段\nビール,生ビール（中）,550\nビール,瓶ビール,650\n焼き鳥,もも（塩）,180\n'

const HEADER_ALIASES = {
  category: ['分類', 'カテゴリ', 'カテゴリー'],
  name: ['商品名', '名前', '品名'],
  price: ['値段', '価格', '金額', '税込'],
}

// Excel で保存した CSV は Shift_JIS のことが多い。UTF-8 として読めなければ Shift_JIS で読む。
export function decodeCsvBytes(buffer) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer).replace(/^\uFEFF/, '')
  } catch {
    return new TextDecoder('shift_jis').decode(buffer)
  }
}

// 「"」で囲んだ欄（中にカンマ・改行・""）も読む。
export function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { field += '"'; index += 1 }
      else if (char === '"') quoted = false
      else field += char
    } else if (char === '"') quoted = true
    else if (char === ',' || char === '\t') { row.push(field); field = '' }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index += 1
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += char
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter(cells => cells.some(cell => cell.trim() !== ''))
}

function findColumns(header) {
  const cells = header.map(cell => cell.trim())
  const columns = {}
  for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
    const index = cells.findIndex(cell => aliases.some(alias => cell.includes(alias)))
    if (index < 0) return null
    columns[key] = index
  }
  return columns
}

function toPrice(value) {
  const text = String(value ?? '').normalize('NFKC').replace(/[¥,円\s]/g, '')
  return /^\d+$/.test(text) ? Number(text) : null
}

// 全角・半角などの書き方の違いは同じ名前として扱う。
export function categoryKey(name) {
  return String(name ?? '').trim().normalize('NFKC')
}

function sameName(a, b) {
  return categoryKey(a) === categoryKey(b)
}

// 1行ずつ「登録する／飛ばす／直してください」を決める。1行目が見出しなら列の並びは見出しで決め、無ければ 分類・商品名・値段 の順。
export function planProductImport({ text, products = [], categories = [] }) {
  const rows = parseCsv(text)
  if (rows.length === 0) return { error: '中身が空です。分類・商品名・値段の3列で作ってください', rows: [] }
  const headerColumns = findColumns(rows[0])
  const columns = headerColumns ?? { category: 0, name: 1, price: 2 }
  // 列が多い行は、値段の「1,200」が2つの欄に割れたなどの読み違いなので登録しない。
  const columnCount = Math.max(...Object.values(columns)) + 1
  const dataRows = (headerColumns ? rows.slice(1) : rows).map((cells, index) => ({ cells, line: index + (headerColumns ? 2 : 1) }))
  if (dataRows.length === 0) return { error: '商品の行がありません', rows: [] }
  if (dataRows.length > MAX_IMPORT_ROWS) return { error: `一度に登録できるのは${MAX_IMPORT_ROWS}品までです。ファイルを分けてください`, rows: [] }

  const seen = []
  const planned = dataRows.map(({ cells, line }) => {
    const categoryName = String(cells[columns.category] ?? '').trim()
    const name = String(cells[columns.name] ?? '').trim()
    const priceText = String(cells[columns.price] ?? '').trim()
    const price = toPrice(priceText)
    const category = categories.find(item => sameName(item.name, categoryName)) ?? null
    const base = { line, categoryName, name, price, priceText, categoryId: category?.id ?? null, isNewCategory: Boolean(categoryName) && !category }
    if (cells.slice(columnCount).some(cell => cell.trim() !== '')) {
      return { ...base, status: 'error', message: '列が多すぎます。値段の「,」を外すか、欄を「"」で囲んでください' }
    }
    if (!categoryName) return { ...base, status: 'error', message: '分類が空です' }
    if (!name) return { ...base, status: 'error', message: '商品名が空です' }
    if (price === null) return { ...base, status: 'error', message: '値段は数字で入れてください' }
    if (category && products.some(product => product.categoryId === category.id && sameName(product.name, name))) {
      return { ...base, status: 'skip', message: 'もう登録があります' }
    }
    if (seen.some(item => sameName(item.categoryName, categoryName) && sameName(item.name, name))) {
      return { ...base, status: 'skip', message: 'ファイルの中で2回目です' }
    }
    seen.push({ categoryName, name })
    return { ...base, status: 'add', message: '' }
  })

  const newCategoryNames = []
  planned.forEach(row => {
    if (row.status === 'add' && row.isNewCategory && !newCategoryNames.some(name => sameName(name, row.categoryName))) {
      newCategoryNames.push(row.categoryName)
    }
  })
  return { error: '', rows: planned, newCategoryNames }
}
