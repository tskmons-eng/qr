import { useCallback, useRef, useState } from 'react'

export default function useTouchReorder(onReorder) {
  const [touchDrag, setTouchDrag] = useState(null)
  const touchDragRef = useRef(null)
  const touchTimerRef = useRef(null)
  const touchStartPointRef = useRef(null)

  const startTouchReorder = useCallback((type, id, event) => {
    clearTimeout(touchTimerRef.current)
    const touch = event.touches?.[0]
    touchStartPointRef.current = touch ? { x: touch.clientX, y: touch.clientY } : null
    touchTimerRef.current = setTimeout(() => {
      const next = { type, id, targetId: null }
      touchDragRef.current = next
      setTouchDrag(next)
      navigator.vibrate?.(12)
    }, 350)
  }, [])

  const updateTouchReorderTarget = useCallback((type, touch) => {
    const state = touchDragRef.current
    if (!state || state.type !== type || !touch) return
    const el = document
      .elementFromPoint(touch.clientX, touch.clientY)
      ?.closest(`[data-reorder-type="${type}"]`)
    const targetId = el?.dataset.reorderId ?? null
    if (targetId !== state.targetId) {
      const next = { ...state, targetId }
      touchDragRef.current = next
      setTouchDrag(next)
    }
  }, [])

  const moveTouchReorder = useCallback((type, event) => {
    if (!touchDragRef.current) {
      const start = touchStartPointRef.current
      const touch = event.touches?.[0]
      if (start && touch && Math.hypot(touch.clientX - start.x, touch.clientY - start.y) > 12) {
        clearTimeout(touchTimerRef.current)
        touchStartPointRef.current = null
      }
      return
    }
    event.preventDefault()
    updateTouchReorderTarget(type, event.touches?.[0])
  }, [updateTouchReorderTarget])

  const finishTouchReorder = useCallback(async (type, event) => {
    clearTimeout(touchTimerRef.current)
    const state = touchDragRef.current
    if (state) event.preventDefault()
    updateTouchReorderTarget(type, event.changedTouches?.[0])
    const latest = touchDragRef.current ?? state
    touchDragRef.current = null
    touchStartPointRef.current = null
    setTouchDrag(null)
    if (!latest || latest.type !== type || !latest.targetId || latest.targetId === latest.id) return
    await onReorder(type, latest.id, latest.targetId)
  }, [onReorder, updateTouchReorderTarget])

  const cancelTouchReorder = useCallback(() => {
    clearTimeout(touchTimerRef.current)
    touchDragRef.current = null
    touchStartPointRef.current = null
    setTouchDrag(null)
  }, [])

  return {
    touchDrag,
    startTouchReorder,
    moveTouchReorder,
    finishTouchReorder,
    cancelTouchReorder,
  }
}
