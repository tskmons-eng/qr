import { useEffect, useRef } from 'react'

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

// 4桁パスの数字ボタン。最後の桁を押したら自動で確認する。パソコンのキーボードの数字も受け付ける。
export default function PasscodeKeypad({ value, length = 4, disabled = false, onChange, onComplete, onBack }) {
  // 素早く続けて押しても桁が抜けないよう、画面の更新を待たずに最新の入力を覚えておく。
  const valueRef = useRef(value)
  valueRef.current = value

  function update(next) {
    valueRef.current = next
    onChange(next)
  }

  function press(digit) {
    const current = valueRef.current
    if (disabled || current.length >= length) return
    const next = current + digit
    update(next)
    if (next.length === length) onComplete(next)
  }

  function erase() {
    if (disabled) return
    update(valueRef.current.slice(0, -1))
  }

  useEffect(() => {
    function handleKeyDown(event) {
      if (/^\d$/.test(event.key)) press(event.key)
      else if (event.key === 'Backspace') erase()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

  return (
    <div className="passcode">
      <div className="passcode__dots" aria-label={`${value.length}桁入力済み`}>
        {Array.from({ length }, (_, index) => (
          <span key={index} className={`passcode__dot${index < value.length ? ' is-on' : ''}`} />
        ))}
      </div>
      <div className="passcode__keys">
        {DIGITS.map(digit => (
          <button key={digit} type="button" onClick={() => press(digit)} disabled={disabled} className="passcode__key">
            {digit}
          </button>
        ))}
        <button type="button" onClick={onBack} className="passcode__key passcode__key--muted">戻る</button>
        <button type="button" onClick={() => press('0')} disabled={disabled} className="passcode__key">0</button>
        <button type="button" onClick={erase} disabled={disabled} className="passcode__key passcode__key--muted">消す</button>
      </div>
    </div>
  )
}
