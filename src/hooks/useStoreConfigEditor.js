import { useEffect, useRef, useState } from 'react'
import { saveStoreConfigPatch } from '../services/settingsService'
import useStoreConfig from './useStoreConfig'

const SAVED_MESSAGE_MS = 2000

// 設定画面の「押したら保存」。押した値をすぐ画面に出して保存し、失敗したら元の値に戻して知らせる。
export default function useStoreConfigEditor(storeId) {
  const storeConfig = useStoreConfig(storeId)
  const [pendingPatch, setPendingPatch] = useState({})
  const [statuses, setStatuses] = useState({})
  const timersRef = useRef({})

  useEffect(() => () => Object.values(timersRef.current).forEach(clearTimeout), [])

  function setStatus(statusKey, status) {
    clearTimeout(timersRef.current[statusKey])
    setStatuses(previous => ({ ...previous, [statusKey]: status }))
    if (status === 'saved') {
      timersRef.current[statusKey] = setTimeout(() => {
        setStatuses(previous => ({ ...previous, [statusKey]: null }))
      }, SAVED_MESSAGE_MS)
    }
  }

  async function save(statusKey, patch) {
    setPendingPatch(previous => ({ ...previous, ...patch }))
    setStatus(statusKey, 'saving')
    try {
      await saveStoreConfigPatch(storeId, patch)
      setStatus(statusKey, 'saved')
    } catch {
      setStatus(statusKey, 'error')
    } finally {
      // 保存できた値は変更通知で届き、失敗した値はここで外れて元に戻る。
      setPendingPatch(previous => {
        const next = { ...previous }
        // 後から同じ項目をもう一度保存中なら、その値は残す。
        Object.keys(patch).forEach(key => {
          if (next[key] === patch[key]) delete next[key]
        })
        return next
      })
    }
  }

  return {
    config: storeConfig ? { ...storeConfig, ...pendingPatch } : null,
    statuses,
    save,
  }
}
