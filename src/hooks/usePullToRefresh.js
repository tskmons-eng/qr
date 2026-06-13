import { useEffect, useRef, useState } from 'react'

const PULL_REFRESH_THRESHOLD = 84
const PULL_REFRESH_MAX_DISTANCE = 118
const PULL_REFRESH_SETTLE_DISTANCE = 52

function getScrollTop() {
  return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0
}

function getPullRefreshText(phase) {
  if (phase === 'ready') return '離すと更新'
  if (phase === 'refreshing') return '更新中...'
  return '下に引いて更新'
}

export function usePullToRefresh({ enabled, onRefresh }) {
  const [state, setState] = useState({ distance: 0, phase: 'idle' })
  const distanceRef = useRef(0)
  const onRefreshRef = useRef(onRefresh)
  const refreshingRef = useRef(false)
  const startYRef = useRef(0)
  const trackingRef = useRef(false)

  useEffect(() => {
    onRefreshRef.current = onRefresh
  }, [onRefresh])

  useEffect(() => {
    function setPullRefreshState(distance, phase) {
      distanceRef.current = distance
      setState(current => (
        current.distance === distance && current.phase === phase ? current : { distance, phase }
      ))
    }

    function resetPullRefresh() {
      trackingRef.current = false
      refreshingRef.current = false
      setPullRefreshState(0, 'idle')
    }

    if (!enabled) {
      resetPullRefresh()
      return undefined
    }

    function handleTouchStart(event) {
      if (event.touches.length !== 1 || refreshingRef.current || getScrollTop() > 0) {
        trackingRef.current = false
        return
      }

      startYRef.current = event.touches[0].clientY
      trackingRef.current = true
    }

    function handleTouchMove(event) {
      if (!trackingRef.current || event.touches.length !== 1) return

      const deltaY = event.touches[0].clientY - startYRef.current
      if (deltaY <= 0) {
        setPullRefreshState(0, 'idle')
        return
      }

      if (getScrollTop() > 0) {
        resetPullRefresh()
        return
      }

      if (event.cancelable) event.preventDefault()

      const distance = Math.min(PULL_REFRESH_MAX_DISTANCE, Math.round(deltaY * 0.56))
      setPullRefreshState(distance, distance >= PULL_REFRESH_THRESHOLD ? 'ready' : 'pulling')
    }

    function handleTouchEnd() {
      if (!trackingRef.current) return

      trackingRef.current = false
      if (distanceRef.current >= PULL_REFRESH_THRESHOLD) {
        refreshingRef.current = true
        setPullRefreshState(PULL_REFRESH_SETTLE_DISTANCE, 'refreshing')
        window.setTimeout(() => onRefreshRef.current?.(), 140)
        return
      }

      resetPullRefresh()
    }

    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchmove', handleTouchMove, { passive: false })
    window.addEventListener('touchend', handleTouchEnd)
    window.addEventListener('touchcancel', handleTouchEnd)
    return () => {
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleTouchEnd)
      window.removeEventListener('touchcancel', handleTouchEnd)
    }
  }, [enabled])

  const progress = Math.min(1, state.distance / PULL_REFRESH_THRESHOLD)

  return {
    className: state.phase === 'idle' ? '' : `is-pull-refresh-${state.phase}`,
    phase: state.phase,
    style: {
      '--staff-pull-offset': `${Math.min(state.distance, 64)}px`,
      '--staff-pull-indicator-y': `${Math.min(18, Math.round(state.distance * 0.18))}px`,
      '--staff-pull-opacity': String(Math.min(1, 0.28 + progress * 0.72)),
      '--staff-pull-rotation': `${Math.round(progress * 300)}deg`,
    },
    text: getPullRefreshText(state.phase),
  }
}
