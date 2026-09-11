export interface ProdutoRecord {
  id: string
  nome: string
  categoria: 'Hortaliças' | 'Frutas' | 'Grãos' | 'Legumes' | 'Outros'
  unidade: string
  estoque: number
  preco_unitario: number
  created?: string
  updated?: string
}

export interface EscolaRecord {
  id: string
  nome: string
  endereco: string
  telefone: string
  rota: string
  created?: string
  updated?: string
}

export interface ContratoRecord {
  id: string
  numero: string
  tipo?: string
  instituicao_id: string
  valor_total: number
  status: 'Ativo' | 'Encerrado' | 'Pendente'
  expand?: {
    instituicao_id?: EscolaRecord
  }
  created?: string
  updated?: string
}

export interface ContratoItemRecord {
  id: string
  contrato_id: string
  produto_id: string
  preco: number
  expand?: {
    produto_id?: ProdutoRecord
  }
  created?: string
  updated?: string
}

export interface PedidoRecord {
  id: string
  numero: string
  escola_id: string
  data_prevista: string
  status: 'Pendente' | 'Em Rota' | 'Entregue' | 'Cancelado'
  expand?: {
    escola_id?: EscolaRecord
  }
  created?: string
  updated?: string
}

export interface PedidoItemRecord {
  id: string
  pedido_id: string
  produto_id: string
  quantidade: number
  preco_unitario: number
  expand?: {
    produto_id?: ProdutoRecord
  }
  created?: string
  updated?: string
}

export interface AtestoRecord {
  id: string
  numero: string
  pedido_id: string
  data_emissao: string
  status: 'Pendente Assinatura' | 'Confirmado' | 'Arquivado'
  assinatura_file?: string
  expand?: {
    pedido_id?: PedidoRecord & {
      expand?: {
        escola_id?: EscolaRecord
      }
    }
  }
  created?: string
  updated?: string
}

// UI Models compatible with the app pages
export interface Product {
  id: string
  name: string
  category: 'Hortaliças' | 'Frutas' | 'Grãos' | 'Legumes' | 'Outros'
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
  numero: string
  tipo?: string
  schoolId: string
  schoolName: string
  totalValue: number
  balance: number
  status: 'Ativo' | 'Encerrado' | 'Pendente'
}

export interface OrderItem {
  id?: string
  productId: string
  name: string
  quantity: number
  price: number
}

export interface Order {
  id: string
  numero: string
  schoolId: string
  schoolName: string
  date: string
  status: 'Pendente' | 'Em Rota' | 'Entregue' | 'Cancelado'
  total: number
  items: OrderItem[]
}

export interface Atesto {
  id: string
  numero: string
  orderId: string
  orderNumber: string
  schoolName: string
  date: string
  status: 'Pendente Assinatura' | 'Confirmado' | 'Arquivado'
  signatureFile?: string
}

export type UserPerfil = 'administrador' | 'secretaria'

export interface UserRecord {
  id: string
  email: string
  nome?: string
  name?: string
  perfil: UserPerfil
  avatar?: string
  created?: string
  updated?: string
}
