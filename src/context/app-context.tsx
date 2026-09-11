import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react'
import type { Product, School, Contract, Order, Atesto } from '@/lib/types'
import { produtosService } from '@/services/produtos'
import { escolasService } from '@/services/escolas'
import { contratosService } from '@/services/contratos'
import { pedidosService } from '@/services/pedidos'
import { atestosService } from '@/services/atestos'
import { toast } from 'sonner'
import useRealtime from '@/hooks/use-realtime'

interface CreateOrderData {
  schoolId: string
  date: string
  items: Array<{
    productId: string
    quantity: number
  }>
}

interface AppState {
  products: Product[]
  schools: School[]
  contracts: Contract[]
  orders: Order[]
  atestos: Atesto[]
  isLoading: boolean
  error: string | null
  refreshData: () => Promise<void>
  addOrder: (orderData: CreateOrderData) => Promise<boolean>
  generateAtesto: (orderId: string) => Promise<boolean>
  confirmAtesto: (atestoId: string) => Promise<boolean>
  updateOrderStatus: (id: string, status: Order['status']) => Promise<boolean>
  adjustProductPrices: (percentage: number) => Promise<boolean>
}

const AppContext = createContext<AppState | undefined>(undefined)

export function AppProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([])
  const [schools, setSchools] = useState<School[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [atestos, setAtestos] = useState<Atesto[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const loadAllData = useCallback(async () => {
    try {
      setError(null)
      const [rawProds, rawSchools, rawContratos, rawPedidos, rawPedidoItens, rawAtestos] =
        await Promise.all([
          produtosService.getAll(),
          escolasService.getAll(),
          contratosService.getAll(),
          pedidosService.getAll(),
          pedidosService.getAllItems(),
          atestosService.getAll(),
        ])

      // Map produtos
      const mappedProds: Product[] = rawProds.map((p) => ({
        id: p.id,
        name: p.nome,
        category: p.categoria,
        stock: Number(p.estoque) || 0,
        unit: p.unidade,
        price: Number(p.preco_unitario) || 0,
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

      // Map pedidos with items
      const mappedOrders: Order[] = rawPedidos.map((ped) => {
        const schoolObj = mappedSchools.find((s) => s.id === ped.escola_id)
        const schoolName =
          ped.expand?.escola_id?.nome || schoolObj?.name || 'Escola não identificada'

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

        return {
          id: ped.id,
          numero: ped.numero,
          schoolId: ped.escola_id,
          schoolName,
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

      // Map contratos with balance calculation
      const mappedContracts: Contract[] = rawContratos.map((c) => {
        const schoolObj = mappedSchools.find((s) => s.id === c.instituicao_id)
        const schoolName = c.expand?.instituicao_id?.nome || schoolObj?.name || 'Instituição'
        const totalValue = Number(c.valor_total) || 0

        // Calculate consumed value from orders of this school
        const schoolOrders = mappedOrders.filter(
          (o) => o.schoolId === c.instituicao_id && o.status !== 'Cancelado',
        )
        const consumed = schoolOrders.reduce((acc, o) => acc + o.total, 0)
        const balance = Math.max(0, totalValue - consumed)

        return {
          id: c.id,
          numero: c.numero,
          tipo: c.tipo || 'PNAE',
          schoolId: c.instituicao_id,
          schoolName,
          totalValue,
          balance,
          status: c.status,
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

  // Realtime subscriptions for live updates
  useRealtime('produtos', () => {
    loadAllData()
  })
  useRealtime('escolas', () => {
    loadAllData()
  })
  useRealtime('contratos', () => {
    loadAllData()
  })
  useRealtime('pedidos', () => {
    loadAllData()
  })
  useRealtime('pedido_itens', () => {
    loadAllData()
  })
  useRealtime('atestos', () => {
    loadAllData()
  })

  const addOrder = async (orderData: CreateOrderData): Promise<boolean> => {
    try {
      const orderCount = orders.length + 1
      const numero = `ORD-${String(orderCount).padStart(3, '0')}`

      const formattedItens = orderData.items.map((it) => {
        const prod = products.find((p) => p.id === it.productId)
        return {
          produto_id: it.productId,
          quantidade: it.quantity,
          preco_unitario: prod?.price || 0,
        }
      })

      // Format date for PocketBase DateField
      const datePrevista = orderData.date.includes('T')
        ? orderData.date
        : `${orderData.date} 12:00:00.000Z`

      await pedidosService.create({
        numero,
        escola_id: orderData.schoolId,
        data_prevista: datePrevista,
        status: 'Pendente',
        itens: formattedItens,
      })

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
        orders,
        atestos,
        isLoading,
        error,
        refreshData: loadAllData,
        addOrder,
        updateOrderStatus,
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
