import { useEffect } from 'react'

export default function SuggestionSheet({ suggestions, onAdd, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 10000)
    return () => clearTimeout(timer)
  }, [onClose])

  if (!suggestions || suggestions.length === 0) return null

  return (
    <div
      style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: '#fff', borderTop: '2px solid #f0f0f0',
        borderRadius: '16px 16px 0 0',
        padding: '16px 16px 24px',
        zIndex: 150,
        boxShadow: '0 -4px 24px rgba(0,0,0,0.10)',
        maxWidth: 600,
        margin: '0 auto',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#888' }}>これもいかがですか？</div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#bbb', lineHeight: 1, padding: '0 4px' }}>×</button>
      </div>
      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
        {suggestions.map(p => (
          <div
            key={p.id}
            style={{
              flexShrink: 0, width: 120,
              background: '#fafafa', border: '1px solid #eee',
              borderRadius: 10, overflow: 'hidden',
            }}
          >
            {p.imageUrl ? (
              <img src={p.imageUrl} alt={p.name} style={{ width: '100%', height: 72, objectFit: 'cover', display: 'block' }} />
            ) : (
              <div style={{ width: '100%', height: 72, background: '#f0f0f0' }} />
            )}
            <div style={{ padding: '8px 8px 10px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>¥{p.price.toLocaleString()}</div>
              <button
                onClick={() => onAdd(p)}
                disabled={p.isSoldOut}
                style={{
                  width: '100%', padding: '6px 0', fontSize: 13, fontWeight: 700,
                  background: p.isSoldOut ? '#f5f5f5' : '#222',
                  color: p.isSoldOut ? '#bbb' : '#fff',
                  border: 'none', borderRadius: 6,
                  cursor: p.isSoldOut ? 'default' : 'pointer',
                }}
              >
                {p.isSoldOut ? '売切' : '追加'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
