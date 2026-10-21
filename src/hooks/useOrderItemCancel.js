import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { formatOrderCommandError, logOrderCommandError } from '../lib/orderCommandErrors'
import { hasStaffPermission } from '../lib/staffPermissions'
import useCancelPasscodeStatus from './useCancelPasscodeStatus'

// 権限項目を持たない古いスタッフは、メニュー管理なし（＝取消にパスコードが要る）として扱う。
const CANCEL_LEGACY_PERMISSIONS = { useKitchen: true, closeRegister: false, manageMenu: false }

// 席詳細と厨房で共通の取消モーダルの状態。照合と権限の最終判断はサーバーが行う。
export default function useOrderItemCancel({ storeId, activeStaff, onCancel, errorContext, logOperation }) {
  const { user } = useAuth()
  const { status, loaded, reload } = useCancelPasscodeStatus(storeId)
  const [target, setTarget] = useState(null)
  const [passcode, setPasscode] = useState('')
  const [passcodeError, setPasscodeError] = useState('')
  const [cancelling, setCancelling] = useState(false)

  // Google でログインした店舗管理者はサーバーがパスコード無しで通すので、画面でも求めない。
  const isStoreManagerLogin = !!user && !user.isAnonymous
  const passcodeRequired = !isStoreManagerLogin && !hasStaffPermission(activeStaff, 'manageMenu', CANCEL_LEGACY_PERMISSIONS)
  const blockedByMissingPasscode = passcodeRequired && loaded && !status.isSet

  function open(item, context = null) {
    setTarget({ item, context })
    setPasscode('')
    setPasscodeError('')
    // 厨房のタブレットは開きっぱなしなので、別の端末で設定された直後でも最新の状態で判断する。
    reload()
  }

  function close() {
    setTarget(null)
  }

  async function confirm() {
    if (!target || cancelling || blockedByMissingPasscode) return
    setCancelling(true)
    setPasscodeError('')
    try {
      const result = await onCancel(target.item, passcodeRequired ? passcode : '', target.context)
      if (result?.reason === 'invalid-passcode') {
        setPasscodeError('パスコードが違います')
        return
      }
      setTarget(null)
    } catch (error) {
      setPasscodeError(formatOrderCommandError(error, { context: errorContext }).message)
      logOrderCommandError({
        operation: logOperation,
        error,
        metadata: { storeId, itemId: target.item?.id, tableId: target.item?.tableId },
      })
    } finally {
      setCancelling(false)
    }
  }

  return {
    open,
    modalProps: {
      item: target?.item ?? null,
      passcodeRequired,
      passcodeSet: !loaded || status.isSet,
      passcode,
      passcodeError,
      cancelling,
      onPasscodeChange: setPasscode,
      onConfirm: confirm,
      onClose: close,
    },
  }
}
