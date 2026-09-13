import { useState, useMemo } from 'react'
import { useApp } from '@/context/app-context'
import { useAuth } from '@/context/auth-context'
import type { Order } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ShoppingCart,
  Plus,
  Trash2,
  Calendar as CalIcon,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Filter,
  MessageSquare,
  FileSpreadsheet,
  Layers,
  Sparkles,
  Info,
  MoreVertical,
  Truck,
  XCircle,
  Play,
  UserCheck,
  Check,
} from 'lucide-react'
import { toast } from 'sonner'

export default function Orders() {
  const {
    products,
    schools,
    orders,
    contracts,
    activeCiclo,
    addOrder,
    updateOrderStatus,
    confirmarEntregaPedido,
    cancelarPedido,
    isLoading,
  } = useApp()
  const { user } = useAuth()

  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Filtros de listagem
  const [filterOrigem, setFilterOrigem] = useState<string>('todos')
  const [filterStatus, setFilterStatus] = useState<string>('todos')
  const [filterValidacao, setFilterValidacao] = useState<string>('todos')

  // Form de criação de pedido
  const [selectedContractId, setSelectedContractId] = useState<string>('')
  const [selectedSchool, setSelectedSchool] = useState('')
  const [orderOrigem, setOrderOrigem] = useState<'whatsapp' | 'manual'>('whatsapp')
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0])
  const [orderItems, setOrderItems] = useState<Array<{ productId: string; quantity: number }>>([
    { productId: products[0]?.id || '', quantity: 5 },
  ])

  // Detalhes do pedido selecionado
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)

  // Diálogo de cancelamento com motivo obrigatório
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [orderToCancel, setOrderToCancel] = useState<Order | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [isCanceling, setIsCanceling] = useState(false)

  // Diálogo de confirmação de entrega
  const [deliverDialogOpen, setDeliverDialogOpen] = useState(false)
  const [orderToDeliver, setOrderToDeliver] = useState<Order | null>(null)
  const [isDelivering, setIsDelivering] = useState(false)

  // Filtrar contratos com modalidade individualizada para lançamento via WhatsApp
  const individualContracts = useMemo(
    () => contracts.filter((c) => c.modalidade_pedido === 'individualizado'),
    [contracts],
  )

  // Escolas disponíveis baseadas no contrato selecionado (ou todas se não filtrar)
  const availableSchools = useMemo(() => {
    if (!selectedContractId) return schools
    const c = contracts.find((cnt) => cnt.id === selectedContractId)
    if (!c) return schools
    const schoolIds = new Set(c.escolas.map((e) => e.escolaId))
    return schools.filter((s) => schoolIds.has(s.id))
  }, [selectedContractId, contracts, schools])

  const calculatedTotal = useMemo(() => {
    return orderItems.reduce((acc, item) => {
      const prod = products.find((p) => p.id === item.productId)
      return acc + (prod?.price || 0) * (Number(item.quantity) || 0)
    }, 0)
  }, [orderItems, products])

  const handleAddItem = () => {
    const nextProd = products.find((p) => !orderItems.some((i) => i.productId === p.id))
    setOrderItems((prev) => [
      ...prev,
      {
        productId: nextProd?.id || products[0]?.id || '',
        quantity: 1,
      },
    ])
  }

  const handleRemoveItem = (index: number) => {
    setOrderItems((prev) => prev.filter((_, i) => i !== index))
  }

  const handleItemChange = (
    index: number,
    field: 'productId' | 'quantity',
    value: string | number,
  ) => {
    setOrderItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    )
  }

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedSchool) {
      toast.error('Selecione a escola solicitante.')
      return
    }

    const validItems = orderItems.filter((i) => i.productId && Number(i.quantity) > 0)
    if (validItems.length === 0) {
      toast.error('Adicione ao menos um produto válido com quantidade maior que zero.')
      return
    }

    setIsSubmitting(true)

    // Achar rota associada da escola no contrato
    let rotaIdToUse: string | undefined = undefined
    if (selectedContractId) {
      const c = contracts.find((cnt) => cnt.id === selectedContractId)
      const esc = c?.escolas.find((e) => e.escolaId === selectedSchool)
      rotaIdToUse = esc?.rotaId
    }

    const success = await addOrder({
      schoolId: selectedSchool,
      date: orderDate,
      cicloId: activeCiclo?.id,
      origem: orderOrigem,
      rotaId: rotaIdToUse,
      items: validItems.map((i) => ({
        productId: i.productId,
        quantity: Number(i.quantity),
      })),
    })

    setIsSubmitting(false)

    if (success) {
      setOpen(false)
      setSelectedSchool('')
      setOrderItems([{ productId: products[0]?.id || '', quantity: 5 }])
    }
  }

  // Filtragem da lista
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (filterOrigem !== 'todos' && o.origem !== filterOrigem) return false
      if (filterStatus !== 'todos' && o.status !== filterStatus) return false
      if (filterValidacao !== 'todos' && o.validacao?.status !== filterValidacao) return false
      return true
    })
  }, [orders, filterOrigem, filterStatus, filterValidacao])

  const getOrigemBadge = (origem: Order['origem']) => {
    switch (origem) {
      case 'excel':
        return (
          <Badge
            variant="outline"
            className="text-emerald-700 bg-emerald-50 border-emerald-300 gap-1 text-[11px]"
          >
            <FileSpreadsheet className="h-3 w-3" /> Excel
          </Badge>
        )
      case 'whatsapp':
        return (
          <Badge
            variant="outline"
            className="text-green-700 bg-green-50 border-green-400 gap-1 text-[11px]"
          >
            <MessageSquare className="h-3 w-3" /> WhatsApp
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="text-muted-foreground gap-1 text-[11px]">
            Manual
          </Badge>
        )
    }
  }

  const getValidacaoBadge = (val: Order['validacao']) => {
    if (!val || val.status === 'validado') {
      return (
        <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] gap-1">
          <CheckCircle2 className="h-3 w-3" /> Validado
        </Badge>
      )
    }
    if (val.status === 'invalido') {
      return (
        <Badge variant="destructive" className="text-[10px] gap-1" title={val.motivo}>
          <AlertTriangle className="h-3 w-3" /> Inválido
        </Badge>
      )
    }
    return (
      <Badge className="bg-amber-600 text-[10px] gap-1">
        <Clock className="h-3 w-3" /> Em Progresso
      </Badge>
    )
  }

  const getStatusBadge = (status: Order['status']) => {
    switch (status) {
      case 'Entregue':
        return <Badge className="bg-emerald-600 text-white font-medium">Entregue</Badge>
      case 'Pendente':
        return <Badge variant="secondary">Pendente</Badge>
      case 'Em Rota':
        return <Badge className="bg-amber-600 text-white font-medium">Em Rota</Badge>
      default:
        return <Badge variant="destructive">Cancelado</Badge>
    }
  }

  // Ações de evolução de status
  const handleAvancarParaEmRota = async (order: Order) => {
    if (order.status !== 'Pendente') {
      toast.warning('Apenas pedidos Pendentes podem avançar para "Em Rota".')
      return
    }
    await updateOrderStatus(order.id, 'Em Rota')
  }

  const handleOpenConfirmDelivery = (order: Order) => {
    setOrderToDeliver(order)
    setDeliverDialogOpen(true)
  }

  const handleExecuteDelivery = async () => {
    if (!orderToDeliver) return
    setIsDelivering(true)
    try {
      const ok = await confirmarEntregaPedido(orderToDeliver.id, user?.id)
      if (ok) {
        setDeliverDialogOpen(false)
        setOrderToDeliver(null)
      }
    } finally {
      setIsDelivering(false)
    }
  }

  const handleOpenCancelDialog = (order: Order) => {
    if (order.status !== 'Pendente') {
      toast.error(
        'Cancelamento é permitido apenas enquanto o pedido estiver com status "Pendente".',
      )
      return
    }
    setOrderToCancel(order)
    setCancelReason('')
    setCancelDialogOpen(true)
  }

  const handleExecuteCancel = async () => {
    if (!orderToCancel) return
    if (!cancelReason.trim()) {
      toast.error('Informe obrigatoriamente o motivo do cancelamento.')
      return
    }
    setIsCanceling(true)
    try {
      const ok = await cancelarPedido(orderToCancel.id, cancelReason.trim())
      if (ok) {
        setCancelDialogOpen(false)
        setOrderToCancel(null)
        setCancelReason('')
      }
    } finally {
      setIsCanceling(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestão de Pedidos</h1>
          <p className="text-muted-foreground">
            Lançamento via WhatsApp para contratos individualizados, validação de regras e rastreio
            por origem.
          </p>
        </div>

        {/* Botão de Lançar Pedido */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Lançar Pedido
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[620px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-primary" /> Novo Pedido (Individualizado /
                WhatsApp)
              </DialogTitle>
              <DialogDescription>
                Ciclo Ativo:{' '}
                <strong className="text-foreground">{activeCiclo?.nome || 'Nenhum'}</strong> (
                {activeCiclo?.status || '-'})
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreateOrder} className="space-y-4 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ord-contrato">Contrato Vinculado</Label>
                  <Select value={selectedContractId} onValueChange={setSelectedContractId}>
                    <SelectTrigger id="ord-contrato">
                      <SelectValue placeholder="Selecione o Contrato" />
                    </SelectTrigger>
                    <SelectContent>
                      {individualContracts.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.numero} ({c.escolas.length} escolas)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ord-origem">Canal de Origem</Label>
                  <Select
                    value={orderOrigem}
                    onValueChange={(v) => setOrderOrigem(v as 'whatsapp' | 'manual')}
                  >
                    <SelectTrigger id="ord-origem">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="whatsapp">Mensagem WhatsApp (Individual)</SelectItem>
                      <SelectItem value="manual">Lançamento Interno / Manual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ord-escola">
                    Escola / Instituição <span className="text-destructive">*</span>
                  </Label>
                  <Select value={selectedSchool} onValueChange={setSelectedSchool} required>
                    <SelectTrigger id="ord-escola">
                      <SelectValue placeholder="Selecione a escola" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableSchools.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name} ({s.route})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ord-date">Data Prevista de Entrega</Label>
                  <div className="relative">
                    <CalIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      type="date"
                      id="ord-date"
                      className="pl-9"
                      value={orderDate}
                      onChange={(e) => setOrderDate(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Itens do Pedido */}
              <div className="space-y-3 pt-2 border-t">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="font-semibold text-sm">Itens e Quantidades</Label>
                    <p className="text-xs text-muted-foreground">
                      O pedido será validado contra compensação de disponibilidade na fase de
                      correção.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddItem}
                    className="h-8 text-xs"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar Produto
                  </Button>
                </div>

                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                  {orderItems.map((item, idx) => {
                    const selectedProd = products.find((p) => p.id === item.productId)
                    const itemSubtotal = selectedProd
                      ? selectedProd.price * (Number(item.quantity) || 0)
                      : 0

                    return (
                      <div
                        key={idx}
                        className="flex items-center gap-2 p-2 rounded-lg border bg-muted/20 text-xs"
                      >
                        <div className="flex-1">
                          <Select
                            value={item.productId}
                            onValueChange={(val) => handleItemChange(idx, 'productId', val)}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Selecione o produto" />
                            </SelectTrigger>
                            <SelectContent>
                              {products.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.name} - R$ {p.price.toFixed(2)} / {p.unit}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="w-20">
                          <Input
                            type="number"
                            min="1"
                            step="1"
                            className="h-8 text-xs font-mono"
                            placeholder="Qtd"
                            value={item.quantity}
                            onChange={(e) =>
                              handleItemChange(idx, 'quantity', parseInt(e.target.value) || 1)
                            }
                          />
                        </div>
                        <div className="w-24 text-right font-mono font-medium text-foreground">
                          R$ {itemSubtotal.toFixed(2)}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => handleRemoveItem(idx)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )
                  })}
                </div>

                <div className="flex justify-between items-center p-3 bg-primary/5 rounded-lg border border-primary/20">
                  <span className="font-semibold text-xs">Valor Total Calculado:</span>
                  <span className="text-base font-bold text-primary">
                    R${' '}
                    {calculatedTotal.toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...
                    </>
                  ) : (
                    'Salvar Pedido'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Barra de Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
            <div>
              <Label className="text-xs">Origem do Pedido</Label>
              <Select value={filterOrigem} onValueChange={setFilterOrigem}>
                <SelectTrigger className="h-9 mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas as Origens</SelectItem>
                  <SelectItem value="excel">Excel (Centralizado)</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp (Individual)</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Status da Entrega</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-9 mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Status</SelectItem>
                  <SelectItem value="Pendente">Pendente</SelectItem>
                  <SelectItem value="Em Rota">Em Rota</SelectItem>
                  <SelectItem value="Entregue">Entregue</SelectItem>
                  <SelectItem value="Cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Status da Validação</Label>
              <Select value={filterValidacao} onValueChange={setFilterValidacao}>
                <SelectTrigger className="h-9 mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas as Validações</SelectItem>
                  <SelectItem value="validado">Validado</SelectItem>
                  <SelectItem value="invalido">Inválido / Pendente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Pedidos */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShoppingCart className="h-5 w-5 text-primary" /> Relação de Pedidos Lançados
            </CardTitle>
            <Badge variant="outline" className="text-xs">
              {filteredOrders.length} pedido(s) listado(s)
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº Pedido</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Instituição Escolar</TableHead>
                  <TableHead>Rota</TableHead>
                  <TableHead>Data Prevista</TableHead>
                  <TableHead>Validação</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total (R$)</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> Carregando pedidos...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      Nenhum pedido encontrado para os filtros selecionados.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-semibold text-primary text-xs">
                        {order.numero}
                      </TableCell>
                      <TableCell>{getOrigemBadge(order.origem)}</TableCell>
                      <TableCell className="font-medium text-xs">{order.schoolName}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {order.rotaNome || 'Sem rota'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {new Date(order.date).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell>{getValidacaoBadge(order.validacao)}</TableCell>
                      <TableCell>{getStatusBadge(order.status)}</TableCell>
                      <TableCell className="text-right font-mono font-medium text-xs">
                        R${' '}
                        {order.total.toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            title="Ver detalhes do pedido"
                            onClick={() => {
                              setViewingOrder(order)
                              setDetailsOpen(true)
                            }}
                          >
                            <Info className="h-4 w-4" />
                          </Button>

                          {/* Menu de Ações de Transição de Status */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 w-7 p-0"
                                title="Ações do pedido"
                              >
                                <MoreVertical className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 text-xs">
                              <DropdownMenuLabel className="text-[11px] text-muted-foreground">
                                Status: {order.status}
                              </DropdownMenuLabel>
                              <DropdownMenuSeparator />

                              {/* Se Pendente: pode avançar para Em Rota, Entregue ou Cancelar */}
                              {order.status === 'Pendente' && (
                                <>
                                  <DropdownMenuItem
                                    className="gap-2 cursor-pointer text-amber-700 dark:text-amber-400"
                                    onClick={() => handleAvancarParaEmRota(order)}
                                  >
                                    <Truck className="h-3.5 w-3.5" /> Avançar para Em Rota
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="gap-2 cursor-pointer text-emerald-700 dark:text-emerald-400"
                                    onClick={() => handleOpenConfirmDelivery(order)}
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5" /> Confirmar Entrega
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                                    onClick={() => handleOpenCancelDialog(order)}
                                  >
                                    <XCircle className="h-3.5 w-3.5" /> Cancelar Pedido
                                  </DropdownMenuItem>
                                </>
                              )}

                              {/* Se Em Rota: pode avançar para Entregue */}
                              {order.status === 'Em Rota' && (
                                <DropdownMenuItem
                                  className="gap-2 cursor-pointer text-emerald-700 dark:text-emerald-400"
                                  onClick={() => handleOpenConfirmDelivery(order)}
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" /> Confirmar Entrega
                                </DropdownMenuItem>
                              )}

                              {/* Se Entregue: finalizado */}
                              {order.status === 'Entregue' && (
                                <div className="px-2 py-1.5 text-[11px] text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 font-medium">
                                  <Check className="h-3.5 w-3.5" /> Pedido Concluído
                                </div>
                              )}

                              {/* Se Cancelado: bloqueado, não pode voltar */}
                              {order.status === 'Cancelado' && (
                                <div className="px-2 py-1.5 text-[11px] text-destructive flex items-center gap-1.5 font-medium">
                                  <XCircle className="h-3.5 w-3.5" /> Cancelado (sem retorno)
                                </div>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Modal de Detalhes do Pedido */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" /> Pedido {viewingOrder?.numero}
            </DialogTitle>
            <DialogDescription>
              {viewingOrder?.schoolName} • Origem: {viewingOrder?.origem}
            </DialogDescription>
          </DialogHeader>
          {viewingOrder && (
            <div className="space-y-4 pt-2 text-xs">
              <div className="p-3 rounded border bg-muted/20 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Status Atual:</span>
                  <span>{getStatusBadge(viewingOrder.status)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Status da Validação:</span>
                  <span>{getValidacaoBadge(viewingOrder.validacao)}</span>
                </div>
                {viewingOrder.validacao?.motivo && (
                  <p className="text-[11px] text-muted-foreground pt-1 border-t">
                    👉 {viewingOrder.validacao.motivo}
                  </p>
                )}
              </div>

              {/* Informações de Entrega se entregue */}
              {viewingOrder.status === 'Entregue' && (
                <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-1 text-emerald-900 dark:text-emerald-200">
                  <div className="flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" /> Dados da Entrega Confirmada
                  </div>
                  {viewingOrder.entregue_em && (
                    <p className="text-[11px]">
                      <strong>Data/Hora:</strong>{' '}
                      {new Date(viewingOrder.entregue_em).toLocaleString('pt-BR')}
                    </p>
                  )}
                  {viewingOrder.entreguePorNome && (
                    <p className="text-[11px]">
                      <strong>Confirmado por:</strong> {viewingOrder.entreguePorNome}
                    </p>
                  )}
                </div>
              )}

              {/* Motivo de Cancelamento se cancelado */}
              {viewingOrder.status === 'Cancelado' && (
                <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/10 space-y-1 text-destructive">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <XCircle className="h-4 w-4" /> Pedido Cancelado (Bloqueado)
                  </div>
                  <p className="text-[11px] text-foreground">
                    <strong>Motivo:</strong>{' '}
                    {viewingOrder.cancelamento_motivo || 'Motivo não informado.'}
                  </p>
                </div>
              )}

              <div>
                <h4 className="font-semibold text-xs mb-2">Itens Solicitados:</h4>
                <div className="rounded border divide-y max-h-[220px] overflow-y-auto">
                  {viewingOrder.items.map((it, idx) => (
                    <div key={idx} className="flex justify-between p-2">
                      <span>{it.name}</span>
                      <span className="font-mono">
                        {it.quantity} un × R$ {it.price.toFixed(2)} = R${' '}
                        {(it.quantity * it.price).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center pt-2 font-bold text-sm">
                <span>Total do Pedido:</span>
                <span className="text-primary font-mono">R$ {viewingOrder.total.toFixed(2)}</span>
              </div>
            </div>
          )}{' '}
        </DialogContent>
      </Dialog>
      {/* Modal de Cancelamento de Pedido com Motivo Obrigatório */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" /> Cancelar Pedido {orderToCancel?.numero}
            </DialogTitle>
            <DialogDescription>
              Atenção: O cancelamento só é permitido na fase <strong>Pendente</strong> e{' '}
              <strong>não poderá ser revertido</strong>. O motivo é obrigatório para auditoria.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="p-2.5 rounded bg-muted/30 border">
              <p>
                <strong>Escola:</strong> {orderToCancel?.schoolName}
              </p>
              <p>
                <strong>Valor:</strong> R$ {orderToCancel?.total.toFixed(2)}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cancel-motivo" className="text-xs font-semibold">
                Motivo do Cancelamento <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="cancel-motivo"
                placeholder="Descreva detalhadamente o motivo do cancelamento deste pedido..."
                rows={3}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="text-xs"
                required
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={isCanceling}
              onClick={() => setCancelDialogOpen(false)}
            >
              Voltar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isCanceling || !cancelReason.trim()}
              onClick={handleExecuteCancel}
            >
              {isCanceling ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cancelando...
                </>
              ) : (
                'Confirmar Cancelamento'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmação Direta de Entrega (Baixa de Estoque + Registro) */}
      <Dialog open={deliverDialogOpen} onOpenChange={setDeliverDialogOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" /> Confirmar Entrega do Pedido
            </DialogTitle>
            <DialogDescription>
              O status mudará para <strong>Entregue</strong>, liberando a emissão de Atesto e
              realizando a baixa de estoque dos itens.
            </DialogDescription>
          </DialogHeader>

          {orderToDeliver && (
            <div className="space-y-3 py-2 text-xs">
              <div className="p-3 rounded-lg bg-muted/30 border space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pedido:</span>
                  <span className="font-bold text-primary">{orderToDeliver.numero}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Instituição:</span>
                  <span className="font-medium">{orderToDeliver.schoolName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valor Total:</span>
                  <span className="font-mono font-bold text-foreground">
                    R$ {orderToDeliver.total.toFixed(2)}
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
                  {orderToDeliver.items.map((it, idx) => (
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
              disabled={isDelivering}
              onClick={() => setDeliverDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={isDelivering}
              onClick={handleExecuteDelivery}
            >
              {isDelivering ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Concluindo...
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
