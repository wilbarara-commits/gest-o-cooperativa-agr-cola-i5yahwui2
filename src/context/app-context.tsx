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
  AtestoRecord,
  CicloRecord,
  RotaRecord,
  RotaLogisticaRecord,
  ParadaRotaRecord,
  DespachoRecord,
  ContratoEscolaRecord,
  ContratoItemRecord,
  PedidoValidacao,
  ConfiguracoesRecord,
} from '@/lib/types'
import { configuracoesService } from '@/services/configuracoes'
import { produtosService } from '@/services/produtos'
import { escolasService } from '@/services/escolas'
import { contratosService } from '@/services/contratos'
import { pedidosService } from '@/services/pedidos'
import { atestosService } from '@/services/atestos'
import { ciclosService } from '@/services/ciclos'
import { rotasService } from '@/services/rotas'
import { rotasLogisticasService } from '@/services/rotas-logisticas'
import { toast } from 'sonner'
import useRealtime from '@/hooks/use-realtime'
import { validateOrder } from '@/lib/orderValidation'

export interface CreateOrderData {
  schoolId: string
  date: string
  cicloId?: string
  origem?: 'excel' | 'whatsapp' | 'manual'
  rotaId?: string
  rotaLogisticaId?: string
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
  rotasLogisticas: RotaLogisticaRecord[]
  paradasRota: ParadaRotaRecord[]
  despachos: DespachoRecord[]
  config: ConfiguracoesRecord | null
  logoUrl: string
  isLoading: boolean
  error: string | null
  refreshData: () => Promise<void>
  addOrder: (orderData: CreateOrderData) => Promise<boolean>
  generateAtesto: (
    orderId: string,
    pdfBlob?: Blob,
    customNumero?: string,
  ) => Promise<AtestoRecord | null>
  confirmAtesto: (atestoId: string) => Promise<boolean>
  updateOrderStatus: (
    id: string,
    status: Order['status'],
    options?: {
      cancelamento_motivo?: string
      motivo_cancelamento?: string
      entregue_em?: string
      entregue_por?: string
      cancelado_em?: string
      rota_logistica_id?: string
    },
  ) => Promise<boolean>
  confirmarEntregaPedido: (id: string, userId?: string) => Promise<boolean>
  cancelarPedido: (id: string, motivo: string, isEmRota?: boolean) => Promise<boolean>
  despacharRotaInteira: (
    rotaLogisticaId: string,
    contratoId: string,
    userId?: string,
  ) => Promise<boolean>
  confirmarEntregaRotaInteira: (rotaLogisticaId: string, userId?: string) => Promise<boolean>
  marcarNaoEntreguePedido: (
    pedidoId: string,
    motivoLogistico: string,
    userId?: string,
  ) => Promise<boolean>
  criarRotaLogistica: (data: {
    contrato_id: string
    nome: string
    ordem?: number
    ativa?: boolean
  }) => Promise<RotaLogisticaRecord | null>
  excluirRotaLogistica: (id: string) => Promise<boolean>
  sincronizarEscolasRotaLogistica: (
    contratoId: string,
    rotaLogisticaId: string,
    escolaIds: string[],
    pedidoIds?: string[],
  ) => Promise<boolean>
  atribuirPedidosARotaLogistica: (pedidoIds: string[], rotaLogisticaId: string) => Promise<boolean>
  salvarSequenciamentoParadas: (
    rotaLogisticaId: string,
    paradas: Array<{ escola_id: string; ordem: number }>,
  ) => Promise<boolean>
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
  const [rotasLogisticas, setRotasLogisticas] = useState<RotaLogisticaRecord[]>([])
  const [paradasRota, setParadasRota] = useState<ParadaRotaRecord[]>([])
  const [despachos, setDespachos] = useState<DespachoRecord[]>([])
  const [config, setConfig] = useState<ConfiguracoesRecord | null>(null)
  const [logoUrl, setLogoUrl] = useState<string>('')
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
        rawRotasLogisticas,
        rawParadasRota,
        rawDespachos,
        rawConfig,
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
        rotasLogisticasService.getAll(),
        rotasLogisticasService.getParadas(),
        rotasLogisticasService.getDespachos(),
        configuracoesService.get(),
      ])

      setConfig(rawConfig)
      const computedLogo = configuracoesService.getLogoUrl(rawConfig)
      setLogoUrl(computedLogo)

      // Atualizar dinamicamente o favicon e título se houver logotipo/config
      if (typeof document !== 'undefined') {
        if (computedLogo) {
          let linkIcon = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null
          if (!linkIcon) {
            linkIcon = document.createElement('link')
            linkIcon.rel = 'icon'
            document.head.appendChild(linkIcon)
          }
          linkIcon.href = computedLogo

          let appleIcon = document.querySelector(
            "link[rel='apple-touch-icon']",
          ) as HTMLLinkElement | null
          if (!appleIcon) {
            appleIcon = document.createElement('link')
            appleIcon.rel = 'apple-touch-icon'
            document.head.appendChild(appleIcon)
          }
          appleIcon.href = computedLogo
        }

        if (rawConfig?.sigla || rawConfig?.nome_cooperativa) {
          const nomeApp = rawConfig.sigla || rawConfig.nome_cooperativa
          document.title = `${nomeApp} — Gestão Cooperativa`
        }
      }

      setCiclos(rawCiclos)
      const currentActive = rawCiclos.find((c) => c.status !== 'fechado') || rawCiclos[0] || null
      setActiveCiclo(currentActive)
      setRotas(rawRotas)
      setRotasLogisticas(rawRotasLogisticas)
      setParadasRota(rawParadasRota)
      setDespachos(rawDespachos)
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
        email: s.email || '',
        tipo: s.tipo || '',
        alunos: s.alunos !== undefined && s.alunos !== null ? Number(s.alunos) : undefined,
      }))
      setSchools(mappedSchools)

      // Mapa escola -> parada_rota mais recente para derivar a Rota Logística da Escola
      // O roteamento e despacho operam sobre ESCOLAS: pedidos herdam a rota da escola.
      const escolaParadaMap = new Map<string, ParadaRotaRecord>()
      for (const p of rawParadasRota) {
        if (!escolaParadaMap.has(p.escola_id)) {
          escolaParadaMap.set(p.escola_id, p)
        }
      }

      // Map pedidos with items, rota, ciclo and validation
      const mappedOrders: Order[] = rawPedidos.map((ped) => {
        const schoolObj = mappedSchools.find((s) => s.id === ped.escola_id)
        const schoolName =
          ped.expand?.escola_id?.nome || schoolObj?.name || 'Escola não identificada'

        const rotaObj = rawRotas.find((r) => r.id === ped.rota_id)
        const rotaNome = ped.expand?.rota_id?.nome || rotaObj?.nome || schoolObj?.route

        // Derivar Rota Logística prioritariamente da ESCOLA (paradas_rota) e fallback para ped.rota_logistica_id
        const paradaEscola = escolaParadaMap.get(ped.escola_id)
        const effectiveRotaLogisticaId = paradaEscola?.rota_logistica_id || ped.rota_logistica_id
        const rotaLogObj = rawRotasLogisticas.find((r) => r.id === effectiveRotaLogisticaId)
        const rotaLogisticaNome = rotaLogObj?.nome || ped.expand?.rota_logistica_id?.nome

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

        const entreguePorNome =
          ped.expand?.entregue_por?.nome ||
          ped.expand?.entregue_por?.name ||
          ped.expand?.entregue_por?.email ||
          ''

        const motivoCancel = ped.motivo_cancelamento || ped.cancelamento_motivo

        return {
          id: ped.id,
          numero: ped.numero,
          schoolId: ped.escola_id,
          schoolName,
          schoolAlunos: schoolObj?.alunos,
          cicloId: ped.ciclo_id,
          origem: ped.origem || 'manual',
          rotaId: ped.rota_id,
          rotaNome,
          rotaLogisticaId: effectiveRotaLogisticaId,
          rotaLogisticaNome,
          validacao: rawValidacao,
          date:
            ped.data_prevista ||
            ped.created?.split('T')[0] ||
            new Date().toISOString().split('T')[0],
          status: ped.status,
          entregue_em: ped.entregue_em,
          entregue_por: ped.entregue_por,
          entreguePorNome,
          cancelamento_motivo: motivoCancel,
          motivo_cancelamento: motivoCancel,
          cancelado_em: ped.cancelado_em,
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
            escolaEmail: ce.expand?.escola_id?.email || sch?.email || '',
            escolaTipo: ce.expand?.escola_id?.tipo || sch?.tipo || '',
            escolaAlunos: ce.expand?.escola_id?.alunos ?? sch?.alunos,
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
          numero_chamada: c.numero_chamada || '',
          tipo: c.tipo || 'PNAE',
          modalidade_pedido: c.modalidade_pedido || 'individualizado',
          num_rotas_logisticas:
            c.num_rotas_logisticas !== undefined && c.num_rotas_logisticas !== null
              ? Number(c.num_rotas_logisticas)
              : undefined,
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
          arquivo: a.arquivo,
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
  useRealtime('rotas_logisticas', () => loadAllData())
  useRealtime('paradas_rota', () => loadAllData())
  useRealtime('despachos', () => loadAllData())
  useRealtime('configuracoes', () => loadAllData())

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

      // Herança automática da Rota Logística da Escola
      let rotaLogisticaIdFinal = orderData.rotaLogisticaId
      if (!rotaLogisticaIdFinal) {
        const paradaDaEscola = paradasRota.find((p) => p.escola_id === orderData.schoolId)
        if (paradaDaEscola) {
          rotaLogisticaIdFinal = paradaDaEscola.rota_logistica_id
        }
      }

      await pedidosService.create({
        numero,
        escola_id: orderData.schoolId,
        ciclo_id: orderData.cicloId || activeCiclo?.id,
        origem: orderData.origem || 'manual',
        rota_id: rotaId,
        rota_logistica_id: rotaLogisticaIdFinal,
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

  const updateOrderStatus = async (
    id: string,
    status: Order['status'],
    options?: {
      cancelamento_motivo?: string
      motivo_cancelamento?: string
      entregue_em?: string
      entregue_por?: string
      cancelado_em?: string
      rota_logistica_id?: string
    },
  ): Promise<boolean> => {
    try {
      const targetOrder = orders.find((o) => o.id === id)
      if (!targetOrder) {
        toast.error('Pedido não encontrado.')
        return false
      }

      // Regra: Pedido Cancelado não pode voltar
      if (targetOrder.status === 'Cancelado') {
        toast.error('Pedidos cancelados não podem ter seu status alterado.')
        return false
      }

      // Se a transição for para Entregue, chamar método especializado com baixa de estoque
      if (status === 'Entregue') {
        return await confirmarEntregaPedido(id, options?.entregue_por)
      }

      // Se a transição for para Cancelado, motivo é obrigatório
      if (status === 'Cancelado') {
        const motivo = (options?.motivo_cancelamento || options?.cancelamento_motivo)?.trim()
        if (!motivo) {
          toast.error('Motivo do cancelamento é obrigatório.')
          return false
        }
        const isEmRota = targetOrder.status === 'Em Rota'
        return await cancelarPedido(id, motivo, isEmRota)
      }

      // Transição padrão (ex: Pendente -> Em Rota)
      await pedidosService.updateStatus(id, status, options)
      await loadAllData()
      toast.success(`Status do pedido atualizado para "${status}".`)
      return true
    } catch (err: any) {
      console.error('Erro ao atualizar status do pedido:', err)
      toast.error('Falha ao atualizar status.')
      return false
    }
  }

  const confirmarEntregaPedido = async (id: string, userId?: string): Promise<boolean> => {
    try {
      const targetOrder = orders.find((o) => o.id === id)
      if (!targetOrder) {
        toast.error('Pedido não encontrado.')
        return false
      }

      if (targetOrder.status === 'Cancelado') {
        toast.error('Não é possível entregar um pedido cancelado.')
        return false
      }

      if (targetOrder.status === 'Entregue') {
        toast.info('Este pedido já foi confirmado como entregue anteriormente.')
        return true
      }

      const nowIso = new Date().toISOString()

      // 1. Atualizar pedido para Entregue registrando entregue_em e entregue_por
      await pedidosService.updateStatus(id, 'Entregue', {
        entregue_em: nowIso,
        entregue_por: userId || undefined,
      })

      // 2. Dar baixa no estoque dos produtos do pedido (idempotente: só executa quando não estava Entregue)
      for (const item of targetOrder.items) {
        if (item.productId && item.quantity > 0) {
          try {
            await produtosService.decrementarEstoque(item.productId, item.quantity)
          } catch (stkErr) {
            console.error(`Erro ao baixar estoque do produto ${item.productId}:`, stkErr)
          }
        }
      }

      await loadAllData()
      toast.success(`Pedido ${targetOrder.numero} entregue com sucesso! Estoque atualizado.`)
      return true
    } catch (err: any) {
      console.error('Erro ao confirmar entrega do pedido:', err)
      toast.error('Falha ao confirmar entrega do pedido.')
      return false
    }
  }

  const cancelarPedido = async (id: string, motivo: string, isEmRota = false): Promise<boolean> => {
    try {
      const targetOrder = orders.find((o) => o.id === id)
      if (!targetOrder) {
        toast.error('Pedido não encontrado.')
        return false
      }

      if (targetOrder.status === 'Cancelado') {
        toast.info('Este pedido já está cancelado.')
        return true
      }

      if (targetOrder.status === 'Entregue') {
        toast.error('Não é possível cancelar um pedido já entregue.')
        return false
      }

      if (!motivo || !motivo.trim()) {
        toast.error('Informe obrigatoriamente o motivo do cancelamento.')
        return false
      }

      const nowIso = new Date().toISOString()
      const cleanMotivo = motivo.trim()

      await pedidosService.updateStatus(id, 'Cancelado', {
        motivo_cancelamento: cleanMotivo,
        cancelamento_motivo: cleanMotivo,
        cancelado_em: nowIso,
      })

      await loadAllData()
      toast.success(`Pedido ${targetOrder.numero} foi cancelado definitivamente.`)
      return true
    } catch (err: any) {
      console.error('Erro ao cancelar pedido:', err)
      toast.error('Falha ao cancelar pedido.')
      return false
    }
  }

  // 6. DESPACHO: Botão "Colocar em Rota" por rota logística que despacha a rota inteira
  // Despacha TODOS os pedidos do ciclo ativo cujas ESCOLAS estão na rota (via paradas_rota)
  const despacharRotaInteira = async (
    rotaLogisticaId: string,
    contratoId: string,
    userId?: string,
  ): Promise<boolean> => {
    try {
      // Escolas que pertencem a esta rota logística (via paradas_rota)
      const escolasDaRota = new Set(
        paradasRota.filter((p) => p.rota_logistica_id === rotaLogisticaId).map((p) => p.escola_id),
      )

      // Identificar pedidos pendentes do ciclo ativo (ou pendentes em geral) cujas escolas estão na rota
      const pedidosDaRota = orders.filter((o) => {
        if (o.status !== 'Pendente') return false
        // Se pertencer ao ciclo ativo quando houver ciclo ativo
        if (activeCiclo?.id && o.cicloId && o.cicloId !== activeCiclo.id) return false
        // Escola da parada OU rotaLogisticaId explicitamente configurado
        return escolasDaRota.has(o.schoolId) || o.rotaLogisticaId === rotaLogisticaId
      })

      if (pedidosDaRota.length === 0) {
        toast.info('Não há pedidos pendentes no ciclo ativo para as escolas desta rota.')
        return false
      }

      const nowIso = new Date().toISOString()

      // 1. Criar registro na collection despachos
      await rotasLogisticasService.criarDespacho({
        contrato_id: contratoId,
        ciclo_id: activeCiclo?.id || undefined,
        rota_logistica_id: rotaLogisticaId,
        usuario_id: userId,
        data_despacho: nowIso,
        status: 'Em Rota',
      })

      // 2. Passar todos os pedidos pendentes dela para "Em Rota"
      for (const p of pedidosDaRota) {
        await pedidosService.updateStatus(p.id, 'Em Rota')
      }

      await loadAllData()
      toast.success(
        `Rota logística despachada com sucesso! ${pedidosDaRota.length} pedido(s) colocados "Em Rota".`,
      )
      return true
    } catch (err: any) {
      console.error('Erro ao despachar rota inteira:', err)
      toast.error('Falha ao despachar rota logística.')
      return false
    }
  }

  // 7. ENTREGA POR ROTA INTEIRA (operação offline): botão "Rota Entregue" marca TODOS os pedidos "Em Rota" dela como Entregue
  const confirmarEntregaRotaInteira = async (
    rotaLogisticaId: string,
    userId?: string,
  ): Promise<boolean> => {
    try {
      const escolasDaRota = new Set(
        paradasRota.filter((p) => p.rota_logistica_id === rotaLogisticaId).map((p) => p.escola_id),
      )

      const pedidosEmRota = orders.filter((o) => {
        if (o.status !== 'Em Rota') return false
        return escolasDaRota.has(o.schoolId) || o.rotaLogisticaId === rotaLogisticaId
      })

      if (pedidosEmRota.length === 0) {
        toast.info('Não há pedidos "Em Rota" nesta rota logística para confirmar entrega.')
        return false
      }

      const nowIso = new Date().toISOString()

      // Para cada pedido "Em Rota", marcar como Entregue e dar baixa no estoque dos itens
      for (const ped of pedidosEmRota) {
        await pedidosService.updateStatus(ped.id, 'Entregue', {
          entregue_em: nowIso,
          entregue_por: userId,
        })

        // Baixa no estoque
        for (const it of ped.items) {
          if (it.productId && it.quantity > 0) {
            try {
              await produtosService.decrementarEstoque(it.productId, it.quantity)
            } catch (stkErr) {
              console.error(`Erro ao baixar estoque do produto ${it.productId}:`, stkErr)
            }
          }
        }
      }

      // Atualizar status do despacho ativo se existir
      const despachosAtivos = despachos.filter(
        (d) => d.rota_logistica_id === rotaLogisticaId && d.status === 'Em Rota',
      )
      for (const d of despachosAtivos) {
        await rotasLogisticasService.atualizarStatusDespacho(d.id, 'Entregue')
      }

      await loadAllData()
      toast.success(
        `Rota confirmada como entregue! ${pedidosEmRota.length} pedido(s) finalizados e estoque baixado.`,
      )
      return true
    } catch (err: any) {
      console.error('Erro ao confirmar entrega da rota inteira:', err)
      toast.error('Falha ao confirmar entrega da rota logística.')
      return false
    }
  }

  // 8. CANCELAMENTO: botão "Não entregue" após despacho (Em Rota) -> Cancelado DEFINITIVAMENTE com motivo logístico
  const marcarNaoEntreguePedido = async (
    pedidoId: string,
    motivoLogistico: string,
    userId?: string,
  ): Promise<boolean> => {
    try {
      const targetOrder = orders.find((o) => o.id === pedidoId)
      if (!targetOrder) {
        toast.error('Pedido não encontrado.')
        return false
      }

      if (targetOrder.status !== 'Em Rota') {
        toast.error(
          'A marcação de "Não entregue" aplica-se apenas a pedidos despachados ("Em Rota").',
        )
        return false
      }

      const nowIso = new Date().toISOString()
      const cleanMotivo = motivoLogistico.trim()

      await pedidosService.updateStatus(pedidoId, 'Cancelado', {
        motivo_cancelamento: cleanMotivo,
        cancelamento_motivo: cleanMotivo,
        cancelado_em: nowIso,
        entregue_por: userId,
      })

      await loadAllData()
      toast.success(
        `Pedido ${targetOrder.numero} marcado como "Não entregue" e cancelado definitivamente por motivo logístico.`,
      )
      return true
    } catch (err: any) {
      console.error('Erro ao marcar pedido como não entregue:', err)
      toast.error('Falha ao processar não entrega.')
      return false
    }
  }

  // Criar nova rota logística para um contrato
  const criarRotaLogistica = async (data: {
    contrato_id: string
    nome: string
    ordem?: number
    ativa?: boolean
  }): Promise<RotaLogisticaRecord | null> => {
    try {
      const created = await rotasLogisticasService.create(data)
      await loadAllData()
      toast.success(`Rota logística "${data.nome}" criada com sucesso!`)
      return created
    } catch (err: any) {
      console.error('Erro ao criar rota logística:', err)
      toast.error('Falha ao criar rota logística.')
      return null
    }
  }

  // Excluir rota logística
  const excluirRotaLogistica = async (id: string): Promise<boolean> => {
    try {
      // Checar se há pedidos com status Em Rota ou Entregue vinculados a esta rota
      const pedidosComEstaRota = orders.filter((o) => o.rotaLogisticaId === id)
      const impedemExclusao = pedidosComEstaRota.filter((o) => o.status === 'Em Rota')
      if (impedemExclusao.length > 0) {
        toast.error('Não é possível excluir uma rota com pedidos em andamento ("Em Rota").')
        return false
      }

      // Desvincular paradas cadastradas
      const paradas = paradasRota.filter((p) => p.rota_logistica_id === id)
      for (const p of paradas) {
        await rotasLogisticasService.removerParada(p.id)
      }

      // Desvincular pedidos pendentes
      for (const p of pedidosComEstaRota) {
        if (p.status === 'Pendente') {
          await pedidosService.atribuirRotaLogistica(p.id, '')
        }
      }

      await rotasLogisticasService.delete(id)
      await loadAllData()
      toast.success('Rota logística excluída com sucesso!')
      return true
    } catch (err: any) {
      console.error('Erro ao excluir rota logística:', err)
      toast.error('Falha ao excluir rota logística.')
      return false
    }
  }

  // Sincronizar escolas atribuídas a uma rota logística:
  // Preenche paradas_rota, atualiza pedidos pendentes dessas escolas e limpa as desatribuídas
  const sincronizarEscolasRotaLogistica = async (
    contratoId: string,
    rotaLogisticaId: string,
    escolaIds: string[],
    _pedidoIdsIgnorado?: string[],
  ): Promise<boolean> => {
    try {
      const rotaLog = rotasLogisticas.find((r) => r.id === rotaLogisticaId)
      const nomeRota = rotaLog?.nome || 'Rota'

      // Identificar escolas que estavam antes nesta rota
      const paradasAnteriores = paradasRota.filter((p) => p.rota_logistica_id === rotaLogisticaId)
      const escolasAnterioresIds = paradasAnteriores.map((p) => p.escola_id)
      const novasEscolasSet = new Set(escolaIds)
      const escolasDesatribuidas = escolasAnterioresIds.filter((id) => !novasEscolasSet.has(id))

      // Garantir ou buscar registro na collection `rotas` com esse nome no contrato para coerência de FK rota_id
      let rotaRefId: string | undefined
      const existingRotasContrato = rotas.filter((r) => r.contrato_id === contratoId)
      const match = existingRotasContrato.find(
        (r) => r.nome.trim().toLowerCase() === nomeRota.trim().toLowerCase(),
      )
      if (match) {
        rotaRefId = match.id
      } else {
        try {
          const createdRotaRef = await rotasService.create({
            contrato_id: contratoId,
            nome: nomeRota,
            ordem: existingRotasContrato.length + 1,
          })
          rotaRefId = createdRotaRef.id
        } catch (_) {
          // Fallback se não conseguir criar na collection rotas
        }
      }

      // 1. Atualizar vínculo no contrato (contrato_escolas.rota_id)
      if (rotaRefId) {
        for (const escId of escolaIds) {
          try {
            await contratosService.updateEscolaRotaByContratoEscola(contratoId, escId, rotaRefId)
          } catch (linkErr) {
            console.warn(`Erro ao sincronizar contrato_escolas para escola ${escId}:`, linkErr)
          }
        }
      }

      // 2. Salvar paradas na collection paradas_rota mantendo ordem existente se houver, ou sequencial
      const ordemExistenteMap = new Map<string, number>()
      paradasAnteriores.forEach((p) => ordemExistenteMap.set(p.escola_id, p.ordem))

      const paradasPayload = escolaIds.map((escolaId, idx) => ({
        escola_id: escolaId,
        ordem: ordemExistenteMap.get(escolaId) || idx + 1,
      }))
      // Normalizar ordem 1..N
      paradasPayload.sort((a, b) => a.ordem - b.ordem)
      const paradasPayloadNormalizadas = paradasPayload.map((p, idx) => ({
        escola_id: p.escola_id,
        ordem: idx + 1,
      }))
      await rotasLogisticasService.reordenarParadas(rotaLogisticaId, paradasPayloadNormalizadas)

      // 3. Atualizar pedidos pendentes das escolas atribuídas: recebem rota_logistica_id
      const pedidosPendentesAtribuidos = orders.filter(
        (o) => o.status === 'Pendente' && escolaIds.includes(o.schoolId),
      )
      for (const ped of pedidosPendentesAtribuidos) {
        if (ped.rotaLogisticaId !== rotaLogisticaId) {
          await pedidosService.atribuirRotaLogistica(ped.id, rotaLogisticaId)
        }
      }

      // 4. Limpar rota_logistica_id dos pedidos pendentes das escolas desatribuídas
      if (escolasDesatribuidas.length > 0) {
        const pedidosPendentesDesatribuidos = orders.filter(
          (o) =>
            o.status === 'Pendente' &&
            escolasDesatribuidas.includes(o.schoolId) &&
            o.rotaLogisticaId === rotaLogisticaId,
        )
        for (const ped of pedidosPendentesDesatribuidos) {
          await pedidosService.atribuirRotaLogistica(ped.id, '')
        }
      }

      await loadAllData()
      toast.success(
        `Rota "${nomeRota}" configurada com ${escolaIds.length} escola(s) e vínculos atualizados!`,
      )
      return true
    } catch (err: any) {
      console.error('Erro ao sincronizar escolas da rota logística:', err)
      toast.error('Falha ao sincronizar escolas e rotas.')
      return false
    }
  }

  // 4. ROTEAMENTO POR CONTRATO: Atribuir pedidos pendentes a rota logística
  const atribuirPedidosARotaLogistica = async (
    pedidoIds: string[],
    rotaLogisticaId: string,
  ): Promise<boolean> => {
    try {
      const rotaLog = rotasLogisticas.find((r) => r.id === rotaLogisticaId)
      const contratoId = rotaLog?.contrato_id

      for (const pid of pedidoIds) {
        await pedidosService.atribuirRotaLogistica(pid, rotaLogisticaId)
      }

      // COERÊNCIA DE DADOS: quando pedidos das escolas forem atribuídos a esta rota,
      // sincronizar também o vínculo em contrato_escolas se houver contrato identificado
      if (rotaLog && contratoId) {
        const pedEscolaIds = new Set(
          orders.filter((o) => pedidoIds.includes(o.id)).map((o) => o.schoolId),
        )

        let rotaRefId: string | undefined
        const match = rotas.find(
          (r) =>
            r.contrato_id === contratoId &&
            r.nome.trim().toLowerCase() === rotaLog.nome.trim().toLowerCase(),
        )
        if (match) {
          rotaRefId = match.id
        } else {
          try {
            const created = await rotasService.create({
              contrato_id: contratoId,
              nome: rotaLog.nome,
              ordem: rotas.filter((r) => r.contrato_id === contratoId).length + 1,
            })
            rotaRefId = created.id
          } catch {
            /* intentionally ignored */
          }
        }

        if (rotaRefId) {
          for (const escId of pedEscolaIds) {
            try {
              await contratosService.updateEscolaRotaByContratoEscola(contratoId, escId, rotaRefId)
            } catch {
              /* intentionally ignored */
            }
          }
        }
      }

      await loadAllData()
      toast.success(`${pedidoIds.length} pedido(s) atribuído(s) à rota logística com sucesso!`)
      return true
    } catch (err: any) {
      console.error('Erro ao atribuir pedidos à rota logística:', err)
      toast.error('Falha ao salvar atribuição de rota.')
      return false
    }
  }

  // 5. SEQUENCIAMENTO DAS PARADAS: Salvar paradas ordenadas
  const salvarSequenciamentoParadas = async (
    rotaLogisticaId: string,
    paradas: Array<{ escola_id: string; ordem: number }>,
  ): Promise<boolean> => {
    try {
      await rotasLogisticasService.reordenarParadas(rotaLogisticaId, paradas)
      await loadAllData()
      return true
    } catch (err: any) {
      console.error('Erro ao salvar sequenciamento de paradas:', err)
      toast.error('Falha ao salvar sequência de paradas.')
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

  const generateAtesto = async (
    orderId: string,
    pdfBlob?: Blob,
    customNumero?: string,
  ): Promise<AtestoRecord | null> => {
    try {
      const order = orders.find((o) => o.id === orderId)
      if (!order) {
        toast.error('Pedido não encontrado.')
        return null
      }

      const existing = atestos.find((a) => a.orderId === orderId)
      if (existing) {
        toast.info('Já existe atesto emitido para este pedido.')
        return null
      }

      const atestoCount = atestos.length + 1
      const numero = customNumero || `AT-${String(atestoCount).padStart(3, '0')}`
      const now = new Date().toISOString()

      const created = await atestosService.create({
        numero,
        pedido_id: orderId,
        data_emissao: now,
        status: 'Pendente Assinatura',
        arquivo: pdfBlob,
      })

      await loadAllData()
      return created
    } catch (err: any) {
      console.error('Erro ao gerar atesto:', err)
      const detailMsg =
        err?.data?.message ||
        err?.response?.message ||
        err?.message ||
        'Falha ao gerar atesto no banco.'
      toast.error(`Falha ao gerar atesto no banco: ${detailMsg}`)
      return null
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
        rotasLogisticas,
        paradasRota,
        despachos,
        config,
        logoUrl,
        isLoading,
        error,
        refreshData: loadAllData,
        addOrder,
        updateOrderStatus,
        confirmarEntregaPedido,
        cancelarPedido,
        criarRotaLogistica,
        excluirRotaLogistica,
        sincronizarEscolasRotaLogistica,
        despacharRotaInteira,
        confirmarEntregaRotaInteira,
        marcarNaoEntreguePedido,
        atribuirPedidosARotaLogistica,
        salvarSequenciamentoParadas,
        updateCicloStatus,
        createCiclo,
        generateAtesto,
        confirmAtesto,
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
