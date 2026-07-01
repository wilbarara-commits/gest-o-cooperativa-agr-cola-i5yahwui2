import React, { createContext, useContext, useState, ReactNode } from 'react'
import type { Product, School, Contract, Order, Atesto } from '@/lib/types'

interface AppState {
  products: Product[]
  schools: School[]
  contracts: Contract[]
  orders: Order[]
  atestos: Atesto[]
  addOrder: (order: Order) => void
  generateAtesto: (orderId: string) => void
  updateOrderStatus: (id: string, status: Order['status']) => void
}

const MOCK_PRODUCTS: Product[] = [
  { id: '1', name: 'Alface Crespa', category: 'Hortaliças', stock: 150, unit: 'Maço', price: 2.5 },
  { id: '2', name: 'Tomate Carmem', category: 'Frutas', stock: 80, unit: 'Kg', price: 6.0 },
  { id: '3', name: 'Cenoura', category: 'Hortaliças', stock: 120, unit: 'Kg', price: 4.5 },
  { id: '4', name: 'Feijão Carioca', category: 'Grãos', stock: 500, unit: 'Kg', price: 8.0 },
]

const MOCK_SCHOOLS: School[] = [
  {
    id: '1',
    name: 'E.M. João da Silva',
    address: 'Rua das Flores, 123',
    contact: '(11) 98765-4321',
    route: 'Rota Sul',
  },
  {
    id: '2',
    name: 'E.E. Maria Antonieta',
    address: 'Av. Brasil, 456',
    contact: '(11) 91234-5678',
    route: 'Rota Norte',
  },
  {
    id: '3',
    name: 'Creche Pingo de Gente',
    address: 'Rua do Sol, 89',
    contact: '(11) 99999-8888',
    route: 'Rota Sul',
  },
]

const MOCK_CONTRACTS: Contract[] = [
  {
    id: 'C-2026-01',
    schoolId: '1',
    schoolName: 'E.M. João da Silva',
    totalValue: 15000,
    balance: 12500,
    status: 'Ativo',
  },
  {
    id: 'C-2026-02',
    schoolId: '2',
    schoolName: 'E.E. Maria Antonieta',
    totalValue: 20000,
    balance: 8000,
    status: 'Ativo',
  },
]

const MOCK_ORDERS: Order[] = [
  {
    id: 'ORD-001',
    schoolId: '1',
    schoolName: 'E.M. João da Silva',
    date: '2026-07-02',
    status: 'Pendente',
    total: 250.0,
    items: [{ productId: '1', name: 'Alface Crespa', quantity: 20 }],
  },
  {
    id: 'ORD-002',
    schoolId: '2',
    schoolName: 'E.E. Maria Antonieta',
    date: '2026-07-01',
    status: 'Entregue',
    total: 480.0,
    items: [{ productId: '2', name: 'Tomate Carmem', quantity: 80 }],
  },
]

const MOCK_ATESTOS: Atesto[] = [
  {
    id: 'AT-001',
    orderId: 'ORD-002',
    schoolName: 'E.E. Maria Antonieta',
    date: '2026-07-01',
    status: 'Pendente Assinatura',
  },
]

const AppContext = createContext<AppState | undefined>(undefined)

export function AppProvider({ children }: { children: ReactNode }) {
  const [products] = useState<Product[]>(MOCK_PRODUCTS)
  const [schools] = useState<School[]>(MOCK_SCHOOLS)
  const [contracts] = useState<Contract[]>(MOCK_CONTRACTS)
  const [orders, setOrders] = useState<Order[]>(MOCK_ORDERS)
  const [atestos, setAtestos] = useState<Atesto[]>(MOCK_ATESTOS)

  const addOrder = (order: Order) => setOrders((prev) => [order, ...prev])

  const updateOrderStatus = (id: string, status: Order['status']) => {
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)))
  }

  const generateAtesto = (orderId: string) => {
    const order = orders.find((o) => o.id === orderId)
    if (order && !atestos.find((a) => a.orderId === orderId)) {
      setAtestos((prev) => [
        {
          id: `AT-${Math.floor(Math.random() * 1000)}`,
          orderId: order.id,
          schoolName: order.schoolName,
          date: new Date().toISOString().split('T')[0],
          status: 'Pendente Assinatura',
        },
        ...prev,
      ])
    }
  }

  return (
    <AppContext.Provider
      value={{
        products,
        schools,
        contracts,
        orders,
        atestos,
        addOrder,
        updateOrderStatus,
        generateAtesto,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp must be used within AppProvider')
  return context
}
