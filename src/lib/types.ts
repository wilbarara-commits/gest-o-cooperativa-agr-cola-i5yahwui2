export interface ProdutoRecord {
  id: string
  nome: string
  categoria: 'Hortaliças' | 'Frutas' | 'Grãos' | 'Legumes' | 'Outros'
  unidade: string
  estoque: number
  preco_unitario: number
  essencial?: boolean
  disponibilidade?: 'normal' | 'escassez' | 'abundancia'
  created?: string
  updated?: string
}

export type EscolaTipo =
  | 'Municipal'
  | 'Estadual'
  | 'Creche / CMEI'
  | 'Filantrópica / Conveniada'
  | 'Outro'

export interface EscolaRecord {
  id: string
  nome: string
  endereco: string
  telefone: string
  rota: string
  email?: string
  tipo?: EscolaTipo | string
  alunos?: number
  created?: string
  updated?: string
}

export interface CicloRecord {
  id: string
  nome: string
  data_inicio: string
  data_fim: string
  status: 'coletando' | 'correcao' | 'fechado'
  snapshot?: any
  created?: string
  updated?: string
}

export interface RotaRecord {
  id: string
  contrato_id: string
  nome: string
  ordem?: number
  created?: string
  updated?: string
}

export interface ContratoRecord {
  id: string
  numero: string
  tipo?: string
  modalidade_pedido?: 'individualizado' | 'centralizado'
  valor_total: number
  status: 'Ativo' | 'Encerrado' | 'Pendente'
  created?: string
  updated?: string
}

export interface ContratoEscolaRecord {
  id: string
  contrato_id: string
  escola_id: string
  rota_id?: string
  expand?: {
    escola_id?: EscolaRecord
    rota_id?: RotaRecord
    contrato_id?: ContratoRecord
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

export interface PedidoValidacao {
  status: 'validado' | 'em_progresso' | 'invalido'
  motivo?: string
  detalhes?: string[]
}

export interface PedidoRecord {
  id: string
  numero: string
  escola_id: string
  ciclo_id?: string
  origem?: 'excel' | 'whatsapp' | 'manual'
  rota_id?: string
  validacao?: PedidoValidacao
  data_prevista: string
  status: 'Pendente' | 'Em Rota' | 'Entregue' | 'Cancelado'
  expand?: {
    escola_id?: EscolaRecord
    ciclo_id?: CicloRecord
    rota_id?: RotaRecord
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

export interface EnvioWhatsappRecord {
  id: string
  ciclo_id: string
  escola_id: string
  status: 'pendente' | 'enviado' | 'falha'
  enviado_em?: string
  expand?: {
    escola_id?: EscolaRecord
    ciclo_id?: CicloRecord
  }
  created?: string
  updated?: string
}

export interface ImportacaoRecord {
  id: string
  ciclo_id: string
  contrato_id: string
  arquivo: string
  data: string
  usuario_id?: string
  linhas_total?: number
  linhas_ok?: number
  linhas_erro?: number
  erros?: any
  expand?: {
    ciclo_id?: CicloRecord
    contrato_id?: ContratoRecord
    usuario_id?: UserRecord
  }
  created?: string
  updated?: string
}

// UI Models
export interface Product {
  id: string
  name: string
  category: 'Hortaliças' | 'Frutas' | 'Grãos' | 'Legumes' | 'Outros'
  stock: number
  unit: string
  price: number
  essencial: boolean
  disponibilidade: 'normal' | 'escassez' | 'abundancia'
}

export interface School {
  id: string
  name: string
  address: string
  contact: string
  route: string
  email?: string
  tipo?: EscolaTipo | string
  alunos?: number
}

export interface ContractSchoolLink {
  id: string
  contratoId: string
  escolaId: string
  rotaId?: string
  escolaNome?: string
  escolaEndereco?: string
  escolaTelefone?: string
  escolaEmail?: string
  escolaTipo?: string
  escolaAlunos?: number
  rotaNome?: string
}

export interface Contract {
  id: string
  numero: string
  tipo?: string
  modalidade_pedido: 'individualizado' | 'centralizado'
  totalValue: number
  balance: number
  status: 'Ativo' | 'Encerrado' | 'Pendente'
  escolas: ContractSchoolLink[]
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
  cicloId?: string
  origem: 'excel' | 'whatsapp' | 'manual'
  rotaId?: string
  rotaNome?: string
  validacao: PedidoValidacao
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
