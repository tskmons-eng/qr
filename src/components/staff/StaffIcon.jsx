// スタッフ画面で使う線のアイコン。色は文字の色（currentColor）に合わせる。
const ICON_PATHS = {
  grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  cash: 'M3 7h18v10H3zM7 12h.01M17 12h.01M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  seat: 'M4 10h16M6 10v9M18 10v9M8 6h8',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  menu: 'M6 3v8a2 2 0 0 0 4 0V3M8 11v10M16 3c-2 2-2 6 0 8v10',
  log: 'M6 3h9l3 3v15H6zM9 9h6M9 13h6M9 17h4',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a7 7 0 0 0-.1-1l2-1.6-2-3.4-2.4 1a7 7 0 0 0-1.7-1L14.5 3h-5l-.3 3a7 7 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6a7 7 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 1.7 1l.3 3h5l.3-3a7 7 0 0 0 1.7-1l2.4 1 2-3.4-2-1.6c.1-.3.1-.7.1-1z',
  people: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M17 11a3 3 0 1 0 0-6M22 21a6 6 0 0 0-4-5.6',
  kitchen: 'M5 11h14v8a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2zM3 11h18M9 7c0-2 6-2 6 0',
}

export default function StaffIcon({ name }) {
  const path = ICON_PATHS[name]
  if (!path) return null
  return (
    <svg className="staff-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={path} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
