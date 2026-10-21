import { useRef } from 'react'

const STORE_CODE_LENGTH = 6

// 店舗コードの入力（6つの枠）。最初の入室画面とスタッフを選ぶ画面で同じ部品を使う。
// 枠は見た目だけで、実際の入力は重ねた1つの入力欄で受ける（スマホのキーボードと貼り付けに対応するため）。
export default function StoreCodeEntryForm({ entry, submitLabel = '入室する', autoFocus = false }) {
  const inputRef = useRef(null)
  const characters = Array.from({ length: STORE_CODE_LENGTH }, (_, index) => entry.code[index] ?? '')
  const canSubmit = entry.code.length === STORE_CODE_LENGTH && !entry.loading

  return (
    <form className="store-code-form" onSubmit={entry.submit}>
      <label className="store-code-form__boxes" onClick={() => inputRef.current?.focus()}>
        <span className="store-code-form__sr">店舗コード（6文字）</span>
        <input
          ref={inputRef}
          value={entry.code}
          onChange={event => entry.setCode(event.target.value)}
          maxLength={STORE_CODE_LENGTH}
          autoCapitalize="characters"
          autoComplete="off"
          autoFocus={autoFocus}
          className="store-code-form__input"
        />
        {characters.map((character, index) => (
          <span
            key={index}
            className={`store-code-form__box${character ? ' is-filled' : ''}${index === entry.code.length ? ' is-next' : ''}`}
            aria-hidden="true"
          >
            {character}
          </span>
        ))}
      </label>
      <label className="store-code-form__remember">
        <input
          type="checkbox"
          checked={entry.remember}
          onChange={event => entry.setRemember(event.target.checked)}
        />
        次回から店舗コード入力を省略する
      </label>
      {entry.error && <p className="staff-auth__error" role="alert">{entry.error}</p>}
      <button type="submit" disabled={!canSubmit} className="ui-button ui-button--primary ui-button--block">
        {entry.loading ? '確認中...' : submitLabel}
      </button>
    </form>
  )
}
