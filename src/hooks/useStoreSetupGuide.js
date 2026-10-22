import { useEffect, useState } from 'react'
import { buildStoreSetupSteps, shouldShowStoreSetupGuide } from '../lib/storeSetup'
import { closeStoreSetupGuide, loadStoreSetupState } from '../services/storeSetupService'

// 「はじめの準備」の表示。店長・オーナーが席一覧を開いたときに1回だけ件数を読む（閉じた店では何もしない）。
export default function useStoreSetupGuide({ storeId, tableCount, enabled }) {
  const [state, setState] = useState(null)

  useEffect(() => {
    if (!enabled || !storeId) {
      setState(null)
      return undefined
    }
    let active = true
    loadStoreSetupState(storeId)
      .then(next => { if (active) setState(next) })
      .catch(() => { if (active) setState(null) })
    return () => { active = false }
  }, [enabled, storeId])

  if (!state) return { visible: false, steps: [], close: () => {} }
  const steps = buildStoreSetupSteps({ ...state, tableCount })
  return {
    visible: shouldShowStoreSetupGuide({ ...state, steps }),
    steps,
    canFinish: steps.every(step => step.optional || step.done),
    close: async () => {
      setState(prev => (prev ? { ...prev, setupGuideClosed: true } : prev))
      try {
        await closeStoreSetupGuide(storeId)
      } catch {
        // 保存できなかったら、案内を出し直す（次に開いたときと同じ状態にそろえる）。
        setState(prev => (prev ? { ...prev, setupGuideClosed: false } : prev))
      }
    },
  }
}
