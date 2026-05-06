import { createContext, useContext } from 'react'

export const StaffMemberContext = createContext(null)

export function useStaffMember() {
  return useContext(StaffMemberContext)
}
