import { useState, useMemo } from 'react'
import { useApp } from '@/context/app-context'
import { useAuth } from '@/context/auth-context'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Label } from '@/components/ui/label'
import {
  Truck,
  Layers,
  CheckCircle2,
  Play,
  Loader2,
  Package,
  UserCheck,
  Building2,
  GripVertical,
  SlidersHorizontal,
  XCircle,
  AlertTriangle,
  ArrowUpDown,
  FileCheck2,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  MOTIVOS_LOGISTICOS_CANCELAMENTO,
  type MotivoLogisticoCancelamento,
  type Order,
  type RotaLogisticaRecord,
} from '@/lib/types'

export default function DeliveryRoutes() {
  const {
    contracts,
    orders,
    schools,
    rotasLogisticas,
    paradasRota,
    despachos,
    despacharRotaInteira,
    confirmarEntregaRotaInteira,
    marcarNaoEntreguePedido,
    atribuirPedidosARotaLogistica,
    salvarSequenciamentoParadas,
    updateOrderStatus,
  } = useApp()
  const { user } = useAuth()

  // Selecionar contrato ativo para roteamento e despacho
  const [selectedContratoId, setSelectedContratoId] = useState<string>(contracts[0]?.id || 'todos')

  // Estado para montagem/atribuição de roteamento
  const [routingDialogOpen, setRoutingDialogOpen] = useState(false)
  const [selectedRotaForRouting, setSelectedRotaForRouting] = useState<RotaLogisticaRecord | null>(
    null,
  )
  const [selectedOrdersToAssign, setSelectedOrdersToAssign] = useState<string[]>([])
  const [isSavingAssignment, setIsSavingAssignment] = useState(false)

  // Estado para confirmação de despacho da rota inteira
  const [dispatchConfirmOpen, setDispatchConfirmOpen] = useState(false)
  const [rotaToDispatch, setRotaToDispatch] = useState<RotaLogisticaRecord | null>(null)
  const [isDispatching, setIsDispatching] = useState(false)

  // Estado para confirmação de rota entregue (rota inteira)
  const [deliverWholeRouteOpen, setDeliverWholeRouteOpen] = useState(false)
  const [rotaToDeliver, setRotaToDeliver] = useState<RotaLogisticaRecord | null>(null)
  const [isDeliveringWholeRoute, setIsDeliveringWholeRoute] = useState(false)

  // Estado para cancelamento por "Não entregue" após despacho (motivo logístico fixo)
  const [undeliveredDialogOpen, setUndeliveredDialogOpen] = useState(false)
  const [orderForUndelivered, setOrderForUndelivered] = useState<Order | null>(null)
  const [selectedMotivoLogistico, setSelectedMotivoLogistico] =
    useState<MotivoLogisticoCancelamento>(MOTIVOS_LOGISTICOS_CANCELAMENTO[0])
  const [detalheMotivoLogistico, setDetalheMotivoLogistico] = useState('')
  const [isProcessingUndelivered, setIsProcessingUndelivered] = useState(false)

  // Estado de Drag and Drop para reordenamento de paradas
  const [draggedEscolaId, setDraggedEscolaId] = useState<string | null>(null)
  const [dragOverEscolaId, setDragOverEscolaId] = useState<string | null>(null)

  // Contrato atualmente focado
  const currentContrato = useMemo(() => {
    if (selectedContratoId === 'todos') return null
    return contracts.find((c) => c.id === selectedContratoId) || null
  }, [contracts, selectedContratoId])

  // Rotas logísticas filtradas pelo contrato selecionado
  const filteredRotasLogisticas = useMemo(() => {
    let list = rotasLogisticas
    if (selectedContratoId !== 'todos') {
      list = list.filter((r) => r.contrato_id === selectedContratoId)
    }

    // Regra 3: O despacho e o sequenciamento só operam sobre rotas dentro do limite definido no contrato
    if (currentContrato?.num_rotas_logisticas) {
      list = list.slice(0, currentContrato.num_rotas_logisticas)
    }
    return list
  }, [rotasLogisticas, selectedContratoId, currentContrato])

  // Pedidos que pertencem ao contrato selecionado (via escolas do contrato)
  const contratoOrders = useMemo(() => {
    if (!currentContrato) return orders
    const schoolIds = new Set(currentContrato.escolas.map((e) => e.escolaId))
    return orders.filter((o) => schoolIds.has(o.schoolId))
  }, [orders, currentContrato])

  // Detalhes completos por rota logística
  const rotasLogisticasDetalhes = useMemo(() => {
    return filteredRotasLogisticas.map((rota) => {
      const contrato = contracts.find((c) => c.id === rota.contrato_id)
      const contratoEscolaIds = new Set(contrato?.escolas.map((e) => e.escolaId) || [])

      // Pedidos explicitamente atribuídos a esta rota logística
      const pedidosDaRota = orders.filter((o) => o.rotaLogisticaId === rota.id)

      // Se um pedido do contrato ainda não tiver rotaLogisticaId mas pertencer a este contrato,
      // ele fica como "não atribuído" para roteamento.
      const pedidosPendentes = pedidosDaRota.filter((o) => o.status === 'Pendente')
      const pedidosEmRota = pedidosDaRota.filter((o) => o.status === 'Em Rota')
      const pedidosEntregues = pedidosDaRota.filter((o) => o.status === 'Entregue')
      const pedidosCancelados = pedidosDaRota.filter((o) => o.status === 'Cancelado')

      // Paradas cadastradas no banco (collection paradas_rota)
      const paradasCadastradas = paradasRota
        .filter((p) => p.rota_logistica_id === rota.id)
        .sort((a, b) => a.ordem - b.ordem)

      // Identificar todas as escolas atendidas por esta rota:
      // a) Escolas das paradas cadastradas no banco
      // b) Escolas dos pedidos atribuídos a esta rota
      const escolaMap = new Map<
        string,
        { id: string; nome: string; endereco: string; alunos?: number }
      >()

      for (const p of paradasCadastradas) {
        const sch = schools.find((s) => s.id === p.escola_id)
        if (sch) {
          escolaMap.set(sch.id, {
            id: sch.id,
            nome: sch.name,
            endereco: sch.address,
            alunos: sch.alunos,
          })
        }
      }

      for (const ped of pedidosDaRota) {
        if (!escolaMap.has(ped.schoolId)) {
          const sch = schools.find((s) => s.id === ped.schoolId)
          if (sch) {
            escolaMap.set(sch.id, {
              id: sch.id,
              nome: sch.name,
              endereco: sch.address,
              alunos: sch.alunos,
            })
          }
        }
      }

      // Montar lista ordenada de paradas
      const paradasOrdenadas: Array<{
        escolaId: string
        nome: string
        endereco: string
        alunos?: number
        ordem: number
        pedidos: Order[]
      }> = []

      // Primeiro adicionar as que têm ordem salva
      const adicionadas = new Set<string>()
      paradasCadastradas.forEach((p, idx) => {
        const sch = escolaMap.get(p.escola_id)
        if (sch) {
          const peds = pedidosDaRota.filter((o) => o.schoolId === sch.id)
          paradasOrdenadas.push({
            escolaId: sch.id,
            nome: sch.nome,
            endereco: sch.endereco,
            alunos: sch.alunos,
            ordem: idx + 1,
            pedidos: peds,
          })
          adicionadas.add(sch.id)
        }
      })

      // Depois adicionar escolas de novos pedidos que ainda não estavam na sequência
      escolaMap.forEach((sch) => {
        if (!adicionadas.has(sch.id)) {
          const peds = pedidosDaRota.filter((o) => o.schoolId === sch.id)
          paradasOrdenadas.push({
            escolaId: sch.id,
            nome: sch.nome,
            endereco: sch.endereco,
            alunos: sch.alunos,
            ordem: paradasOrdenadas.length + 1,
            pedidos: peds,
          })
        }
      })

      // Último despacho realizado desta rota
      const ultimoDespacho = despachos
        .filter((d) => d.rota_logistica_id === rota.id)
        .sort(
          (a, b) => new Date(b.data_despacho).getTime() - new Date(a.data_despacho).getTime(),
        )[0]

      const volumeTotal = pedidosDaRota.reduce(
        (acc, p) => acc + p.items.reduce((sum, it) => sum + it.quantity, 0),
        0,
      )
      const valorTotal = pedidosDaRota.reduce((acc, p) => acc + p.total, 0)

      return {
        rota,
        contratoNumero: contrato?.numero || 'Sem contrato',
        modalidade: contrato?.modalidade_pedido || 'individualizado',
        pedidosDaRota,
        pedidosPendentes,
        pedidosEmRota,
        pedidosEntregues,
        pedidosCancelados,
        paradasOrdenadas,
        ultimoDespacho,
        volumeTotal,
        valorTotal,
      }
    })
  }, [filteredRotasLogisticas, contracts, orders, schools, paradasRota, despachos])

  // Pedidos do contrato pendentes que ainda NÃO foram atribuídos a nenhuma rota logística
  // ou podem ser reatribuídos
  const pedidosNaoAtribuidos = useMemo(() => {
    return contratoOrders.filter((o) => o.status === 'Pendente' && !o.rotaLogisticaId)
  }, [contratoOrders])

  // Despacho: Abrir modal de confirmação para colocar rota inteira em rota
  const handleOpenDispatch = (rota: RotaLogisticaRecord) => {
    setRotaToDispatch(rota)
    setDispatchConfirmOpen(true)
  }

  // Despacho: Executar colocação da rota inteira em rota
  const handleConfirmDispatch = async () => {
    if (!rotaToDispatch) return
    setIsDispatching(true)
    try {
      await despacharRotaInteira(rotaToDispatch.id, rotaToDispatch.contrato_id, user?.id)
      setDispatchConfirmOpen(false)
      setRotaToDispatch(null)
    } finally {
      setIsDispatching(false)
    }
  }

  // Entrega: Abrir modal para confirmar que a rota inteira foi entregue
  const handleOpenDeliverWholeRoute = (rota: RotaLogisticaRecord) => {
    setRotaToDeliver(rota)
    setDeliverWholeRouteOpen(true)
  }

  // Entrega: Executar confirmação de rota entregue
  const handleConfirmDeliverWholeRoute = async () => {
    if (!rotaToDeliver) return
    setIsDeliveringWholeRoute(true)
    try {
      await confirmarEntregaRotaInteira(rotaToDeliver.id, user?.id)
      setDeliverWholeRouteOpen(false)
      setRotaToDeliver(null)
    } finally {
      setIsDeliveringWholeRoute(false)
    }
  }

  // Cancelamento: Abrir modal de "Não entregue" após despacho (pedido Em Rota)
  const handleOpenUndelivered = (order: Order) => {
    setOrderForUndelivered(order)
    setSelectedMotivoLogistico(MOTIVOS_LOGISTICOS_CANCELAMENTO[0])
    setDetalheMotivoLogistico('')
    setUndeliveredDialogOpen(true)
  }

  // Cancelamento: Executar marcação de não entregue definitiva
  const handleExecuteUndelivered = async () => {
    if (!orderForUndelivered) return
    setIsProcessingUndelivered(true)
    try {
      const motivoCompleto = detalheMotivoLogistico.trim()
        ? `${selectedMotivoLogistico}: ${detalheMotivoLogistico.trim()}`
        : selectedMotivoLogistico

      await marcarNaoEntreguePedido(orderForUndelivered.id, motivoCompleto, user?.id)
      setUndeliveredDialogOpen(false)
      setOrderForUndelivered(null)
    } finally {
      setIsProcessingUndelivered(false)
    }
  }

  // Roteamento por contrato: Abrir modal de montagem de roteamento
  const handleOpenRouting = (rota: RotaLogisticaRecord) => {
    setSelectedRotaForRouting(rota)
    // Pré-selecionar pedidos já vinculados ou pendentes sem rota
    const pedidosJaNaRota = orders
      .filter((o) => o.rotaLogisticaId === rota.id && o.status === 'Pendente')
      .map((o) => o.id)
    setSelectedOrdersToAssign(pedidosJaNaRota)
    setRoutingDialogOpen(true)
  }

  // Roteamento por contrato: Salvar atribuição de pedidos à rota logística
  const handleSaveRouting = async () => {
    if (!selectedRotaForRouting) return
    setIsSavingAssignment(true)
    try {
      await atribuirPedidosARotaLogistica(selectedOrdersToAssign, selectedRotaForRouting.id)
      setRoutingDialogOpen(false)
      setSelectedRotaForRouting(null)
    } finally {
      setIsSavingAssignment(false)
    }
  }

  // Drag and Drop nativo de sequenciamento de paradas
  const handleDragStart = (e: React.DragEvent, escolaId: string) => {
    setDraggedEscolaId(escolaId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', escolaId)
  }

  const handleDragOver = (e: React.DragEvent, escolaId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverEscolaId !== escolaId) {
      setDragOverEscolaId(escolaId)
    }
  }

  const handleDrop = async (
    e: React.DragEvent,
    targetEscolaId: string,
    rotaId: string,
    currentParadas: Array<{ escolaId: string; ordem: number }>,
  ) => {
    e.preventDefault()
    setDragOverEscolaId(null)
    const sourceEscolaId = draggedEscolaId || e.dataTransfer.getData('text/plain')
    setDraggedEscolaId(null)

    if (!sourceEscolaId || sourceEscolaId === targetEscolaId) return

    const sourceIndex = currentParadas.findIndex((p) => p.escolaId === sourceEscolaId)
    const targetIndex = currentParadas.findIndex((p) => p.escolaId === targetEscolaId)

    if (sourceIndex === -1 || targetIndex === -1) return

    // Reordenar a lista
    const reordered = [...currentParadas]
    const [movedItem] = reordered.splice(sourceIndex, 1)
    reordered.splice(targetIndex, 0, movedItem)

    // Recalcular ordens 1, 2, 3...
    const payload = reordered.map((item, idx) => ({
      escola_id: item.escolaId,
      ordem: idx + 1,
    }))

    // Salvar automaticamente no banco
    const ok = await salvarSequenciamentoParadas(rotaId, payload)
    if (ok) {
      toast.success('Sequência de paradas atualizada e gravada com sucesso!')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header e Seleção de Contrato */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Roteamento & Despacho Logístico</h1>
          <p className="text-muted-foreground text-sm">
            Gestão de rotas logísticas da cooperativa, sequenciamento drag-and-drop de paradas e
            despacho por rota inteira.
          </p>
        </div>

        {/* Filtro por Contrato */}
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary shrink-0" />
          <Select value={selectedContratoId} onValueChange={setSelectedContratoId}>
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Selecione o Contrato" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Contratos</SelectItem>
              {contracts.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.numero} ({c.num_rotas_logisticas || 2} rotas logísticas)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Alerta de Pedidos sem Rota Logística no Contrato Selecionado */}
      {selectedContratoId !== 'todos' && pedidosNaoAtribuidos.length > 0 && (
        <div className="p-3.5 rounded-lg border border-amber-500/30 bg-amber-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-amber-950 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <span>
              Existem <strong>{pedidosNaoAtribuidos.length} pedido(s) pendente(s)</strong> deste
              contrato sem rota logística atribuída. Monte o roteamento nas rotas abaixo.
            </span>
          </div>
          <Badge
            variant="outline"
            className="text-amber-700 bg-background border-amber-400 shrink-0 w-fit"
          >
            Aguardando atribuição
          </Badge>
        </div>
      )}

      {/* Grid de Rotas Logísticas da Cooperativa */}
      {filteredRotasLogisticas.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center text-muted-foreground">
            <Truck className="h-12 w-12 mx-auto mb-3 opacity-40 text-primary" />
            <p className="text-base font-semibold text-foreground">
              Nenhuma rota logística cadastrada para este contrato.
            </p>
            <p className="text-xs mt-1 max-w-md mx-auto">
              Acesse a tela de <strong>Contratos & Escolas</strong> para definir o número de rotas e
              cadastrar as rotas logísticas da cooperativa.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {rotasLogisticasDetalhes.map((item) => {
            const hasPendentes = item.pedidosPendentes.length > 0
            const hasEmRota = item.pedidosEmRota.length > 0
            const totalEmTransito = item.pedidosPendentes.length + item.pedidosEmRota.length

            return (
              <Card
                key={item.rota.id}
                className="flex flex-col border-t-4 border-t-primary shadow-sm hover:shadow-md transition-shadow"
              >
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg flex items-center gap-2 text-foreground font-bold">
                          <Truck className="h-5 w-5 text-primary" /> {item.rota.nome}
                        </CardTitle>
                        {hasEmRota && (
                          <Badge className="bg-amber-600 hover:bg-amber-600 text-white text-[10px] animate-pulse">
                            Em Rota
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="text-xs mt-0.5">
                        Contrato: <strong className="text-foreground">{item.contratoNumero}</strong>{' '}
                        • Modalidade: <span className="capitalize">{item.modalidade}</span>
                      </CardDescription>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => handleOpenRouting(item.rota)}
                        title="Atribuir pedidos a esta rota logística"
                      >
                        <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
                        Roteamento ({item.pedidosDaRota.length})
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 flex-1">
                  {/* Resumo de Carga da Rota */}
                  <div className="grid grid-cols-3 gap-2 text-xs p-2.5 rounded-lg bg-muted/30 border">
                    <div>
                      <span className="text-muted-foreground block text-[11px]">
                        Paradas / Escolas:
                      </span>
                      <p className="font-bold text-sm text-foreground">
                        {item.paradasOrdenadas.length} parada(s)
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[11px]">
                        Pedidos Ativos:
                      </span>
                      <p className="font-bold text-sm text-primary">{totalEmTransito} entrega(s)</p>
                    </div>
                    <div className="text-right">
                      <span className="text-muted-foreground block text-[11px]">Volume Total:</span>
                      <p className="font-mono font-bold text-sm text-foreground">
                        {item.volumeTotal} itens
                      </p>
                    </div>
                  </div>

                  {/* Ações de Despacho e Entrega por Rota Inteira */}
                  <div className="flex items-center justify-between p-2.5 rounded-lg border bg-primary/5 gap-2">
                    <div className="text-xs">
                      <span className="font-semibold text-primary block">
                        Controle de Despacho & Entrega:
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {item.ultimoDespacho
                          ? `Último despacho: ${new Date(item.ultimoDespacho.data_despacho).toLocaleDateString('pt-BR')} (${item.ultimoDespacho.status})`
                          : 'Rota aguardando despacho da central'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Botão Colocar em Rota (Rota Inteira) */}
                      {hasPendentes && (
                        <Button
                          size="sm"
                          className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white gap-1"
                          onClick={() => handleOpenDispatch(item.rota)}
                          title="Despacha a rota inteira: todos os pedidos passam de Pendente para Em Rota"
                        >
                          <Play className="h-3.5 w-3.5" /> Colocar em Rota
                        </Button>
                      )}

                      {/* Botão Rota Entregue (Operação Offline da Rota Inteira) */}
                      {hasEmRota && (
                        <Button
                          size="sm"
                          className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1 font-semibold"
                          onClick={() => handleOpenDeliverWholeRoute(item.rota)}
                          title="Confirma o retorno do veículo: marca TODOS os pedidos Em Rota como Entregue"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Rota Entregue
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Lista de Paradas com Sequenciamento Drag-and-Drop */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <ArrowUpDown className="h-3.5 w-3.5" /> Sequência de Paradas (Arraste para
                        Reordenar)
                      </h4>
                      <span className="text-[10px] text-muted-foreground">
                        {item.paradasOrdenadas.length} escola(s) atendida(s)
                      </span>
                    </div>

                    {item.paradasOrdenadas.length === 0 ? (
                      <div className="py-6 text-center text-muted-foreground border border-dashed rounded-lg text-xs">
                        Nenhum pedido ou parada vinculado a esta rota logística.
                        <div className="mt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => handleOpenRouting(item.rota)}
                          >
                            Atribuir Pedidos
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                        {item.paradasOrdenadas.map((parada) => {
                          const isOver = dragOverEscolaId === parada.escolaId

                          return (
                            <div
                              key={parada.escolaId}
                              draggable
                              onDragStart={(e) => handleDragStart(e, parada.escolaId)}
                              onDragOver={(e) => handleDragOver(e, parada.escolaId)}
                              onDrop={(e) =>
                                handleDrop(
                                  e,
                                  parada.escolaId,
                                  item.rota.id,
                                  item.paradasOrdenadas.map((p) => ({
                                    escolaId: p.escolaId,
                                    ordem: p.ordem,
                                  })),
                                )
                              }
                              className={`p-2.5 rounded-lg border bg-card text-xs space-y-2 shadow-xs transition-colors cursor-move ${
                                isOver
                                  ? 'border-primary border-2 bg-primary/10'
                                  : 'hover:border-primary/40'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <GripVertical className="h-4 w-4 text-muted-foreground/60 shrink-0" />
                                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground shrink-0">
                                    {parada.ordem}
                                  </span>
                                  <div>
                                    <p className="font-semibold text-foreground">{parada.nome}</p>
                                    <p className="text-[10px] text-muted-foreground">
                                      {parada.endereco || 'Endereço não informado'}
                                    </p>
                                  </div>
                                </div>

                                {/* Referência de Volume: Nº de Alunos da Escola */}
                                <div className="flex items-center gap-2 shrink-0">
                                  {parada.alunos !== undefined && parada.alunos !== null && (
                                    <Badge
                                      variant="secondary"
                                      className="text-[10px] font-mono font-medium"
                                      title="Número de alunos matriculados como referência de volume da escola"
                                    >
                                      {parada.alunos} alunos
                                    </Badge>
                                  )}
                                  <Badge variant="outline" className="text-[10px]">
                                    {parada.pedidos.length} pedido(s)
                                  </Badge>
                                </div>
                              </div>

                              {/* Pedidos vinculados a esta parada */}
                              {parada.pedidos.length > 0 && (
                                <div className="space-y-1.5 pl-7 border-l-2 border-primary/20 ml-2">
                                  {parada.pedidos.map((ped) => (
                                    <div
                                      key={ped.id}
                                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 rounded bg-muted/20 border text-xs"
                                    >
                                      <div>
                                        <div className="flex items-center gap-1.5">
                                          <span className="font-bold text-primary">
                                            {ped.numero}
                                          </span>
                                          <Badge
                                            className={`text-[9px] px-1.5 py-0 ${
                                              ped.status === 'Em Rota'
                                                ? 'bg-amber-600'
                                                : ped.status === 'Entregue'
                                                  ? 'bg-emerald-600'
                                                  : ped.status === 'Cancelado'
                                                    ? 'bg-destructive'
                                                    : 'bg-blue-600'
                                            }`}
                                          >
                                            {ped.status}
                                          </Badge>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground">
                                          {ped.items.length} produto(s) • R$ {ped.total.toFixed(2)}
                                        </p>
                                      </div>

                                      {/* Ações no pedido: se estiver Em Rota e motorista não entregou */}
                                      <div className="flex items-center gap-1.5 shrink-0">
                                        {ped.status === 'Em Rota' && (
                                          <Button
                                            size="sm"
                                            variant="destructive"
                                            className="h-6 text-[10px] px-2 gap-1"
                                            onClick={() => handleOpenUndelivered(ped)}
                                            title="Motorista não entregou este pedido: cancela definitivamente por motivo logístico"
                                          >
                                            <XCircle className="h-3 w-3" /> Não entregue
                                          </Button>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* MODAL 1: Montagem de Roteamento por Contrato (Template Persistente) */}
      <Dialog open={routingDialogOpen} onOpenChange={setRoutingDialogOpen}>
        <DialogContent className="sm:max-w-[560px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SlidersHorizontal className="h-5 w-5 text-primary" /> Montar Roteamento da Rota
              Logística
            </DialogTitle>
            <DialogDescription>
              Atribua pedidos pendentes à rota <strong>{selectedRotaForRouting?.nome}</strong>. Esta
              configuração fica persistente e é reaproveitada nos ciclos seguintes como template.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <p className="text-muted-foreground">
              Selecione os pedidos que serão atendidos por esta rota logística:
            </p>

            <div className="rounded border divide-y max-h-[300px] overflow-y-auto">
              {contratoOrders
                .filter((o) => o.status === 'Pendente')
                .map((ped) => {
                  const isChecked = selectedOrdersToAssign.includes(ped.id)
                  const isJaNaOutraRota =
                    ped.rotaLogisticaId && ped.rotaLogisticaId !== selectedRotaForRouting?.id

                  return (
                    <label
                      key={ped.id}
                      className="flex items-center justify-between p-2.5 hover:bg-muted/30 cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedOrdersToAssign((prev) => [...prev, ped.id])
                            } else {
                              setSelectedOrdersToAssign((prev) =>
                                prev.filter((id) => id !== ped.id),
                              )
                            }
                          }}
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <div>
                          <p className="font-semibold text-foreground">
                            {ped.numero} • {ped.schoolName}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {ped.items.length} itens • R$ {ped.total.toFixed(2)} • Rota ref:{' '}
                            {ped.rotaNome || 'Sem rota'}
                          </p>
                        </div>
                      </div>
                      {isJaNaOutraRota && (
                        <Badge variant="outline" className="text-[9px] text-amber-700 bg-amber-50">
                          Transferir de outra rota
                        </Badge>
                      )}
                    </label>
                  )
                })}

              {contratoOrders.filter((o) => o.status === 'Pendente').length === 0 && (
                <div className="py-6 text-center text-muted-foreground">
                  Nenhum pedido pendente disponível para atribuição.
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={isSavingAssignment}
              onClick={() => setRoutingDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="button" disabled={isSavingAssignment} onClick={handleSaveRouting}>
              {isSavingAssignment ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando Roteamento...
                </>
              ) : (
                'Salvar Roteamento'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: Confirmação de Despacho (Colocar em Rota a Rota Inteira) */}
      <AlertDialog open={dispatchConfirmOpen} onOpenChange={setDispatchConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Play className="h-5 w-5 text-amber-600" /> Colocar Rota Logística em Rota
            </AlertDialogTitle>
            <AlertDialogDescription>
              Deseja despachar a rota <strong>{rotaToDispatch?.nome}</strong> inteira? Todos os
              pedidos pendentes associados passarão para o status <strong>"Em Rota"</strong> e a
              data/hora do despacho será registrada na central.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDispatching}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-600 hover:bg-amber-700 text-white"
              disabled={isDispatching}
              onClick={(e) => {
                e.preventDefault()
                handleConfirmDispatch()
              }}
            >
              {isDispatching ? 'Despachando...' : 'Confirmar Despacho'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* MODAL 3: Confirmação de Entrega da Rota Inteira (Operação Offline da Central) */}
      <AlertDialog open={deliverWholeRouteOpen} onOpenChange={setDeliverWholeRouteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" /> Confirmar Retorno e Entrega da Rota Inteira
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Confirmação offline da central: o motorista retornou do campo com a rota{' '}
                <strong>{rotaToDeliver?.nome}</strong> cumprida.
              </p>
              <p>
                Todos os pedidos <strong>"Em Rota"</strong> dela serão marcados como{' '}
                <strong>Entregue</strong>, com registro de data/hora (entregue_em) e usuário
                conferente (entregue_por: <strong>{user?.name || user?.email}</strong>), realizando
                a <strong>baixa automática no estoque</strong> e liberando a emissão de Atesto.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeliveringWholeRoute}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={isDeliveringWholeRoute}
              onClick={(e) => {
                e.preventDefault()
                handleConfirmDeliverWholeRoute()
              }}
            >
              {isDeliveringWholeRoute ? 'Confirmando Entrega...' : 'Confirmar Rota Entregue'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* MODAL 4: Botão "Não Entregue" após despacho -> Cancelado Definitivamente por Motivo Logístico */}
      <Dialog open={undeliveredDialogOpen} onOpenChange={setUndeliveredDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" /> Registrar "Não Entregue" (Cancelamento Logístico)
            </DialogTitle>
            <DialogDescription>
              O pedido foi despachado mas não foi entregue pelo motorista. Ao registrar "Não
              entregue", o pedido <strong>{orderForUndelivered?.numero}</strong> será{' '}
              <strong>CANCELADO DEFINITIVAMENTE</strong> com motivo logístico (sem reentrega — não
              volta para Pendente).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="p-2.5 rounded bg-muted/30 border space-y-1">
              <p>
                <strong>Escola:</strong> {orderForUndelivered?.schoolName}
              </p>
              <p>
                <strong>Valor:</strong> R$ {orderForUndelivered?.total.toFixed(2)}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="motivo-logistico-sel" className="font-semibold">
                Motivo Logístico da Cooperativa <span className="text-destructive">*</span>
              </Label>
              <Select
                value={selectedMotivoLogistico}
                onValueChange={(val) =>
                  setSelectedMotivoLogistico(val as MotivoLogisticoCancelamento)
                }
              >
                <SelectTrigger id="motivo-logistico-sel" className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MOTIVOS_LOGISTICOS_CANCELAMENTO.map((motivo) => (
                    <SelectItem key={motivo} value={motivo}>
                      {motivo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="detalhe-logistico" className="font-semibold">
                Detalhamento Livre (Opcional)
              </Label>
              <textarea
                id="detalhe-logistico"
                rows={3}
                placeholder="Ex.: Caminhão quebrou no km 12, portão trancado sem resposta, etc."
                value={detalheMotivoLogistico}
                onChange={(e) => setDetalheMotivoLogistico(e.target.value)}
                className="w-full p-2 rounded-md border text-xs bg-background"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={isProcessingUndelivered}
              onClick={() => setUndeliveredDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isProcessingUndelivered}
              onClick={handleExecuteUndelivered}
            >
              {isProcessingUndelivered ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Registrando...
                </>
              ) : (
                'Confirmar "Não Entregue"'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
