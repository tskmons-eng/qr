import { useEffect, useState } from 'react'
import StaffAddSheet from '../../components/admin/StaffAddSheet'
import StaffDetailSheet from '../../components/admin/StaffDetailSheet'
import StaffEntryCard from '../../components/admin/StaffEntryCard'
import StaffMemberList from '../../components/admin/StaffMemberList'
import { useStaffMember } from '../../contexts/StaffMemberContext'
import { useStore } from '../../contexts/StoreContext'
import { formatOrderCommandError } from '../../lib/orderCommandErrors'
import {
  buildStaffPermissionsFromPreset,
  getStaffPresetKeyFromPermissions,
  normalizeStaffMemberPermissions,
  setStaffPermissionValue,
} from '../../lib/staffPermissions'
import { loadStoreIdentity } from '../../services/settingsService'
import { createStaffMember, deleteStaffMember, loadStaffMembers, updateStaffMemberCode, updateStaffMemberPermissions } from '../../services/staffAuthService'

// スタッフ管理（2026-10-23 作り直し）。上に端末での入り方と「スタッフを追加」、その下に1人1行。
// 押すと詳細（役割・細かい権限・パス・削除）が下から出る。変更は押したらすぐ保存。
export default function StaffPage() {
  const { storeId } = useStore()
  // 店長・オーナー（Google ログイン）は、今のパスなしで決め直せる。スタッフ管理の権限を持つスタッフは今のパスが要る。
  const activeStaff = useStaffMember()?.activeStaff
  const requireCurrentCode = !activeStaff?.isStoreManager
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [storeCode, setStoreCode] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')
  const [openMemberId, setOpenMemberId] = useState(null)
  const openMember = members.find(member => member.id === openMemberId) ?? null

  async function load() {
    setMembers(await loadStaffMembers(storeId))
    setLoading(false)
  }

  useEffect(() => {
    if (!storeId) return
    load()
    loadStoreIdentity(storeId).then(identity => setStoreCode(identity.storeCode)).catch(() => setStoreCode(''))
  }, [storeId])

  async function handleAdd({ name, code, permissionPreset }) {
    setAdding(true)
    setAddError('')
    try {
      await createStaffMember({ storeId, name, code, permissionPreset })
      setAddOpen(false)
      await load()
    } catch (addFailure) {
      setAddError(formatOrderCommandError(addFailure).message)
    } finally {
      setAdding(false)
    }
  }

  // 詳細の操作は、失敗したら文言を返す（シートに出す）。成功したら何も返さない。
  async function savePermissions(member, permissions) {
    const permissionPreset = getStaffPresetKeyFromPermissions(permissions)
    try {
      await updateStaffMemberPermissions({ memberId: member.id, permissionPreset, permissions })
      setMembers(prev => prev.map(existing => (existing.id === member.id ? { ...existing, permissionPreset, permissions } : existing)))
      return null
    } catch {
      return '保存できませんでした。通信を確かめて、もう一度お試しください'
    }
  }

  function handlePresetChange(member, presetKey) {
    return savePermissions(member, buildStaffPermissionsFromPreset(presetKey))
  }

  function handleToggle(member, key, enabled) {
    return savePermissions(member, setStaffPermissionValue(normalizeStaffMemberPermissions(member), key, enabled))
  }

  // 今のパスの確認と新しいパスの保存はサーバーで行う（画面はパスを持たない）。
  async function handleCodeReset(member, { currentCode, nextCode }) {
    if (!/^\d{4}$/.test(nextCode)) return '新しいパスは4桁の数字にしてください'
    try {
      await updateStaffMemberCode({ storeId, memberId: member.id, currentCode: requireCurrentCode ? currentCode : undefined, nextCode })
      return null
    } catch (resetFailure) {
      const { code: failureCode, message } = formatOrderCommandError(resetFailure)
      return failureCode === 'invalid-staff-code' ? '今のパスが違います' : message
    }
  }

  async function handleDelete(member) {
    try {
      await deleteStaffMember(member.id)
      setOpenMemberId(null)
      setMembers(prev => prev.filter(existing => existing.id !== member.id))
      return null
    } catch {
      return '削除できませんでした。通信を確かめて、もう一度お試しください'
    }
  }

  return (
    <div className="admin-staff">
      <StaffEntryCard storeCode={storeCode} />
      <button type="button" onClick={() => { setAddError(''); setAddOpen(true) }} className="ui-button ui-button--primary ui-button--block">
        ＋ スタッフを追加
      </button>
      <div className="admin-staff__heading">
        <span>スタッフ {members.length}人</span>
        <span>押すと役割・パス・削除</span>
      </div>
      <StaffMemberList loading={loading} members={members} onOpen={member => setOpenMemberId(member.id)} />
      <StaffAddSheet open={addOpen} adding={adding} error={addError} onAdd={handleAdd} onClose={() => setAddOpen(false)} />
      {openMember && (
        <StaffDetailSheet
          member={openMember}
          isSelf={openMember.id === activeStaff?.id}
          requireCurrentCode={requireCurrentCode}
          onClose={() => setOpenMemberId(null)}
          onPresetChange={handlePresetChange}
          onToggle={handleToggle}
          onCodeReset={handleCodeReset}
          onDelete={handleDelete}
        />
      )}
    </div>
  )
}
