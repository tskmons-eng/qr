import { addDoc, collection, deleteDoc, doc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore'
import { auth } from '../lib/firebase'
import { db } from '../lib/firebase'
import { DEFAULT_STAFF_PERMISSION_PRESET, buildStaffPermissionsFromPreset, normalizeStaffPermissions } from '../lib/staffPermissions'

export async function loadStaffMembers(storeId) {
  const snap = await getDocs(query(collection(db, 'staffMembers'), where('storeId', '==', storeId)))
  return snap.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) => (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0))
}

export function createStaffMember({ storeId, name, code, permissionPreset = DEFAULT_STAFF_PERMISSION_PRESET }) {
  return addDoc(collection(db, 'staffMembers'), {
    storeId,
    name: name.trim(),
    code,
    permissionPreset,
    permissions: buildStaffPermissionsFromPreset(permissionPreset),
    createdAt: serverTimestamp(),
  })
}

export function updateStaffMemberPermissions({ memberId, permissionPreset, permissions }) {
  return updateDoc(doc(db, 'staffMembers', memberId), {
    permissionPreset,
    permissions: normalizeStaffPermissions(permissions, {}),
    updatedAt: serverTimestamp(),
  })
}

export function deleteStaffMember(memberId) {
  return deleteDoc(doc(db, 'staffMembers', memberId))
}

export function activateStaffMemberSession({ storeId, staff }) {
  const user = auth.currentUser
  if (!user) return Promise.resolve()
  return setDoc(doc(db, 'staffSessions', user.uid), {
    storeId,
    staffMemberId: staff.id,
    staffName: staff.name,
    permissionPreset: staff.permissionPreset ?? 'legacy',
    permissions: normalizeStaffPermissions(staff.permissions),
    updatedAt: serverTimestamp(),
  }, { merge: true })
}
