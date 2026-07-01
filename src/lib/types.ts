export interface Product {
  id: string
  name: string
  category: 'Hortaliças' | 'Frutas' | 'Grãos'
  stock: number
  unit: string
  price: number
}

export interface School {
  id: string
  name: string
  address: string
  contact: string
  route: string
}

export interface Contract {
  id: string
  schoolId: string
  schoolName: string
  totalValue: number
  balance: number
  status: 'Ativo' | 'Encerrado'
}

export interface OrderItem {
  productId: string
  name: string
  quantity: number
}

export interface Order {
  id: string
  schoolId: string
  schoolName: string
  date: string
  status: 'Pendente' | 'Em Rota' | 'Entregue' | 'Cancelado'
  total: number
  items: OrderItem[]
}

export interface Atesto {
  id: string
  orderId: string
  schoolName: string
  date: string
  status: 'Pendente Assinatura' | 'Confirmado' | 'Arquivado'
}
