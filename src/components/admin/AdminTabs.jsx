export default function AdminTabs({ tabs, current, onSelect }) {
  return (
    <div className="admin-tabs">
      {tabs.map(tab => (
        <button
          key={tab.key}
          type="button"
          className={`admin-tab${current === tab.key ? ' is-active' : ''}`}
          onClick={() => onSelect(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
