import { useState } from 'react'
import {
  SOUNDS,
  loadKitchenSoundPrefs,
  loadSoundPrefs,
  playSound,
  saveKitchenSoundPrefs,
  saveSoundPrefs,
} from '../../lib/sounds'

export default function DeviceSoundSettings() {
  const [staffPrefs, setStaffPrefs] = useState(loadSoundPrefs)
  const [kitchenPrefs, setKitchenPrefs] = useState(loadKitchenSoundPrefs)

  const soundGroups = [
    {
      key: 'staff',
      title: 'スタッフ呼び出し音',
      description: 'お客様からの呼び出しや会計依頼を受けた時に、この端末で鳴る音です。',
      prefs: staffPrefs,
      onChange: setStaffPrefs,
      onSave: saveSoundPrefs,
    },
    {
      key: 'kitchen',
      title: 'キッチン通知音',
      description: 'キッチン画面で新しい未提供メニューを受けた時に、この端末で鳴る音です。',
      prefs: kitchenPrefs,
      onChange: setKitchenPrefs,
      onSave: saveKitchenSoundPrefs,
    },
  ]

  function updatePrefs(group, patch, preview = false) {
    const nextPrefs = { ...group.prefs, ...patch }
    group.onChange(nextPrefs)
    group.onSave(nextPrefs.soundId, nextPrefs.volume)
    if (preview) playSound(nextPrefs.soundId, nextPrefs.volume)
  }

  return (
    <>
      <h2 className="admin-settings__heading">呼び出し音設定</h2>
      <div className="admin-settings__panel admin-settings__sound-panel">
        <div className="admin-settings__description">
          ホールとキッチンで使う通知音を、この端末ごとに設定します。変更はすぐ保存されます。
        </div>
        <div className="admin-settings__sound-grid">
          {soundGroups.map(group => (
            <section key={group.key} className="admin-settings__sound-device">
              <div>
                <div className="admin-settings__sound-title">{group.title}</div>
                <div className="admin-settings__toggle-description">{group.description}</div>
              </div>

              <label className="admin-settings__sound-field">
                <span>通知音</span>
                <div className="admin-settings__sound-control-row">
                  <select
                    value={group.prefs.soundId}
                    onChange={event => updatePrefs(group, { soundId: event.target.value }, true)}
                    className="admin-settings__sound-select"
                  >
                    {SOUNDS.map(sound => (
                      <option key={sound.id} value={sound.id}>
                        {sound.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => playSound(group.prefs.soundId, group.prefs.volume)}
                    className="admin-settings__sound-preview"
                  >
                    試聴
                  </button>
                </div>
              </label>

              <label className="admin-settings__sound-field">
                <span>音量</span>
                <div className="admin-settings__sound-range-row">
                  <span className="admin-settings__sound-range-label">小</span>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.05"
                    value={group.prefs.volume}
                    onChange={event => updatePrefs(group, { volume: parseFloat(event.target.value) })}
                    className="admin-settings__sound-range"
                  />
                  <span className="admin-settings__sound-range-label">大</span>
                  <span className="admin-settings__sound-volume">
                    {Math.round(group.prefs.volume * 100)}%
                  </span>
                </div>
              </label>
            </section>
          ))}
        </div>
      </div>
    </>
  )
}
