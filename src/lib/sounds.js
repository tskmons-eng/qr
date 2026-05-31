let ctx = null
function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)()
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function beep(freq, start, duration, vol, type = 'sine') {
  const c = getCtx()
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.connect(gain)
  gain.connect(c.destination)
  osc.type = type
  osc.frequency.value = freq
  gain.gain.setValueAtTime(vol, c.currentTime + start)
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + start + duration)
  osc.start(c.currentTime + start)
  osc.stop(c.currentTime + start + duration + 0.05)
}

export const SOUNDS = [
  {
    id: 'pip',
    label: 'ピッ（短音）',
    play: (vol) => {
      beep(880, 0, 0.15, vol)
    },
  },
  {
    id: 'pip2',
    label: 'ピッピッ（2回）',
    play: (vol) => {
      beep(880, 0, 0.12, vol)
      beep(880, 0.2, 0.12, vol)
    },
  },
  {
    id: 'pip3',
    label: 'ピピピ（3連）',
    play: (vol) => {
      beep(1000, 0, 0.1, vol)
      beep(1000, 0.15, 0.1, vol)
      beep(1000, 0.3, 0.1, vol)
    },
  },
  {
    id: 'chime',
    label: 'チャイム（昇順）',
    play: (vol) => {
      beep(523, 0, 0.25, vol)
      beep(659, 0.25, 0.25, vol)
      beep(784, 0.5, 0.4, vol)
    },
  },
  {
    id: 'dong',
    label: 'ポーン（低音）',
    play: (vol) => {
      beep(440, 0, 0.6, vol, 'triangle')
      beep(220, 0, 0.6, vol * 0.3, 'sine')
    },
  },
  {
    id: 'bell',
    label: 'ベル（高音）',
    play: (vol) => {
      beep(1318, 0, 0.05, vol)
      beep(1318, 0.08, 0.05, vol * 0.7)
      beep(987, 0.18, 0.4, vol * 0.8)
    },
  },
  {
    id: 'melody',
    label: 'メロディー（長め）',
    play: (vol) => {
      beep(523, 0, 0.28, vol)
      beep(659, 0.32, 0.28, vol)
      beep(784, 0.64, 0.28, vol)
      beep(1047, 0.96, 0.55, vol)
    },
  },
  {
    id: 'melody_long',
    label: 'メロディー（さらに長め）',
    play: (vol) => {
      beep(523, 0, 0.3, vol)
      beep(659, 0.38, 0.3, vol)
      beep(784, 0.76, 0.35, vol)
      beep(1047, 1.18, 0.55, vol)
      beep(784, 1.9, 0.35, vol * 0.9)
      beep(1047, 2.32, 0.75, vol)
    },
  },
  {
    id: 'fanfare',
    label: 'ファンファーレ',
    play: (vol) => {
      beep(659, 0, 0.18, vol)
      beep(784, 0.22, 0.18, vol)
      beep(988, 0.44, 0.3, vol)
      beep(784, 0.8, 0.18, vol)
      beep(1047, 1.02, 0.55, vol)
    },
  },
  {
    id: 'fanfare_long',
    label: 'ファンファーレ（長め）',
    play: (vol) => {
      beep(659, 0, 0.18, vol)
      beep(784, 0.22, 0.18, vol)
      beep(988, 0.44, 0.34, vol)
      beep(784, 0.92, 0.18, vol * 0.9)
      beep(988, 1.14, 0.22, vol)
      beep(1175, 1.42, 0.42, vol)
      beep(988, 2.1, 0.25, vol * 0.85)
      beep(1175, 2.42, 0.25, vol)
      beep(1318, 2.78, 0.8, vol)
    },
  },
  {
    id: 'alert_loop',
    label: '呼び出しベル（長め）',
    play: (vol) => {
      ;[0, 0.65, 1.3, 2.15, 2.8, 3.45].forEach(start => {
        beep(1175, start, 0.16, vol, 'square')
        beep(880, start + 0.2, 0.22, vol * 0.85, 'triangle')
      })
    },
  },
  {
    id: 'twotone',
    label: 'ピンポン（2音）',
    play: (vol) => {
      beep(880, 0, 0.3, vol, 'triangle')
      beep(660, 0.4, 0.45, vol, 'triangle')
    },
  },
]

export function playSound(soundId, volume) {
  const sound = SOUNDS.find(s => s.id === soundId) ?? SOUNDS[0]
  sound.play(volume)
}

export function loadSoundPrefs() {
  return {
    soundId: localStorage.getItem('notifSound') ?? 'pip2',
    volume: parseFloat(localStorage.getItem('notifVolume') ?? '1.0'),
  }
}

export function saveSoundPrefs(soundId, volume) {
  localStorage.setItem('notifSound', soundId)
  localStorage.setItem('notifVolume', String(volume))
}

export function loadKitchenSoundPrefs() {
  return {
    soundId: localStorage.getItem('kitchenSound') ?? 'chime',
    volume: parseFloat(localStorage.getItem('kitchenVolume') ?? '1.0'),
  }
}

export function saveKitchenSoundPrefs(soundId, volume) {
  localStorage.setItem('kitchenSound', soundId)
  localStorage.setItem('kitchenVolume', String(volume))
}
