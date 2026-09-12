import { useState, useMemo } from 'react'
import { useApp } from '@/context/app-context'
import { useAuth } from '@/context/auth-context'
import type { Contract, School, ContratoItemRecord } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  FileText,
  Plus,
  Pencil,
  Trash2,
  DollarSign,
  Package,
  Loader2,
  AlertTriangle,
  Info,
  MapPin,
  Route,
  School as SchoolIcon,
  BarChart3,
  TrendingUp,
  CheckCircle2,
  Check,
} from 'lucide-react'
import { toast } from 'sonner'
import { contratosService } from '@/services/contratos'
import { rotasService } from '@/services/rotas'

interface ContractItemForm {
  id?: string
  productId: string
  price: number
  cotaAnual: number
}

interface ContractSchoolForm {
  escolaId: string
  rotaId: string
}

export default function Contracts() {
  const { contracts, schools, products, orders, rotas, isLoading, refreshData } = useApp()
  const { isAdmin } = useAuth()

  // Diálogos principais
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false)
  const [reportDialogOpen, setReportDialogOpen] = useState(false)

  // Estados de edição / criação
  const [editingContract, setEditingContract] = useState<Contract | null>(null)
  const [contractToDelete, setContractToDelete] = useState<Contract | null>(null)
  const [viewingContract, setViewingContract] = useState<Contract | null>(null)
  const [reportContract, setReportContract] = useState<Contract | null>(null)

  // Formulário de Contrato
  const [numero, setNumero] = useState('')
  const [tipo, setTipo] = useState('PNAE')
  const [modalidade, setModalidade] = useState<'individualizado' | 'centralizado'>(
    'individualizado',
  )
  const [valorTotal, setValorTotal] = useState('')
  const [status, setStatus] = useState<'Ativo' | 'Encerrado' | 'Pendente'>('Ativo')

  // Vínculos N:N Escolas e Rotas no diálogo
  const [contractSchoolsForm, setContractSchoolsForm] = useState<ContractSchoolForm[]>([])
  const [contractItems, setContractItems] = useState<ContractItemForm[]>([])

  // Gestão de Rotas do Contrato
  const [contractRotas, setContractRotas] = useState<
    Array<{ id?: string; nome: string; ordem: number }>
  >([])
  const [newRotaNome, setNewRotaNome] = useState('')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isLoadingItems, setIsLoadingItems] = useState(false)
  const [viewingItems, setViewingItems] = useState<ContratoItemRecord[]>([])

  const handleOpenCreate = () => {
    setEditingContract(null)
    setNumero('')
    setTipo('PNAE')
    setModalidade('individualizado')
    setValorTotal('')
    setStatus('Ativo')
    setContractSchoolsForm([])
    setContractRotas([
      { nome: 'ROTA A', ordem: 1 },
      { nome: 'ROTA B', ordem: 2 },
    ])
    // Pre-populate with first products
    const initialItems: ContractItemForm[] = products.slice(0, 5).map((p) => ({
      productId: p.id,
      price: p.price,
      cotaAnual: 500,
    }))
    setContractItems(initialItems)
    setDialogOpen(true)
  }

  const handleOpenEdit = async (contract: Contract) => {
    setEditingContract(contract)
    setNumero(contract.numero)
    setTipo(contract.tipo || 'PNAE')
    setModalidade(contract.modalidade_pedido || 'individualizado')
    setValorTotal(contract.totalValue.toString())
    setStatus(contract.status)

    // Escolas do contrato
    setContractSchoolsForm(
      contract.escolas.map((e) => ({
        escolaId: e.escolaId,
        rotaId: e.rotaId || '',
      })),
    )

    // Rotas do contrato
    const existingRotas = rotas.filter((r) => r.contrato_id === contract.id)
    setContractRotas(
      existingRotas.length > 0
        ? existingRotas.map((r) => ({ id: r.id, nome: r.nome, ordem: r.ordem || 1 }))
        : [
            { nome: 'ROTA A', ordem: 1 },
            { nome: 'ROTA B', ordem: 2 },
          ],
    )

    setDialogOpen(true)
    setIsLoadingItems(true)
    try {
      const items = await contratosService.getItems(contract.id)
      setContractItems(
        items.map((it) => ({
          id: it.id,
          productId: it.produto_id,
          price: Number(it.preco) || 0,
          cotaAnual: Number(it.cota_anual) || 0,
        })),
      )
    } catch (err) {
      console.error('Erro ao buscar itens:', err)
      setContractItems([])
    } finally {
      setIsLoadingItems(false)
    }
  }

  const handleOpenDetails = async (contract: Contract) => {
    setViewingContract(contract)
    setDetailsDialogOpen(true)
    try {
      const items = await contratosService.getItems(contract.id)
      setViewingItems(items)
    } catch (err) {
      console.error('Erro ao buscar itens para detalhes:', err)
      setViewingItems([])
    }
  }

  const handleOpenReport = async (contract: Contract) => {
    setReportContract(contract)
    setReportDialogOpen(true)
    try {
      const items = await contratosService.getItems(contract.id)
      setViewingItems(items)
    } catch (err) {
      console.error('Erro ao buscar itens do relatório:', err)
      setViewingItems([])
    }
  }

  // Adicionar e remover rotas no formulário
  const handleAddRota = () => {
    const trimmed = newRotaNome.trim().toUpperCase()
    if (!trimmed) return
    if (contractRotas.some((r) => r.nome === trimmed)) {
      toast.warning('Esta rota já foi adicionada.')
      return
    }
    setContractRotas((prev) => [...prev, { nome: trimmed, ordem: prev.length + 1 }])
    setNewRotaNome('')
  }

  const handleRemoveRota = (index: number) => {
    setContractRotas((prev) => prev.filter((_, i) => i !== index))
  }

  // Adicionar e remover escolas do contrato
  const handleToggleSchool = (schoolId: string) => {
    setContractSchoolsForm((prev) => {
      const exists = prev.find((s) => s.escolaId === schoolId)
      if (exists) {
        return prev.filter((s) => s.escolaId !== schoolId)
      } else {
        const defaultRota = contractRotas[0]?.nome || ''
        return [...prev, { escolaId: schoolId, rotaId: defaultRota }]
      }
    })
  }

  const handleSchoolRotaChange = (schoolId: string, rotaValue: string) => {
    setContractSchoolsForm((prev) =>
      prev.map((s) => (s.escolaId === schoolId ? { ...s, rotaId: rotaValue } : s)),
    )
  }

  // Itens do contrato
  const handleAddItem = () => {
    const defaultProduct = products[0]
    setContractItems((prev) => [
      ...prev,
      {
        productId: defaultProduct?.id || '',
        price: defaultProduct?.price || 0,
        cotaAnual: 500,
      },
    ])
  }

  const handleRemoveItem = (index: number) => {
    setContractItems((prev) => prev.filter((_, i) => i !== index))
  }

  const handleItemProductChange = (index: number, newProductId: string) => {
    const prod = products.find((p) => p.id === newProductId)
    setContractItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item
        return {
          ...item,
          productId: newProductId,
          price: item.price > 0 ? item.price : prod?.price || 0,
        }
      }),
    )
  }

  const handleItemPriceChange = (index: number, newPrice: number) => {
    setContractItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, price: newPrice } : item)),
    )
  }

  const handleItemCotaChange = (index: number, newCota: number) => {
    setContractItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, cotaAnual: newCota } : item)),
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedNum = numero.trim()
    if (!trimmedNum) {
      toast.error('Informe o número ou código do contrato.')
      return
    }

    const val = parseFloat(valorTotal.replace(',', '.'))
    if (isNaN(val) || val <= 0) {
      toast.error('Informe um valor total válido.')
      return
    }

    setIsSubmitting(true)
    try {
      let contractId = editingContract?.id

      if (editingContract) {
        await contratosService.update(editingContract.id, {
          numero: trimmedNum,
          tipo,
          modalidade_pedido: modalidade,
          valor_total: val,
          status,
        })
      } else {
        const created = await contratosService.create({
          numero: trimmedNum,
          tipo,
          modalidade_pedido: modalidade,
          valor_total: val,
          status,
        })
        contractId = created.id
      }

      if (contractId) {
        // 1. Salvar / Atualizar Rotas do contrato
        const savedRotasMap = new Map<string, string>() // rotaNome -> rotaId

        for (const cr of contractRotas) {
          if (cr.id) {
            await rotasService.update(cr.id, { nome: cr.nome, ordem: cr.ordem })
            savedRotasMap.set(cr.nome, cr.id)
          } else {
            const newR = await rotasService.create({
              contrato_id: contractId,
              nome: cr.nome,
              ordem: cr.ordem,
            })
            savedRotasMap.set(cr.nome, newR.id)
          }
        }

        // 2. Salvar Vínculo N:N de Escolas e Rotas (contrato_escolas)
        const currentLinks = await contratosService.getEscolas(contractId)
        const formSchoolIds = new Set(contractSchoolsForm.map((f) => f.escolaId))

        // Remover escolas desmarcadas
        for (const cl of currentLinks) {
          if (!formSchoolIds.has(cl.escola_id)) {
            await contratosService.unlinkEscola(cl.id)
          }
        }

        // Adicionar / Atualizar escolas marcadas com sua rota
        for (const f of contractSchoolsForm) {
          // Resolver id da rota (se o form tiver o nome ou id da rota)
          let rId = f.rotaId
          if (savedRotasMap.has(f.rotaId)) {
            rId = savedRotasMap.get(f.rotaId)!
          }

          await contratosService.linkEscola({
            contrato_id: contractId,
            escola_id: f.escolaId,
            rota_id: rId || undefined,
          })
        }

        // 3. Sincronizar itens e cota_anual
        const validItems = contractItems.filter((i) => i.productId && i.price > 0)
        await contratosService.syncItems(
          contractId,
          validItems.map((it) => ({
            id: it.id,
            produto_id: it.productId,
            preco: it.price,
            cota_anual: it.cotaAnual || 0,
          })),
        )
      }

      toast.success(`Contrato ${trimmedNum} salvo com sucesso!`)
      setDialogOpen(false)
      await refreshData()
    } catch (err: any) {
      console.error('Erro ao salvar contrato:', err)
      toast.error('Falha ao salvar contrato no banco.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOpenDelete = (contract: Contract) => {
    setContractToDelete(contract)
    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!contractToDelete) return
    setIsDeleting(true)
    try {
      await contratosService.delete(contractToDelete.id)
      toast.success(`Contrato ${contractToDelete.numero} excluído com sucesso!`)
      setDeleteDialogOpen(false)
      setContractToDelete(null)
      await refreshData()
    } catch (err: any) {
      console.error('Erro ao excluir contrato:', err)
      toast.error('Falha ao excluir contrato.')
    } finally {
      setIsDeleting(false)
    }
  }

  // Relatório do Contrato: Métricas Globais e Detalhamento por Escola Participante
  const reportData = useMemo(() => {
    if (!reportContract) return null

    const totalContratado = reportContract.totalValue
    const participatingSchoolIds = new Set(reportContract.escolas.map((e) => e.escolaId))

    // Pedidos realizados deste contrato
    const contractOrders = orders.filter(
      (o) => participatingSchoolIds.has(o.schoolId) && o.status !== 'Cancelado',
    )
    const totalRealizado = contractOrders.reduce((acc, o) => acc + o.total, 0)
    const percentExecucaoGlobal =
      totalContratado > 0 ? Math.min(100, (totalRealizado / totalContratado) * 100) : 0

    // Detalhamento por escola participante
    const escolasReport = reportContract.escolas.map((escolaLink) => {
      const schOrders = contractOrders.filter((o) => o.schoolId === escolaLink.escolaId)
      const schRealizadoTotal = schOrders.reduce((acc, o) => acc + o.total, 0)

      // Produtos consumidos por esta escola
      const produtosConsumo: Record<string, { realizadoQtd: number; realizadoValor: number }> = {}

      for (const ord of schOrders) {
        for (const item of ord.items) {
          if (!produtosConsumo[item.productId]) {
            produtosConsumo[item.productId] = { realizadoQtd: 0, realizadoValor: 0 }
          }
          const prev = produtosConsumo[item.productId]
          prev.realizadoQtd += item.quantity
          prev.realizadoValor += item.quantity * item.price
        }
      }

      // Detalhamento por produto acordado no contrato
      const itensDetalhados = viewingItems.map((ci) => {
        const prod = products.find((p) => p.id === ci.produto_id)
        const cotaAnual = Number(ci.cota_anual) || 0
        const cotaPorEscola =
          reportContract.escolas.length > 0
            ? Math.round((cotaAnual / reportContract.escolas.length) * 100) / 100
            : cotaAnual

        const consumo = produtosConsumo[ci.produto_id] || {
          realizadoQtd: 0,
          realizadoValor: 0,
        }
        const pct = cotaPorEscola > 0 ? (consumo.realizadoQtd / cotaPorEscola) * 100 : 0

        return {
          produtoId: ci.produto_id,
          produtoNome: ci.expand?.produto_id?.nome || prod?.name || 'Produto',
          unidade: ci.expand?.produto_id?.unidade || prod?.unit || 'Kg',
          preco: Number(ci.preco) || prod?.price || 0,
          cotaAnual: cotaPorEscola,
          realizadoQtd: consumo.realizadoQtd,
          realizadoValor: consumo.realizadoValor,
          percentExecucao: Math.min(100, pct),
        }
      })

      return {
        escolaId: escolaLink.escolaId,
        escolaNome: escolaLink.escolaNome || 'Escola',
        rotaNome: escolaLink.rotaNome || 'Sem Rota',
        totalRealizadoValor: schRealizadoTotal,
        itens: itensDetalhados,
      }
    })

    return {
      totalContratado,
      totalRealizado,
      percentExecucaoGlobal,
      escolasReport,
    }
  }, [reportContract, orders, viewingItems, products])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contratos & Escolas Participantes</h1>
          <p className="text-muted-foreground">
            Gestão N:N de escolas participantes, rotas logísticas, cotas anuais e modalidades de
            pedido.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={handleOpenCreate} className="gap-2">
            <Plus className="h-4 w-4" /> Novo Contrato
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> Contratos Vigentes
          </CardTitle>
          <CardDescription>
            Relação completa de contratos, escolas vinculadas, rotas e modalidades operacionais.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contrato</TableHead>
                  <TableHead>Programa</TableHead>
                  <TableHead>Modalidade</TableHead>
                  <TableHead>Escolas Participantes</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor Total</TableHead>
                  <TableHead className="text-right">Saldo Restante</TableHead>
                  <TableHead className="w-[150px]">Execução</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> Carregando contratos...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : contracts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      Nenhum contrato cadastrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  contracts.map((contract) => {
                    const total = contract.totalValue || 1
                    const used = Math.max(0, contract.totalValue - contract.balance)
                    const percentage = Math.min(100, Math.max(0, (used / total) * 100))

                    return (
                      <TableRow key={contract.id}>
                        <TableCell className="font-semibold text-primary">
                          <button
                            type="button"
                            onClick={() => handleOpenDetails(contract)}
                            className="hover:underline text-left font-bold"
                          >
                            {contract.numero}
                          </button>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{contract.tipo || 'PNAE'}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              contract.modalidade_pedido === 'centralizado'
                                ? 'secondary'
                                : 'default'
                            }
                            className="capitalize text-xs"
                          >
                            {contract.modalidade_pedido || 'individualizado'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span
                            className="text-xs text-muted-foreground"
                            title={contract.escolas.map((e) => e.escolaNome).join(', ')}
                          >
                            {contract.escolas.length > 0
                              ? `${contract.escolas.length} escola(s) vinculada(s)`
                              : 'Nenhuma escola vinculada'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              contract.status === 'Ativo'
                                ? 'bg-primary'
                                : contract.status === 'Encerrado'
                                  ? 'bg-muted-foreground'
                                  : 'bg-amber-600'
                            }
                          >
                            {contract.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          R${' '}
                          {contract.totalValue.toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                          })}
                        </TableCell>
                        <TableCell className="text-right font-medium text-emerald-600">
                          R${' '}
                          {contract.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Progress value={percentage} className="h-2" />
                            <span className="text-[10px] text-muted-foreground text-right">
                              {percentage.toFixed(0)}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-primary"
                              title="Relatório de Execução"
                              onClick={() => handleOpenReport(contract)}
                            >
                              <BarChart3 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground"
                              title="Ver detalhes"
                              onClick={() => handleOpenDetails(contract)}
                            >
                              <Info className="h-4 w-4" />
                            </Button>
                            {isAdmin && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                  title="Editar contrato"
                                  onClick={() => handleOpenEdit(contract)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                  title="Excluir contrato"
                                  onClick={() => handleOpenDelete(contract)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* DIALOG DE CADASTRO / EDIÇÃO DE CONTRATO (COM N ESCOLAS E ROTAS) */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[780px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingContract
                ? `Editar Contrato ${editingContract.numero}`
                : 'Cadastrar Novo Contrato'}
            </DialogTitle>
            <DialogDescription>
              Configure os dados cadastrais, as rotas de entrega, as escolas participantes e a cota
              anual de cada produto.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <Tabs defaultValue="geral" className="w-full">
              <TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger value="geral">Dados Gerais</TabsTrigger>
                <TabsTrigger value="rotas">Rotas ({contractRotas.length})</TabsTrigger>
                <TabsTrigger value="escolas">Escolas ({contractSchoolsForm.length})</TabsTrigger>
                <TabsTrigger value="produtos">Itens & Cotas ({contractItems.length})</TabsTrigger>
              </TabsList>

              {/* Aba 1: Dados Gerais */}
              <TabsContent value="geral" className="space-y-4 pt-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="c-num">
                      Número / Identificador <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="c-num"
                      placeholder="Ex: C-2026-05"
                      value={numero}
                      onChange={(e) => setNumero(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="c-tipo">Tipo de Programa</Label>
                    <Select value={tipo} onValueChange={setTipo}>
                      <SelectTrigger id="c-tipo">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PNAE">PNAE (Alimentação Escolar)</SelectItem>
                        <SelectItem value="PAA">PAA (Aquisição de Alimentos)</SelectItem>
                        <SelectItem value="Municipal">Municipal / Direto</SelectItem>
                        <SelectItem value="Outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="c-modalidade">Modalidade de Pedido</Label>
                    <Select
                      value={modalidade}
                      onValueChange={(v) => setModalidade(v as 'individualizado' | 'centralizado')}
                    >
                      <SelectTrigger id="c-modalidade">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="individualizado">
                          Individualizado (Pedido por Escola via WhatsApp/Manual)
                        </SelectItem>
                        <SelectItem value="centralizado">
                          Centralizado (Consolidado por Importação de Planilha)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="c-status">Status</Label>
                    <Select
                      value={status}
                      onValueChange={(v) => setStatus(v as 'Ativo' | 'Encerrado' | 'Pendente')}
                    >
                      <SelectTrigger id="c-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Ativo">Ativo</SelectItem>
                        <SelectItem value="Pendente">Pendente</SelectItem>
                        <SelectItem value="Encerrado">Encerrado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="c-total">
                    Valor Total do Contrato (R$) <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="c-total"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Ex: 50000.00"
                      className="pl-9"
                      value={valorTotal}
                      onChange={(e) => setValorTotal(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </TabsContent>

              {/* Aba 2: Gestão de Rotas do Contrato */}
              <TabsContent value="rotas" className="space-y-3 pt-3">
                <div>
                  <Label className="text-sm font-semibold">Rotas Logísticas deste Contrato</Label>
                  <p className="text-xs text-muted-foreground">
                    Defina as rotas que atendem as escolas (ex.: ROTA A, ROTA B).
                  </p>
                </div>

                <div className="flex gap-2">
                  <Input
                    placeholder="Nome da Rota (ex.: ROTA C)"
                    value={newRotaNome}
                    onChange={(e) => setNewRotaNome(e.target.value)}
                    className="h-9"
                  />
                  <Button type="button" onClick={handleAddRota} className="h-9 gap-1 text-xs">
                    <Plus className="h-3.5 w-3.5" /> Adicionar Rota
                  </Button>
                </div>

                <div className="space-y-2 max-h-[220px] overflow-y-auto">
                  {contractRotas.map((r, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 rounded border bg-muted/20 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{idx + 1}º</Badge>
                        <span className="font-semibold">{r.nome}</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => handleRemoveRota(idx)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </TabsContent>

              {/* Aba 3: Escolas Participantes (N:N com Rota) */}
              <TabsContent value="escolas" className="space-y-3 pt-3">
                <div>
                  <Label className="text-sm font-semibold">
                    Escolas Participantes & Atribuição de Rota
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    O vínculo aqui registra formalmente a escola no contrato e define sua rota
                    logística.
                  </p>
                </div>

                <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                  {schools.map((sch) => {
                    const isSelected = contractSchoolsForm.some((s) => s.escolaId === sch.id)
                    const assignedLink = contractSchoolsForm.find((s) => s.escolaId === sch.id)

                    return (
                      <div
                        key={sch.id}
                        className={`flex items-center justify-between p-2 rounded-lg border text-xs transition-colors ${
                          isSelected
                            ? 'bg-primary/5 border-primary/40'
                            : 'bg-muted/10 border-border opacity-70 hover:opacity-100'
                        }`}
                      >
                        <div className="flex items-center gap-2 flex-1">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSchool(sch.id)}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                          />
                          <div>
                            <p className="font-medium text-foreground">{sch.name}</p>
                            <p className="text-[10px] text-muted-foreground">{sch.address}</p>
                          </div>
                        </div>

                        {isSelected && (
                          <div className="w-44 shrink-0">
                            <Select
                              value={assignedLink?.rotaId || contractRotas[0]?.nome || ''}
                              onValueChange={(val) => handleSchoolRotaChange(sch.id, val)}
                            >
                              <SelectTrigger className="h-7 text-xs">
                                <SelectValue placeholder="Selecione a Rota" />
                              </SelectTrigger>
                              <SelectContent>
                                {contractRotas.map((cr, i) => (
                                  <SelectItem key={i} value={cr.id || cr.nome}>
                                    {cr.nome}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </TabsContent>

              {/* Aba 4: Produtos, Preços e Cotas Anuais */}
              <TabsContent value="produtos" className="space-y-3 pt-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-semibold">Tabela de Produtos & Cota Anual</Label>
                    <p className="text-xs text-muted-foreground">
                      Preço acordado e cota anual em Kg/Un para acompanhamento de execução.
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

                <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                  {contractItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 p-2 rounded-lg border bg-muted/20 text-xs"
                    >
                      <div className="flex-1 min-w-0">
                        <Select
                          value={item.productId}
                          onValueChange={(val) => handleItemProductChange(idx, val)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Produto" />
                          </SelectTrigger>
                          <SelectContent>
                            {products.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name} ({p.unit})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="w-24 shrink-0">
                        <Label className="text-[10px] text-muted-foreground">Preço (R$)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          className="h-7 text-xs"
                          value={item.price || ''}
                          onChange={(e) =>
                            handleItemPriceChange(idx, parseFloat(e.target.value) || 0)
                          }
                        />
                      </div>

                      <div className="w-28 shrink-0">
                        <Label className="text-[10px] text-muted-foreground">Cota Anual</Label>
                        <Input
                          type="number"
                          step="1"
                          min="0"
                          placeholder="Qtd anual"
                          className="h-7 text-xs"
                          value={item.cotaAnual || ''}
                          onChange={(e) =>
                            handleItemCotaChange(idx, parseFloat(e.target.value) || 0)
                          }
                        />
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive shrink-0 mt-3.5"
                        onClick={() => handleRemoveItem(idx)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter className="pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...
                  </>
                ) : editingContract ? (
                  'Salvar Alterações'
                ) : (
                  'Cadastrar Contrato'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG DE RELATÓRIO DE EXECUÇÃO DO CONTRATO */}
      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" /> Relatório de Execução do Contrato{' '}
              {reportContract?.numero}
            </DialogTitle>
            <DialogDescription>
              Acompanhamento de cotas, valores e percentual de entrega por escola participante.
            </DialogDescription>
          </DialogHeader>

          {reportData && (
            <div className="space-y-4 pt-2">
              {/* Cards Globais de Execução */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="p-4 text-center">
                    <p className="text-xs text-muted-foreground">Total Contratado</p>
                    <p className="text-xl font-bold text-foreground mt-1">
                      R${' '}
                      {reportData.totalContratado.toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                      })}
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-emerald-500/10 border-emerald-500/20">
                  <CardContent className="p-4 text-center">
                    <p className="text-xs text-muted-foreground">Total Realizado</p>
                    <p className="text-xl font-bold text-emerald-600 mt-1">
                      R${' '}
                      {reportData.totalRealizado.toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                      })}
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-blue-500/10 border-blue-500/20">
                  <CardContent className="p-4 text-center">
                    <p className="text-xs text-muted-foreground">% Execução Global</p>
                    <p className="text-xl font-bold text-blue-600 mt-1">
                      {reportData.percentExecucaoGlobal.toFixed(1)}%
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Tabela de Execução por Escola Participante */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold">Execução por Escola Participante</h4>
                {reportData.escolasReport.map((esc) => (
                  <Card key={esc.escolaId} className="border">
                    <CardHeader className="py-3 bg-muted/20">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-sm font-bold text-primary">
                            {esc.escolaNome}
                          </CardTitle>
                          <CardDescription className="text-xs">
                            Rota: {esc.rotaNome}
                          </CardDescription>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Valor Realizado</p>
                          <p className="text-sm font-bold text-foreground">
                            R${' '}
                            {esc.totalRealizadoValor.toLocaleString('pt-BR', {
                              minimumFractionDigits: 2,
                            })}
                          </p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow className="text-xs">
                            <TableHead>Produto</TableHead>
                            <TableHead className="text-right">Cota Anual</TableHead>
                            <TableHead className="text-right">Realizado</TableHead>
                            <TableHead className="text-right">Valor Realizado</TableHead>
                            <TableHead className="w-28 text-right">% Execução</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {esc.itens.map((it) => (
                            <TableRow key={it.produtoId} className="text-xs">
                              <TableCell className="font-medium">{it.produtoNome}</TableCell>
                              <TableCell className="text-right font-mono">
                                {it.cotaAnual} {it.unidade}
                              </TableCell>
                              <TableCell className="text-right font-mono text-primary font-semibold">
                                {it.realizadoQtd} {it.unidade}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                R$ {it.realizadoValor.toFixed(2)}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <Progress value={it.percentExecucao} className="h-1.5 w-16" />
                                  <span className="font-mono text-[11px]">
                                    {it.percentExecucao.toFixed(0)}%
                                  </span>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* DIALOG DE EXCLUSÃO */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirmar Exclusão de Contrato
            </AlertDialogTitle>
            <AlertDialogDescription>
              Deseja realmente remover o contrato <strong>{contractToDelete?.numero}</strong>? Isso
              removerá os vínculos de escolas, rotas e itens acordados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleConfirmDelete()
              }}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? 'Excluindo...' : 'Excluir Contrato'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* DIALOG DE DETALHES GERAIS */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Contrato {viewingContract?.numero}</DialogTitle>
            <DialogDescription>
              {viewingContract?.tipo || 'PNAE'} • Modalidade:{' '}
              {viewingContract?.modalidade_pedido || 'individualizado'}
            </DialogDescription>
          </DialogHeader>

          {viewingContract && (
            <div className="space-y-4 pt-2 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded border bg-muted/20">
                  <p className="text-muted-foreground">Valor Total</p>
                  <p className="text-base font-bold text-foreground">
                    R$ {viewingContract.totalValue.toFixed(2)}
                  </p>
                </div>
                <div className="p-3 rounded border bg-muted/20">
                  <p className="text-muted-foreground">Saldo Restante</p>
                  <p className="text-base font-bold text-emerald-600">
                    R$ {viewingContract.balance.toFixed(2)}
                  </p>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-sm mb-1.5">Escolas Participantes</h4>
                <div className="space-y-1">
                  {viewingContract.escolas.map((e) => (
                    <div
                      key={e.id}
                      className="flex items-center justify-between p-2 rounded bg-muted/20 border"
                    >
                      <span>{e.escolaNome}</span>
                      <Badge variant="outline">{e.rotaNome}</Badge>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-sm mb-1.5">Itens e Preços Acordados</h4>
                <div className="space-y-1">
                  {viewingItems.map((it) => (
                    <div
                      key={it.id}
                      className="flex items-center justify-between p-2 rounded bg-muted/20 border"
                    >
                      <span>{it.expand?.produto_id?.nome || 'Produto'}</span>
                      <span className="font-mono">
                        R$ {Number(it.preco).toFixed(2)} • Cota: {it.cota_anual || 0}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
