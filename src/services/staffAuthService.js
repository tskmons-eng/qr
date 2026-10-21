import { collection, deleteDoc, doc, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { DEFAULT_STAFF_PERMISSION_PRESET, buildStaffPermissionsFromPreset, normalizeStaffPermissions } from '../lib/staffPermissions'
import { callOrderCommandFunction } from './orderFunctionCommandService'

// スタッフの4桁パスは画面に持たない。照合・登録・変更は Functions だけで行う（2026-10-22 整理 第4章 4-B）。

export async function loadStaffMembers(storeId) {
  const snap = await getDocs(query(collection(db, 'staffMembers'), where('storeId', '==', storeId)))
  return snap.docs
    // 移し替え前の店でも、画面ではパスを扱わない。
    .map(memberDoc => {
      const { code: _legacyCode, ...member } = memberDoc.data()
      return { id: memberDoc.id, ...member }
    })
    .sort((a, b) => (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0))
}

export function createStaffMember({ storeId, name, code, permissionPreset = DEFAULT_STAFF_PERMISSION_PRESET }) {
  return callOrderCommandFunction('createStaffMemberCommand', {
    storeId,
    name: name.trim(),
    code,
    permissionPreset,
    permissions: buildStaffPermissionsFromPreset(permissionPreset),
  })
}

export function updateStaffMemberPermissions({ memberId, permissionPreset, permissions }) {
  return updateDoc(doc(db, 'staffMembers', memberId), {
    permissionPreset,
    permissions: normalizeStaffPermissions(permissions, {}),
    updatedAt: serverTimestamp(),
  })
}

export function updateStaffMemberCode({ storeId, memberId, currentCode, nextCode }) {
  return callOrderCommandFunction('setStaffCodeCommand', { storeId, staffMemberId: memberId, currentCode, nextCode })
}

export function deleteStaffMember(memberId) {
  return deleteDoc(doc(db, 'staffMembers', memberId))
}

// code を渡すとパスを照合して入る。渡さないときは、この端末で照合済みのスタッフに戻るときだけ通る。
export function activateStaffMemberSession({ storeId, staff, code }) {
  return callOrderCommandFunction('activateStaffSessionCommand', {
    storeId,
    staffMemberId: staff.id,
    ...(code ? { code } : {}),
  })
}
