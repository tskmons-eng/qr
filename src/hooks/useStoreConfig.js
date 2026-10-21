import { useEffect, useState } from 'react'
import { normalizeStoreConfig } from '../lib/settingsConfig'
import { subscribeStoreConfig } from '../services/settingsService'

// 店舗設定を変更通知で受け取る。読み込むまでは null。読めなかったときは既定値で動かす（画面を止めない）。
export default function useStoreConfig(storeId) {
  const [storeConfig, setStoreConfig] = useState(null)

  useEffect(() => {
    if (!storeId) return undefined
    return subscribeStoreConfig(storeId, setStoreConfig, () => {
      setStoreConfig(current => current ?? normalizeStoreConfig({}))
    })
  }, [storeId])

  return storeConfig
}
