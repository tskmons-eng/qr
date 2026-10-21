// スーパー管理者のメール。firestore.rules と functions/orderCommandAuth.js にも同じ値がある（一致はチェックで確かめる）。
export const OWNER_EMAIL = 'tsk.mons@gmail.com'

// メールは大文字・小文字を区別しない（2026-10-22 L6）。
export function isSuperAdminEmail(email) {
  return String(email ?? '').trim().toLowerCase() === OWNER_EMAIL
}
