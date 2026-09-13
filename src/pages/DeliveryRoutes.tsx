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
  Truck,
  Layers,
  CheckCircle2,
  Play,
  Loader2,
  Calendar,
  Package,
  UserCheck,
  Building2,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Order } from '@/lib/types'

export default function DeliveryRoutes() {
  const { contracts, orders, rotas, updateOrderStatus, confirmarEntregaPedido } = useApp()
  const { user } = useAuth()

  // Estado de confirmação de entrega via diálogo
  const [deliveryDialogOpen, setDeliveryDialogOpen] = useState(false)
  const [selectedOrderForDelivery, setSelectedOrderForDelivery] = useState<Order | null>(null)
  const [isProcessingDelivery, setIsProcessingDelivery] = useState(false)
  const [isProcessingDispatch, setIsProcessingDispatch] = useState<string | null>(null)

  // Selecionar contrato para filtrar rotas
  const [selectedContratoId, setSelectedContratoId] = useState<string>(contracts[0]?.id || 'todos')

  // Rotas filtradas pelo contrato
  const filteredRotas = useMemo(() => {
    if (selectedContratoId === 'todos') {
      return rotas
    }
    return rotas.filter((r) => r.contrato_id === selectedContratoId)
  }, [rotas, selectedContratoId])

  // Agrupar escolas e pedidos pendentes por rota
  const rotasDetalhes = useMemo(() => {
    return filteredRotas.map((rota) => {
      // Contrato ao qual esta rota pertence
      const contrato = contracts.find((c) => c.id === rota.contrato_id)

      // Escolas associadas a esta rota (através de contrato_escolas)
      const escolasNaRota = contrato
        ? contrato.escolas.filter((e) => e.rotaId === rota.id || e.rotaNome === rota.nome)
        : []

      const escolaIds = new Set(escolasNaRota.map((e) => e.escolaId))

      // Pedidos pendentes de entrega nesta rota (Pendente ou Em Rota)
      // Todos os pedidos desta rota (para histórico e paradas)
      const todosPedidosRota = orders.filter((o) => {
        if (o.rotaId === rota.id) return true
        if (escolaIds.has(o.schoolId)) return true
        return false
      })

      // Pedidos pendentes de entrega nesta rota (Pendente ou Em Rota)
      const pedidosPendentes = todosPedidosRota.filter(
        (o) => o.status === 'Pendente' || o.status === 'Em Rota',
      )

      // Pedidos entregues recentemente nesta rota
      const pedidosEntregues = todosPedidosRota.filter((o) => o.status === 'Entregue')

      const volumePendente = pedidosPendentes.reduce((acc, p) => {
        return acc + p.items.reduce((sum, it) => sum + it.quantity, 0)
      }, 0)

      const valorPendente = pedidosPendentes.reduce((acc, p) => acc + p.total, 0)

      return {
        rota,
        contratoNumero: contrato?.numero || 'Sem contrato',
        modalidade: contrato?.modalidade_pedido || 'individualizado',
        escolas: escolasNaRota,
        pedidosPendentes,
        pedidosEntregues,
        volumePendente,
        valorPendente,
      }
    })
  }, [filteredRotas, contracts, orders])

  // Despachar pedido: Pendente -> Em Rota (Planejar / Iniciar Entrega)
  const handleDespacharRota = async (pedido: Order, rotaId: string) => {
    setIsProcessingDispatch(pedido.id)
    try {
      // Se não tiver rota_id vinculada no pedido, associar agora
      await updateOrderStatus(pedido.id, 'Em Rota', {
        entregue_por: user?.id,
      })
      toast.success(`Pedido ${pedido.numero} colocado "Em Rota" para entrega!`)
    } finally {
      setIsProcessingDispatch(null)
    }
  }

  // Despachar todos os pedidos pendentes da rota para "Em Rota"
  const handleDespacharTodos = async (pedidos: Order[]) => {
    const pendentes = pedidos.filter((p) => p.status === 'Pendente')
    if (pendentes.length === 0) {
      toast.info('Não há pedidos pendentes para despachar nesta rota.')
      return
    }

    let sucessos = 0
    for (const p of pendentes) {
      const ok = await updateOrderStatus(p.id, 'Em Rota')
      if (ok) sucessos++
    }
    toast.success(`${sucessos} pedido(s) colocados "Em Rota" com sucesso!`)
  }

  // Abrir modal para confirmar entrega com registro
  const handleOpenConfirmDelivery = (pedido: Order) => {
    setSelectedOrderForDelivery(pedido)
    setDeliveryDialogOpen(true)
  }

  // Executar confirmação de entrega
  const handleConfirmDeliveryExecute = async () => {
    if (!selectedOrderForDelivery) return
    setIsProcessingDelivery(true)
    try {
      const ok = await confirmarEntregaPedido(selectedOrderForDelivery.id, user?.id)
      if (ok) {
        setDeliveryDialogOpen(false)
        setSelectedOrderForDelivery(null)
      }
    } finally {
      setIsProcessingDelivery(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Rotas de Distribuição</h1>
          <p className="text-muted-foreground">
            Acompanhe o cronograma de paradas escolares e pedidos pendentes por rota contratual.
          </p>
        </div>

        {/* Filtro por Contrato */}
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary shrink-0" />
          <Select value={selectedContratoId} onValueChange={setSelectedContratoId}>
            <SelectTrigger className="w-[240px]">
              <SelectValue placeholder="Filtrar por Contrato" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Contratos</SelectItem>
              {contracts.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.numero} ({c.escolas.length} escolas)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {rotasDetalhes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Truck className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>Nenhuma rota cadastrada para o filtro selecionado.</p>
            <p className="text-xs mt-1">
              Cadastre e gerencie rotas diretamente dentro dos Contratos.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {rotasDetalhes.map((item) => (
            <Card key={item.rota.id} className="flex flex-col border-t-4 border-t-primary">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Truck className="h-5 w-5 text-primary" /> {item.rota.nome}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Contrato: <strong className="text-foreground">{item.contratoNumero}</strong> •
                      Modalidade: <span className="capitalize">{item.modalidade}</span>
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {item.escolas.length} paradas
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 flex-1">
                {/* Resumo de Carga Pendente */}
                <div className="grid grid-cols-2 gap-2 text-xs p-2.5 rounded-lg bg-muted/30 border">
                  <div>
                    <span className="text-muted-foreground">Pedidos a Entregar:</span>
                    <p className="font-bold text-sm text-foreground">
                      {item.pedidosPendentes.length} entrega(s)
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-muted-foreground">Volume / Valor Pendente:</span>
                    <p className="font-bold text-sm text-primary">
                      {item.volumePendente} itens (R$ {item.valorPendente.toFixed(2)})
                    </p>
                  </div>
                </div>

                {/* Paradas da Rota com Pedidos e Ações */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Paradas da Rota & Confirmação de Entrega
                    </h4>
                    {item.pedidosPendentes.some((p) => p.status === 'Pendente') && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-[10px] px-2 gap-1 border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-50"
                        onClick={() => handleDespacharTodos(item.pedidosPendentes)}
                      >
                        <Play className="h-3 w-3" /> Colocar Todos Em Rota
                      </Button>
                    )}
                  </div>

                  {item.escolas.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">
                      Nenhuma escola atribuída a esta rota ainda.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                      {item.escolas.map((esc, i) => {
                        // Pedidos específicos desta escola nesta rota
                        const escolaOrders = item.pedidosPendentes.filter(
                          (p) => p.schoolId === esc.escolaId,
                        )
                        const entreguesCount = item.pedidosEntregues.filter(
                          (p) => p.schoolId === esc.escolaId,
                        ).length

                        return (
                          <div
                            key={esc.id}
                            className="p-2.5 rounded-lg border bg-card text-xs space-y-2 shadow-xs"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary shrink-0">
                                  {i + 1}
                                </span>
                                <div>
                                  <p className="font-semibold text-foreground">{esc.escolaNome}</p>
                                  <p className="text-[10px] text-muted-foreground">
                                    {esc.escolaEndereco || 'Endereço não cadastrado'}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {entreguesCount > 0 && (
                                  <Badge
                                    variant="outline"
                                    className="text-[9px] bg-emerald-50 text-emerald-700 border-emerald-300"
                                  >
                                    {entreguesCount} entregue(s)
                                  </Badge>
                                )}
                                {esc.escolaTelefone && (
                                  <span className="text-[10px] font-mono text-muted-foreground hidden sm:inline">
                                    {esc.escolaTelefone}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Pedidos da Escola nesta Parada */}
                            {escolaOrders.length === 0 ? (
                              <div className="text-[11px] text-muted-foreground italic pl-7">
                                Sem entregas pendentes no momento.
                              </div>
                            ) : (
                              <div className="space-y-1.5 pl-7 border-l-2 border-primary/20 ml-2.5">
                                {escolaOrders.map((ped) => (
                                  <div
                                    key={ped.id}
                                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 rounded bg-muted/20 border"
                                  >
                                    <div>
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-bold text-primary">{ped.numero}</span>
                                        <Badge
                                          className={`text-[9px] px-1.5 py-0 ${
                                            ped.status === 'Em Rota'
                                              ? 'bg-amber-600'
                                              : 'bg-blue-600'
                                          }`}
                                        >
                                          {ped.status}
                                        </Badge>
                                      </div>
                                      <p className="text-[10px] text-muted-foreground">
                                        {ped.items.length} produto(s) • Total: R${' '}
                                        {ped.total.toFixed(2)}
                                      </p>
                                    </div>

                                    {/* Botões de Ação na Parada */}
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      {ped.status === 'Pendente' && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-7 text-[11px] border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-50"
                                          disabled={isProcessingDispatch === ped.id}
                                          onClick={() => handleDespacharRota(ped, item.rota.id)}
                                        >
                                          {isProcessingDispatch === ped.id ? (
                                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                          ) : (
                                            <Play className="h-3 w-3 mr-1" />
                                          )}
                                          Iniciar Rota
                                        </Button>
                                      )}

                                      <Button
                                        size="sm"
                                        className="h-7 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                                        onClick={() => handleOpenConfirmDelivery(ped)}
                                      >
                                        <CheckCircle2 className="h-3.5 w-3.5" /> Confirmar Entrega
                                      </Button>
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
          ))}
        </div>
      )}

      {/* Modal de Confirmação de Entrega */}
      <Dialog open={deliveryDialogOpen} onOpenChange={setDeliveryDialogOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" /> Confirmar Entrega do Pedido
            </DialogTitle>
            <DialogDescription>
              A confirmação mudará o status para <strong>Entregue</strong>, registrará a data/hora
              atual, o usuário responsável e realizará a{' '}
              <strong>baixa automática no estoque</strong> dos produtos.
            </DialogDescription>
          </DialogHeader>

          {selectedOrderForDelivery && (
            <div className="space-y-3 py-2 text-xs">
              <div className="p-3 rounded-lg bg-muted/30 border space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pedido:</span>
                  <span className="font-bold text-primary">{selectedOrderForDelivery.numero}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Destino:</span>
                  <span className="font-medium">{selectedOrderForDelivery.schoolName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valor Total:</span>
                  <span className="font-mono font-bold text-foreground">
                    R$ {selectedOrderForDelivery.total.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <UserCheck className="h-3.5 w-3.5 text-primary" /> Confirmado por:
                  </span>
                  <span className="font-semibold text-foreground">
                    {user?.name || user?.email || 'Usuário Atual'}
                  </span>
                </div>
              </div>

              <div>
                <p className="font-semibold mb-1 text-muted-foreground">
                  Itens com baixa no estoque:
                </p>
                <div className="rounded border divide-y max-h-[160px] overflow-y-auto">
                  {selectedOrderForDelivery.items.map((it, idx) => (
                    <div key={idx} className="flex justify-between p-2">
                      <span>{it.name}</span>
                      <span className="font-mono font-bold text-amber-700 dark:text-amber-400">
                        -{it.quantity} un
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={isProcessingDelivery}
              onClick={() => setDeliveryDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={isProcessingDelivery}
              onClick={handleConfirmDeliveryExecute}
            >
              {isProcessingDelivery ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Registrando Entrega...
                </>
              ) : (
                'Confirmar Entrega'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
