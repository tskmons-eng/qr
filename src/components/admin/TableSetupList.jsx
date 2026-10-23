import { useState } from 'react'
import { describeTableUse } from '../../lib/adminTable'

// 席の管理の一覧（2026-10-23 席設計）。1席1行。「⋮⋮」をつまむ（指は長押し・マウスは引っぱる）と並べ替えられる。
export default function TableSetupList({ tables, touchDrag, reorderHandlers, onOpenTable }) {
  const [dragId, setDragId] = useState(null)

  return (
    <div className="table-admin__list">
      {tables.map(table => {
        const use = describeTableUse(table)
        const dropTarget = touchDrag?.type === 'table' && touchDrag.targetId === table.id && touchDrag.id !== table.id
        return (
          <div
            key={table.id}
            data-reorder-type="table"
            data-reorder-id={table.id}
            onDragOver={event => { if (dragId) event.preventDefault() }}
            onDrop={() => { if (dragId) reorderHandlers.onDrop(dragId, table.id); setDragId(null) }}
            className={`table-admin__item${dropTarget ? ' is-drop-target' : ''}${touchDrag?.id === table.id ? ' is-dragging' : ''}`}
          >
            <span
              className="table-admin__grip"
              draggable
              onDragStart={() => setDragId(table.id)}
              onDragEnd={() => setDragId(null)}
              onTouchStart={event => reorderHandlers.onTouchStart('table', table.id, event)}
              onTouchMove={event => reorderHandlers.onTouchMove('table', event)}
              onTouchEnd={event => reorderHandlers.onTouchEnd('table', event)}
              onTouchCancel={reorderHandlers.onTouchCancel}
              aria-label="つまんで並べ替え"
            >⋮⋮</span>
            <button type="button" onClick={() => onOpenTable(table)} className="table-admin__item-main">
              <b>{table.tableName}</b>
              <span className={`table-admin__use${use.vacant ? ' is-vacant' : ''}`}>{use.label}</span>
              <span className="table-admin__chev" aria-hidden="true">›</span>
            </button>
          </div>
        )
      })}
    </div>
  )
}
