import { useEffect } from 'react'

export default function SuggestionSheet({ suggestions, onAdd, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 10000)
    return () => clearTimeout(timer)
  }, [onClose])

  if (!suggestions || suggestions.length === 0) return null

  return (
    <div className="suggestion-sheet">
      <div className="suggestion-sheet__header">
        <div className="suggestion-sheet__title">これもいかがですか？</div>
        <button type="button" onClick={onClose} className="suggestion-sheet__close">×</button>
      </div>
      <div className="suggestion-sheet__list">
        {suggestions.map(product => (
          <div key={product.id} className="suggestion-sheet__item">
            {product.imageUrl ? (
              <img src={product.imageUrl} alt={product.name} className="suggestion-sheet__image" />
            ) : (
              <div className="suggestion-sheet__image-placeholder" />
            )}
            <div className="suggestion-sheet__body">
              <div className="suggestion-sheet__name">{product.name}</div>
              <div className="suggestion-sheet__price">¥{product.price.toLocaleString()}</div>
              <button
                type="button"
                onClick={() => onAdd(product)}
                disabled={product.isSoldOut}
                className="suggestion-sheet__add"
              >
                {product.isSoldOut ? '売切' : '追加'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
