import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react'
import type {
  Product,
  School,
  Contract,
  Order,
  Atesto,
  CicloRecord,
  RotaRecord,
  ContratoEscolaRecord,
  ContratoItemRecord,
  PedidoValidacao,
} from '@/lib/types'
import { produtosService } from '@/services/produtos'
import { escolasService } from '@/services/escolas'
import { contratosService } from '@/services/contratos'
import { pedidosService } from '@/services/pedidos'
import { atestosService } from '@/services/atestos'
import { ciclosService } from '@/services/ciclos'
import { rotasService } from '@/services/rotas'
import { toast } from 'sonner'
import useRealtime from '@/hooks/use-realtime'
import { validateOrder } from '@/lib/orderValidation'

export interface CreateOrderData {
  schoolId: string
  date: string
  cicloId?: string
  origem?: 'excel' | 'whatsapp' | 'manual'
  rotaId?: string
  items: Array<{
    productId: string
    quantity: number
  }>
}

interface AppState {
  products: Product[]
  schools: School[]
  contracts: Contract[]
  contractSchools: ContratoEscolaRecord[]
  contractItems: ContratoItemRecord[]
  orders: Order[]
  atestos: Atesto[]
  ciclos: CicloRecord[]
  activeCiclo: CicloRecord | null
  rotas: RotaRecord[]
  isLoading: boolean
  error: string | null
  refreshData: () => Promise<void>
  addOrder: (orderData: CreateOrderData) => Promise<boolean>
  generateAtesto: (orderId: string) => Promise<boolean>
  confirmAtesto: (atestoId: string) => Promise<boolean>
  updateOrderStatus: (id: string, status: Order['status']) => Promise<boolean>
  updateCicloStatus: (
    cicloId: string,
    status: 'coletando' | 'correcao' | 'fechado',
  ) => Promise<boolean>
  createCiclo: (data: {
    nome: string
    data_inicio: string
    data_fim: string
    status: 'coletando' | 'correcao' | 'fechado'
  }) => Promise<CicloRecord | null>
  adjustProductPrices: (percentage: number) => Promise<boolean>
}

const AppContext = createContext<AppState | undefined>(undefined)

