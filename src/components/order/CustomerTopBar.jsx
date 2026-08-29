import { useState } from 'react'

export default function CustomerTopBar({ tableName, title, onCall, callDisabled = false, statusText = '' }) {
  const [panel, setPanel] = useState(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

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
          <div className="customer-top-bar__table">{tableName}</div>
          <h1 className="customer-top-bar__title">{title}</h1>
        </div>
        <div className="customer-top-bar__actions">
          {statusText && <span className="customer-top-bar__status">{statusText}</span>}
          <button
            type="button"
            className="customer-top-bar__more"
            aria-label="その他の操作"
            aria-expanded={panel !== null}
            onClick={() => setPanel('menu')}
          >
            <span aria-hidden="true">•••</span>
          </button>
        </div>
      </header>

      {panel && (
        <div className="customer-action-sheet" role="presentation" onMouseDown={event => {
          if (event.target === event.currentTarget) closePanel()
        }}>
          <section className="customer-action-sheet__panel" role="dialog" aria-modal="true" aria-label="その他の操作">
            {panel === 'menu' && (
              <>
                <div className="customer-action-sheet__handle" aria-hidden="true" />
                <div className="customer-action-sheet__title">その他の操作</div>
                <button
                  type="button"
                  className="customer-action-sheet__menu-button"
                  disabled={callDisabled}
                  onClick={() => setPanel('call')}
                >
                  <span className="customer-action-sheet__menu-icon" aria-hidden="true">呼</span>
                  <span>
                    <strong>{callDisabled ? '呼び出し送信済み' : 'スタッフを呼ぶ'}</strong>
                    <small>{callDisabled ? 'スタッフが確認しています' : 'スタッフへ呼び出し通知を送ります'}</small>
                  </span>
                </button>
                <button type="button" className="customer-action-sheet__close" onClick={closePanel}>閉じる</button>
              </>
            )}

            {panel === 'call' && (
              <>
                <div className="customer-action-sheet__confirm-icon" aria-hidden="true">呼</div>
                <div className="customer-action-sheet__title">スタッフを呼びますか？</div>
                <p className="customer-action-sheet__message">この席からスタッフへ呼び出し通知を送ります。</p>
                {error && <p className="customer-action-sheet__error" role="alert">{error}</p>}
                <div className="customer-action-sheet__buttons">
                  <button type="button" onClick={() => setPanel('menu')} disabled={sending}>戻る</button>
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
