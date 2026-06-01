export function normalizeStaffCode(value) {
  return value.replace(/\D/g, '').slice(0, 4)
}

export function validateStaffMemberForm({ name, code }) {
  if (!name.trim()) return '名前を入力してください'
  if (!/^\d{4}$/.test(code)) return 'コードは4桁の数字にしてください'
  return ''
}
