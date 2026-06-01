import { useState } from 'react'
import { SOUNDS, loadKitchenSoundPrefs, playSound, saveKitchenSoundPrefs } from '../../lib/sounds'

export default function KitchenSoundPanel({ onClose }) {
  const [prefs, setPrefs] = useState(loadKitchenSoundPrefs)

  function handleSoundChange(soundId) {
    const next = { ...prefs, soundId }
    setPrefs(next)
    saveKitchenSoundPrefs(next.soundId, next.volume)
    playSound(soundId, next.volume)
  }

  function handleVolumeChange(volume) {
    const next = { ...prefs, volume }
    setPrefs(next)
    saveKitchenSoundPrefs(next.soundId, next.volume)
  }

  return (
    <div className="kitchen-sound-overlay" onClick={onClose}>
      <div className="kitchen-sound-panel" onClick={e => e.stopPropagation()}>
        <div className="kitchen-sound-panel__title">通知音設定（キッチン）</div>
        <div className="kitchen-sound-panel__section">
          <div className="kitchen-sound-panel__label">音量</div>
          <div className="kitchen-sound-panel__volume">
            <span>小</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.05"
              value={prefs.volume}
              onChange={e => handleVolumeChange(parseFloat(e.target.value))}
            />
            <span>大</span>
          </div>
          <div className="kitchen-sound-panel__volume-value">
            {Math.round(prefs.volume * 100)}%
          </div>
        </div>

        <div className="kitchen-sound-panel__label">通知音を選択</div>
        <div className="kitchen-sound-panel__options">
          {SOUNDS.map(sound => (
            <button
              key={sound.id}
              type="button"
              className={`kitchen-sound-panel__option${prefs.soundId === sound.id ? ' is-active' : ''}`}
              onClick={() => handleSoundChange(sound.id)}
            >
              <span>{sound.label}</span>
              <span className="kitchen-sound-panel__preview">再生</span>
            </button>
          ))}
        </div>
        <button type="button" className="kitchen-sound-panel__close" onClick={onClose}>
          閉じる
        </button>
      </div>
    </div>
  )
}
