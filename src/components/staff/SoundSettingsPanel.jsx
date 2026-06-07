import { useState } from 'react'
import { loadSoundPrefs, playSound, saveSoundPrefs, SOUNDS } from '../../lib/sounds'

export default function SoundSettingsPanel({
  notificationsEnabled,
  notifStatus,
  onClose,
  onDisableNotif,
  onEnableNotif,
}) {
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
          <div className="sound-settings__label">通知</div>
          <button
            type="button"
            onClick={notifStatus === 'ok' ? onDisableNotif : onEnableNotif}
            disabled={!notificationsEnabled || notifStatus === 'loading'}
            className={`sound-settings__notif-toggle${notifStatus === 'ok' ? ' is-on' : ''}`}
          >
            {!notificationsEnabled
              ? '店舗設定で通知OFF'
              : notifStatus === 'loading'
                ? '設定中...'
                : notifStatus === 'ok'
                  ? '通知ON'
                  : '通知OFF'}
          </button>
          <div className="sound-settings__hint">
            ログアウト時はこの端末の通知登録を解除します。
          </div>
        </div>

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
