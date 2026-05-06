import { createContext, useContext } from 'react'

const OrderContext = createContext(null)

export function OrderProvider({ children, value }) {
  return <OrderContext.Provider value={value}>{children}</OrderContext.Provider>
}

export function useOrder() {
  return useContext(OrderContext)
}
