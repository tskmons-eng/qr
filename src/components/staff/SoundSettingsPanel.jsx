import { useState } from 'react'
import { loadSoundPrefs, playSound, saveSoundPrefs, SOUNDS } from '../../lib/sounds'

export default function SoundSettingsPanel({ onClose }) {
  const [prefs, setPrefs] = useState(loadSoundPrefs)

  function handleSoundChange(soundId) {
    const next = { ...prefs, soundId }
    setPrefs(next)
    saveSoundPrefs(next.soundId, next.volume)
    playSound(soundId, next.volume)
  }

  function handleVolumeChange(volume) {
    const next = { ...prefs, volume }
    setPrefs(next)
    saveSoundPrefs(next.soundId, next.volume)
  }

  return (
    <div className="sound-settings" onClick={onClose}>
      <div className="sound-settings__panel" onClick={event => event.stopPropagation()}>
        <div className="sound-settings__title">通知音設定</div>

        <div className="sound-settings__section">
          <div className="sound-settings__label">音量</div>
          <div className="sound-settings__range-row">
            <span className="sound-settings__volume-icon">🔈</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.05"
              value={prefs.volume}
              onChange={event => handleVolumeChange(parseFloat(event.target.value))}
              className="sound-settings__range"
            />
            <span className="sound-settings__volume-icon">🔊</span>
          </div>
          <div className="sound-settings__volume-value">{Math.round(prefs.volume * 100)}%</div>
        </div>

        <div>
          <div className="sound-settings__label">通知音を選択</div>
          <div className="sound-settings__options">
            {SOUNDS.map(sound => (
              <button
                type="button"
                key={sound.id}
                onClick={() => handleSoundChange(sound.id)}
                className={`sound-settings__option${prefs.soundId === sound.id ? ' is-active' : ''}`}
              >
                <span>{sound.label}</span>
                <span className="sound-settings__preview">▶ 試聴</span>
              </button>
            ))}
          </div>
        </div>

        <button type="button" onClick={onClose} className="sound-settings__close">
          閉じる
        </button>
      </div>
    </div>
  )
}
