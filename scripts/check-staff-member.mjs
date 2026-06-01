import assert from 'node:assert/strict'
import { normalizeStaffCode, validateStaffMemberForm } from '../src/lib/staffMember.js'

assert.equal(normalizeStaffCode('12ab345'), '1234')
assert.equal(normalizeStaffCode('９９９９'), '')

assert.equal(validateStaffMemberForm({ name: '', code: '1234' }), '名前を入力してください')
assert.equal(validateStaffMemberForm({ name: 'Staff', code: '12' }), 'コードは4桁の数字にしてください')
assert.equal(validateStaffMemberForm({ name: 'Staff', code: '1234' }), '')

console.log('staff member checks passed')
