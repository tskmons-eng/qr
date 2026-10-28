import { useState } from 'react'
import { useOrder } from '../../contexts/OrderContext'

// お客様の画面の上の帯（2026-10-28 注文の流れ 第2章で白い帯に）。席名と人数を上に、右に「店員を呼ぶ」。
// 押し間違いで呼ばないよう、呼ぶ前に1回確かめる。
export default function CustomerTopBar({ tableName, title, onCall, callDisabled = false, statusText = '' }) {
  const { table } = useOrder() ?? {}
  const [panel, setPanel] = useState(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const guestCount = Number(table?.guestCount) || 0
  const placeText = [tableName, guestCount > 0 ? `${guestCount}名` : ''].filter(Boolean).join('・')

  function closePanel() {
    if (sending) return
    setPanel(null)
    setError('')
  }

  async function confirmCall() {
    if (!onCall || callDisabled || sending) return
    setSending(true)
    setError('')
    try {
      await onCall()
      setPanel('sent')
    } catch {
      setError('呼び出しを送信できませんでした。通信を確認して、もう一度お試しください。')
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <header className="customer-top-bar">
        <div className="customer-top-bar__heading">
          <div className="customer-top-bar__table">{placeText}</div>
          <h1 className="customer-top-bar__title">{title}</h1>
        </div>
        <div className="customer-top-bar__actions">
          {statusText && <span className="customer-top-bar__status">{statusText}</span>}
          <button
            type="button"
            className="customer-top-bar__call"
            disabled={callDisabled}
            aria-expanded={panel !== null}
            onClick={() => setPanel('call')}
          >
            {callDisabled ? '呼び出し済み' : '店員を呼ぶ'}
          </button>
        </div>
      </header>

      {panel && (
        <div className="customer-action-sheet" role="presentation" onMouseDown={event => {
          if (event.target === event.currentTarget) closePanel()
        }}>
          <section className="customer-action-sheet__panel" role="dialog" aria-modal="true" aria-label="スタッフを呼ぶ">
            {panel === 'call' && (
              <>
                <div className="customer-action-sheet__confirm-icon" aria-hidden="true">呼</div>
                <div className="customer-action-sheet__title">スタッフを呼びますか？</div>
                <p className="customer-action-sheet__message">この席からスタッフへ呼び出し通知を送ります。</p>
                {error && <p className="customer-action-sheet__error" role="alert">{error}</p>}
                <div className="customer-action-sheet__buttons">
                  <button type="button" onClick={closePanel} disabled={sending}>やめる</button>
                  <button type="button" className="is-primary" onClick={confirmCall} disabled={sending}>
                    {sending ? '送信中...' : '呼び出す'}
                  </button>
                </div>
              </>
            )}

            {panel === 'sent' && (
              <>
                <div className="customer-action-sheet__confirm-icon is-sent" aria-hidden="true">✓</div>
                <div className="customer-action-sheet__title">呼び出しました</div>
                <p className="customer-action-sheet__message">スタッフが確認しています。そのままお待ちください。</p>
                <button type="button" className="customer-action-sheet__done" onClick={closePanel}>閉じる</button>
              </>
            )}
          </section>
        </div>
      )}
    </>
  )
}