export function AppProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([])
  const [schools, setSchools] = useState<School[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [contractSchools, setContractSchools] = useState<ContratoEscolaRecord[]>([])
  const [contractItems, setContractItems] = useState<ContratoItemRecord[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [atestos, setAtestos] = useState<Atesto[]>([])
  const [ciclos, setCiclos] = useState<CicloRecord[]>([])
  const [activeCiclo, setActiveCiclo] = useState<CicloRecord | null>(null)
  const [rotas, setRotas] = useState<RotaRecord[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const loadAllData = useCallback(async () => {
    try {
      setError(null)
      const [
        rawProds,
        rawSchools,
        rawContratos,
        rawContratoEscolas,
        rawContratoItens,
        rawPedidos,
        rawPedidoItens,
        rawAtestos,
        rawCiclos,
        rawRotas,
      ] = await Promise.all([
        produtosService.getAll(),
        escolasService.getAll(),
        contratosService.getAll(),
        contratosService.getEscolas(),
        contratosService.getAllItems(),
        pedidosService.getAll(),
        pedidosService.getAllItems(),
        atestosService.getAll(),
        ciclosService.getAll(),
        rotasService.getAll(),
      ])

      setCiclos(rawCiclos)
      const currentActive = rawCiclos.find((c) => c.status !== 'fechado') || rawCiclos[0] || null
      setActiveCiclo(currentActive)
      setRotas(rawRotas)
      setContractSchools(rawContratoEscolas)
      setContractItems(rawContratoItens)

      // Map produtos
      const mappedProds: Product[] = rawProds.map((p) => ({
        id: p.id,
        name: p.nome,
        category: p.categoria,
        stock: Number(p.estoque) || 0,
        unit: p.unidade,
        price: Number(p.preco_unitario) || 0,
        essencial: Boolean(p.essencial),
        disponibilidade: p.disponibilidade || 'normal',
      }))
      setProducts(mappedProds)

      // Map escolas
      const mappedSchools: School[] = rawSchools.map((s) => ({
        id: s.id,
        name: s.nome,
        address: s.endereco || '',
        contact: s.telefone || '',
        route: s.rota || 'Sem Rota',
      }))
      setSchools(mappedSchools)

      // Map pedidos with items, rota, ciclo and validation
      const mappedOrders: Order[] = rawPedidos.map((ped) => {
        const schoolObj = mappedSchools.find((s) => s.id === ped.escola_id)
        const schoolName =
          ped.expand?.escola_id?.nome || schoolObj?.name || 'Escola não identificada'

        const rotaObj = rawRotas.find((r) => r.id === ped.rota_id)
        const rotaNome = ped.expand?.rota_id?.nome || rotaObj?.nome || schoolObj?.route

        const pItens = rawPedidoItens.filter((pi) => pi.pedido_id === ped.id)
        let total = 0
        const items = pItens.map((pi) => {
          const prod = mappedProds.find((p) => p.id === pi.produto_id)
          const prodName = pi.expand?.produto_id?.nome || prod?.name || 'Produto'
          const preco = Number(pi.preco_unitario) || prod?.price || 0
          const qtd = Number(pi.quantidade) || 0
          total += preco * qtd
          return {
            id: pi.id,
            productId: pi.produto_id,
            name: prodName,
            quantity: qtd,
            price: preco,
          }
        })

        // Validacao default se nao existir
        const rawValidacao = (ped.validacao as PedidoValidacao) || {
          status: 'validado',
          motivo: 'Registrado no sistema',
        }

        return {
          id: ped.id,
          numero: ped.numero,
          schoolId: ped.escola_id,
          schoolName,
          cicloId: ped.ciclo_id,
          origem: ped.origem || 'manual',
          rotaId: ped.rota_id,
          rotaNome,
          validacao: rawValidacao,
          date:
            ped.data_prevista ||
            ped.created?.split('T')[0] ||
            new Date().toISOString().split('T')[0],
          status: ped.status,
          total: Math.round(total * 100) / 100,
          items,
        }
      })
      setOrders(mappedOrders)

      // Map contratos with N:N escolas and balance calculation
      const mappedContracts: Contract[] = rawContratos.map((c) => {
        const links = rawContratoEscolas.filter((ce) => ce.contrato_id === c.id)
        const linkedSchools = links.map((ce) => {
          const sch = mappedSchools.find((s) => s.id === ce.escola_id)
          const rt = rawRotas.find((r) => r.id === ce.rota_id)
          return {
            id: ce.id,
            contratoId: ce.contrato_id,
            escolaId: ce.escola_id,
            rotaId: ce.rota_id,
            escolaNome: ce.expand?.escola_id?.nome || sch?.name || 'Escola',
            escolaEndereco: ce.expand?.escola_id?.endereco || sch?.address || '',
            escolaTelefone: ce.expand?.escola_id?.telefone || sch?.contact || '',
            rotaNome: ce.expand?.rota_id?.nome || rt?.nome || 'Sem Rota',
          }
        })

        const totalValue = Number(c.valor_total) || 0

        // Consumed value from orders of all participating schools
        const participatingSchoolIds = new Set(linkedSchools.map((l) => l.escolaId))
        const contractOrders = mappedOrders.filter(
          (o) => participatingSchoolIds.has(o.schoolId) && o.status !== 'Cancelado',
        )
        const consumed = contractOrders.reduce((acc, o) => acc + o.total, 0)
        const balance = Math.max(0, totalValue - consumed)

        return {
          id: c.id,
          numero: c.numero,
          tipo: c.tipo || 'PNAE',
          modalidade_pedido: c.modalidade_pedido || 'individualizado',
          totalValue,
          balance,
          status: c.status,
          escolas: linkedSchools,
        }
      })
      setContracts(mappedContracts)

      // Map atestos
      const mappedAtestos: Atesto[] = rawAtestos.map((a) => {
        const relatedOrder = mappedOrders.find((o) => o.id === a.pedido_id)
        const schoolName =
          a.expand?.pedido_id?.expand?.escola_id?.nome || relatedOrder?.schoolName || 'Escola'

        return {
          id: a.id,
          numero: a.numero,
          orderId: a.pedido_id,
          orderNumber: a.expand?.pedido_id?.numero || relatedOrder?.numero || a.pedido_id,
          schoolName,
          date:
            a.data_emissao || a.created?.split('T')[0] || new Date().toISOString().split('T')[0],
          status: a.status,
          signatureFile: a.assinatura_file,
        }
      })
      setAtestos(mappedAtestos)
    } catch (err: any) {
      console.error('Erro ao carregar dados do PocketBase:', err)
      setError('Erro ao carregar dados do banco de dados.')
      toast.error('Erro ao conectar ao banco de dados.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAllData()
  }, [loadAllData])

  // Realtime subscriptions
  useRealtime('produtos', () => loadAllData())
  useRealtime('escolas', () => loadAllData())
  useRealtime('contratos', () => loadAllData())
  useRealtime('contrato_escolas', () => loadAllData())
  useRealtime('contrato_itens', () => loadAllData())
  useRealtime('pedidos', () => loadAllData())
  useRealtime('pedido_itens', () => loadAllData())
  useRealtime('atestos', () => loadAllData())
  useRealtime('ciclos', () => loadAllData())
  useRealtime('rotas', () => loadAllData())

  const addOrder = async (orderData: CreateOrderData): Promise<boolean> => {
    try {
      const orderCount = orders.length + 1
      const numero = `ORD-${String(orderCount).padStart(3, '0')}`

      const formattedItens = orderData.items.map((it) => {
        const prod = products.find((p) => p.id === it.productId)
        return {
          id: it.productId,
          productId: it.productId,
          name: prod?.name || 'Produto',
          quantidade: it.quantity,
          preco_unitario: prod?.price || 0,
          price: prod?.price || 0,
        }
      })

      // Validation
      const cicloStatus = activeCiclo?.status || 'coletando'
      const validationResult = validateOrder({
        items: formattedItens.map((i) => ({
          productId: i.productId,
          name: i.name,
          quantity: i.quantidade,
          price: i.preco_unitario,
        })),
        allProducts: products,
        cicloStatus,
      })

      // Find route if not provided
      let rotaId = orderData.rotaId
      if (!rotaId) {
        const ce = contractSchools.find((c) => c.escola_id === orderData.schoolId && c.rota_id)
        if (ce) {
          rotaId = ce.rota_id
        }
      }

      const datePrevista = orderData.date.includes('T')
        ? orderData.date
        : `${orderData.date} 12:00:00.000Z`

      await pedidosService.create({
        numero,
        escola_id: orderData.schoolId,
        ciclo_id: orderData.cicloId || activeCiclo?.id,
        origem: orderData.origem || 'manual',
        rota_id: rotaId,
        validacao: validationResult,
        data_prevista: datePrevista,
        status: 'Pendente',
        itens: formattedItens.map((i) => ({
          produto_id: i.productId,
          quantidade: i.quantidade,
          preco_unitario: i.preco_unitario,
        })),
      })

      if (validationResult.status === 'invalido') {
        toast.warning(`Pedido cadastrado com pendência de validação: ${validationResult.motivo}`)
      } else {
        toast.success('Pedido registrado com sucesso!')
      }

      await loadAllData()
      return true
    } catch (err: any) {
      console.error('Erro ao criar pedido:', err)
      toast.error('Falha ao salvar pedido no banco.')
      return false
    }
  }

  const updateOrderStatus = async (id: string, status: Order['status']): Promise<boolean> => {
    try {
      await pedidosService.updateStatus(id, status)
      await loadAllData()
      return true
    } catch (err: any) {
      console.error('Erro ao atualizar status do pedido:', err)
      toast.error('Falha ao atualizar status.')
      return false
    }
  }

  const updateCicloStatus = async (
    cicloId: string,
    status: 'coletando' | 'correcao' | 'fechado',
  ): Promise<boolean> => {
    try {
      await ciclosService.setStatus(cicloId, status)
      await loadAllData()
      toast.success(`Fase do ciclo alterada para "${status}" com sucesso!`)
      return true
    } catch (err: any) {
      console.error('Erro ao alterar status do ciclo:', err)
      toast.error('Erro ao atualizar status do ciclo.')
      return false
    }
  }

  const createCiclo = async (data: {
    nome: string
    data_inicio: string
    data_fim: string
    status: 'coletando' | 'correcao' | 'fechado'
  }): Promise<CicloRecord | null> => {
    try {
      const created = await ciclosService.create(data)
      await loadAllData()
      toast.success(`Ciclo "${data.nome}" criado com sucesso!`)
      return created
    } catch (err: any) {
      console.error('Erro ao criar ciclo:', err)
      toast.error('Falha ao criar novo ciclo.')
      return null
    }
  }

  const generateAtesto = async (orderId: string): Promise<boolean> => {
    try {
      const order = orders.find((o) => o.id === orderId)
      if (!order) {
        toast.error('Pedido não encontrado.')
        return false
      }

      const existing = atestos.find((a) => a.orderId === orderId)
      if (existing) {
        toast.info('Já existe atesto emitido para este pedido.')
        return false
      }

      const atestoCount = atestos.length + 1
      const numero = `AT-${String(atestoCount).padStart(3, '0')}`
      const now = new Date().toISOString()

      await atestosService.create({
        numero,
        pedido_id: orderId,
        data_emissao: now,
        status: 'Pendente Assinatura',
      })

      await loadAllData()
      return true
    } catch (err: any) {
      console.error('Erro ao gerar atesto:', err)
      toast.error('Falha ao gerar atesto no banco.')
      return false
    }
  }

  const confirmAtesto = async (atestoId: string): Promise<boolean> => {
    try {
      await atestosService.confirm(atestoId)
      await loadAllData()
      return true
    } catch (err: any) {
      console.error('Erro ao confirmar atesto:', err)
      toast.error('Falha ao confirmar atesto.')
      return false
    }
  }

  const adjustProductPrices = async (percentage: number): Promise<boolean> => {
    try {
      await produtosService.bulkAdjustPrices(percentage)
      await loadAllData()
      return true
    } catch (err: any) {
      console.error('Erro ao reajustar preços:', err)
      toast.error('Falha ao ajustar preços no banco.')
      return false
    }
  }

  return (
    <AppContext.Provider
      value={{
        products,
        schools,
        contracts,
        contractSchools,
        contractItems,
        orders,
        atestos,
        ciclos,
        activeCiclo,
        rotas,
        isLoading,
        error,
        refreshData: loadAllData,
        addOrder,
        updateOrderStatus,
        updateCicloStatus,
        createCiclo,
        generateAtesto,
        confirmAtesto,
        adjustProductPrices,
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
