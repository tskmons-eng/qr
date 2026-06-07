export const OWNER_EMAIL = 'tsk.mons@gmail.com'

export function isSuperAdminEmail(email) {
  return email === OWNER_EMAIL
}
