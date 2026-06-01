export default function CustomerMenuHeader({ tableName }) {
  return (
    <header className="customer-menu__header">
      <div>
        <div className="customer-menu__table">{tableName}</div>
        <div className="customer-menu__title">メニュー</div>
      </div>
    </header>
  )
}
