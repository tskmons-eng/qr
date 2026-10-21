const { randomBytes, scryptSync, timingSafeEqual } = require('node:crypto')

// 店の取消パスコードとスタッフの4桁パスで共通の、ハッシュと「続けて間違えたらロック」の部品。
// パスそのものは保存しない。照合は Functions の中だけで行う。
const HASH_BYTES = 32
const MAX_FAILED_ATTEMPTS = 5
const LOCK_MS = 10 * 60 * 1000

function hashPasscode(passcode, salt) {
  return scryptSync(String(passcode), salt, HASH_BYTES).toString('hex')
}

function createPasscodeHash(passcode) {
  const salt = randomBytes(16).toString('hex')
  return { hash: hashPasscode(passcode, salt), salt }
}

function passcodeMatches(passcode, hash, salt, pattern) {
  if (!hash || !salt) return false
  if (typeof passcode !== 'string' || !pattern.test(passcode)) return false
  const expected = Buffer.from(hash, 'hex')
  const actual = Buffer.from(hashPasscode(passcode, salt), 'hex')
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

// 1回の入力の結果と、秘密の記録へ書く更新を返す。書き込みは呼び出し側のトランザクションで行う。
// failure は null（合っている）・'invalid'（違う）・'locked'（ロック中、または今回でロック）。
function evaluatePasscodeAttempt(secret, matches, nowMs = Date.now()) {
  if ((secret?.lockedUntilMs ?? 0) > nowMs) return { failure: 'locked', updates: null }
  if (matches) {
    const needsReset = Boolean(secret?.failedAttempts || secret?.lockedUntilMs)
    return { failure: null, updates: needsReset ? { failedAttempts: 0, lockedUntilMs: 0 } : null }
  }
  const failedAttempts = (secret?.failedAttempts ?? 0) + 1
  if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
    return { failure: 'locked', updates: { failedAttempts: 0, lockedUntilMs: nowMs + LOCK_MS } }
  }
  return { failure: 'invalid', updates: { failedAttempts } }
}

module.exports = {
  LOCK_MS,
  MAX_FAILED_ATTEMPTS,
  createPasscodeHash,
  evaluatePasscodeAttempt,
  hashPasscode,
  passcodeMatches,
}
