import { useCallback, useEffect, useState } from 'react'
import { loadCancelPasscodeStatus, normalizeCancelPasscodeStatus } from '../services/cancelPasscodeService'

export default function useCancelPasscodeStatus(storeId) {
  const [status, setStatus] = useState(() => normalizeCancelPasscodeStatus(null))
  const [loaded, setLoaded] = useState(false)

  const reload = useCallback(async () => {
    if (!storeId) return
    try {
      setStatus(await loadCancelPasscodeStatus(storeId))
    } finally {
      setLoaded(true)
    }
  }, [storeId])

  useEffect(() => {
    reload()
  }, [reload])

  return { status, loaded, reload }
}
