import { useApp } from '@/context/app-context'
import { useAuth } from '@/context/auth-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
import {
  FileText,
  Plus,
  Loader2,
  Pencil,
  Trash2,
  AlertTriangle,
  Info,
  DollarSign,
  Package,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { contratosService } from '@/services/contratos'
import type { Contract, ContratoItemRecord } from '@/lib/types'

interface FormContractItem {
  id?: string
  productId: string
  price: number
}

export default function Contracts() {
  const { contracts, schools, products, isLoading, refreshData } = useApp()
  const { isAdmin } = useAuth()

  // Form state (Create/Edit)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingContract, setEditingContract] = useState<Contract | null>(null)
  const [numero, setNumero] = useState('')
  const [tipo, setTipo] = useState('PNAE')
  const [schoolId, setSchoolId] = useState('')
  const [valorTotal, setValorTotal] = useState('')
  const [status, setStatus] = useState<'Ativo' | 'Encerrado' | 'Pendente'>('Ativo')
  const [contractItems, setContractItems] = useState<FormContractItem[]>([])
  const [isLoadingItems, setIsLoadingItems] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Delete state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [contractToDelete, setContractToDelete] = useState<Contract | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Details dialog state
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false)
  const [viewingContract, setViewingContract] = useState<Contract | null>(null)
  const [viewingItems, setViewingItems] = useState<ContratoItemRecord[]>([])
  const [loadingDetails, setLoadingDetails] = useState(false)

  const handleOpenCreate = () => {
    setEditingContract(null)
    const nextNumber = `C-${new Date().getFullYear()}-${String(contracts.length + 1).padStart(2, '0')}`
    setNumero(nextNumber)
    setTipo('PNAE')
    setSchoolId(schools[0]?.id || '')
    setValorTotal('')
    setStatus('Ativo')
    setContractItems([])
    setDialogOpen(true)
  }

  const handleOpenEdit = async (contract: Contract) => {
    setEditingContract(contract)
    setNumero(contract.numero)
    setTipo(contract.tipo || 'PNAE')
    setSchoolId(contract.schoolId)
    setValorTotal(String(contract.totalValue || ''))
    setStatus(contract.status)
    setDialogOpen(true)
    setIsLoadingItems(true)

    try {
      const items = await contratosService.getItems(contract.id)
      setContractItems(
        items.map((i) => ({
          id: i.id,
          productId: i.produto_id,
          price: Number(i.preco) || 0,
        })),
      )
    } catch (err) {
      console.error('Erro ao buscar itens do contrato:', err)
      toast.error('Erro ao carregar a tabela de itens do contrato.')
      setContractItems([])
    } finally {
      setIsLoadingItems(false)
    }
  }

  const handleOpenDetails = async (contract: Contract) => {
    setViewingContract(contract)
    setDetailsDialogOpen(true)
    setLoadingDetails(true)
    try {
      const items = await contratosService.getItems(contract.id)
      setViewingItems(items)
    } catch (err) {
      console.error('Erro ao buscar itens:', err)
      setViewingItems([])
    } finally {
      setLoadingDetails(false)
    }
  }

  const handleAddItem = () => {
    const defaultProduct = products[0]
    setContractItems((prev) => [
      ...prev,
      {
        productId: defaultProduct?.id || '',
        price: defaultProduct?.price || 0,
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
          // Prefill with product catalog price if zero
          price: item.price > 0 ? item.price : prod?.price || 0,
        }
      }),
    )
  }

  const handleItemPriceChange = (index: number, newPrice: number) => {
    setContractItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item
        return {
          ...item,
          price: newPrice,
        }
      }),
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const trimmedNum = numero.trim()
    if (!trimmedNum) {
      toast.error('Informe o número ou código identificador do contrato.')
      return
    }

    if (!schoolId) {
      toast.error('Selecione a instituição escolar do contrato.')
      return
    }

    const val = parseFloat(valorTotal.replace(',', '.'))
    if (isNaN(val) || val <= 0) {
      toast.error('Informe um valor total válido e maior que zero.')
      return
    }

    // Validate duplicate products in items list
    const validItems = contractItems.filter((i) => i.productId && i.price > 0)
    const productIds = validItems.map((i) => i.productId)
    const hasDuplicates = new Set(productIds).size !== productIds.length
    if (hasDuplicates) {
      toast.error(
        'Existem produtos repetidos na lista de itens do contrato. Ajuste antes de salvar.',
      )
      return
    }

    setIsSubmitting(true)
    try {
      let contractId = editingContract?.id

      if (editingContract) {
        await contratosService.update(editingContract.id, {
          numero: trimmedNum,
          tipo,
          instituicao_id: schoolId,
          valor_total: val,
          status,
        })
      } else {
        const created = await contratosService.create({
          numero: trimmedNum,
          tipo,
          instituicao_id: schoolId,
          valor_total: val,
          status,
        })
        contractId = created.id
      }

      // Synchronize contract items
      if (contractId) {
        try {
          await contratosService.syncItems(
            contractId,
            validItems.map((it) => ({
              id: it.id,
              produto_id: it.productId,
              preco: it.price,
            })),
          )
        } catch (itemErr) {
          console.error('Falha ao sincronizar itens do contrato:', itemErr)
          toast.error('Contrato salvo, mas houve erro ao atualizar a lista de itens vinculados.')
        }
      }

      toast.success(
        editingContract
          ? `Contrato ${trimmedNum} atualizado com sucesso!`
          : `Contrato ${trimmedNum} cadastrado com sucesso!`,
      )
      setDialogOpen(false)
      await refreshData()
    } catch (err: any) {
      console.error('Erro ao salvar contrato:', err)
      const message =
        err?.response?.message || err?.message || 'Falha ao salvar contrato no banco de dados.'
      toast.error(message)
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
      toast.success(`Contrato ${contractToDelete.numero} e itens excluídos com sucesso!`)
      setDeleteDialogOpen(false)
      setContractToDelete(null)
      await refreshData()
    } catch (err: any) {
      console.error('Erro ao excluir contrato:', err)
      const message =
        err?.response?.message ||
        err?.message ||
        'Não foi possível excluir o contrato. Verifique vínculos com pedidos.'
      toast.error(message)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contratos Institucionais</h1>
          <p className="text-muted-foreground">
            Acompanhe saldos, vigências e tabela de itens dos contratos PNAE e PAA.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={handleOpenCreate}>
            <Plus className="mr-2 h-4 w-4" /> Novo Contrato
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Visão Geral de Contratos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contrato ID</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Instituição</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor Total</TableHead>
                  <TableHead className="text-right">Saldo Restante</TableHead>
                  <TableHead className="w-[180px]">Execução</TableHead>
                  <TableHead className="w-[120px] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Carregando contratos do banco...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : contracts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Nenhum contrato cadastrado no banco.
                    </TableCell>
                  </TableRow>
                ) : (
                  contracts.map((contract) => {
                    const total = contract.totalValue || 1
                    const used = Math.max(0, contract.totalValue - contract.balance)
                    const percentage = Math.min(100, Math.max(0, (used / total) * 100))

                    const statusBadgeClass =
                      contract.status === 'Ativo'
                        ? 'bg-primary'
                        : contract.status === 'Encerrado'
                          ? 'bg-muted-foreground'
                          : 'bg-amber-600'

                    return (
                      <TableRow key={contract.id}>
                        <TableCell className="font-medium text-primary">
                          <button
                            type="button"
                            onClick={() => handleOpenDetails(contract)}
                            className="hover:underline font-semibold text-left"
                            title="Clique para ver itens e detalhes"
                          >
                            {contract.numero || contract.id}
                          </button>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-normal text-xs">
                            {contract.tipo || 'PNAE'}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate" title={contract.schoolName}>
                          {contract.schoolName}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={contract.status === 'Ativo' ? 'default' : 'secondary'}
                            className={statusBadgeClass}
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
                          <div className="flex flex-col gap-1.5">
                            <Progress value={percentage} className="h-2" />
                            <span className="text-xs text-muted-foreground text-right">
                              {percentage.toFixed(0)}% utilizado
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              title="Ver detalhes e itens"
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
                                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
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

      {/* Dialog Criar / Editar Contrato */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingContract
                ? `Editar Contrato ${editingContract.numero}`
                : 'Cadastrar Novo Contrato'}
            </DialogTitle>
            <DialogDescription>
              {editingContract
                ? 'Atualize os dados do contrato e gerencie a tabela de itens/preços acordados.'
                : 'Informe os dados contratuais com a instituição e vincule os produtos fornecidos.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contract-numero">
                  Número / Identificador <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="contract-numero"
                  placeholder="Ex: C-2026-04"
                  value={numero}
                  onChange={(e) => setNumero(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contract-tipo">Tipo de Programa</Label>
                <Select value={tipo} onValueChange={setTipo}>
                  <SelectTrigger id="contract-tipo">
                    <SelectValue placeholder="Selecione o programa" />
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
                <Label htmlFor="contract-school">
                  Instituição Escolar <span className="text-destructive">*</span>
                </Label>
                <Select value={schoolId} onValueChange={setSchoolId} required>
                  <SelectTrigger id="contract-school">
                    <SelectValue placeholder="Selecione a instituição" />
                  </SelectTrigger>
                  <SelectContent>
                    {schools.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} ({s.route})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contract-status">Status do Contrato</Label>
                <Select
                  value={status}
                  onValueChange={(v) => setStatus(v as 'Ativo' | 'Encerrado' | 'Pendente')}
                >
                  <SelectTrigger id="contract-status">
                    <SelectValue placeholder="Selecione o status" />
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
              <Label htmlFor="contract-total">
                Valor Total do Contrato (R$) <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="contract-total"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Ex: 25000.00"
                  className="pl-9"
                  value={valorTotal}
                  onChange={(e) => setValorTotal(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Itens do Contrato */}
            <div className="space-y-3 pt-3 border-t border-border">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-semibold text-sm">Produtos e Preços Acordados</Label>
                  <p className="text-xs text-muted-foreground">
                    Defina quais produtos compõem este contrato e o preço pactuado com a
                    instituição.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddItem}
                  className="h-8 text-xs shrink-0"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar Produto
                </Button>
              </div>

              {isLoadingItems ? (
                <div className="flex items-center justify-center py-6 text-xs text-muted-foreground gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando itens do contrato...
                </div>
              ) : contractItems.length === 0 ? (
                <div className="p-4 rounded-lg border border-dashed text-center text-xs text-muted-foreground bg-muted/20">
                  Nenhum produto cadastrado no contrato ainda. Clique em "Adicionar Produto" para
                  vincular itens da cooperativa.
                </div>
              ) : (
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {contractItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 p-2 rounded-lg border bg-muted/20 text-sm"
                    >
                      <div className="flex-1 min-w-0">
                        <Select
                          value={item.productId}
                          onValueChange={(val) => handleItemProductChange(idx, val)}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Selecione o produto" />
                          </SelectTrigger>
                          <SelectContent>
                            {products.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name} ({p.unit}) - Catálogo: R$ {p.price.toFixed(2)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="w-28 shrink-0">
                        <div className="relative">
                          <span className="absolute left-2 top-2 text-xs text-muted-foreground">
                            R$
                          </span>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="Preço"
                            className="h-9 pl-7 text-xs"
                            value={item.price || ''}
                            onChange={(e) =>
                              handleItemPriceChange(idx, parseFloat(e.target.value) || 0)
                            }
                          />
                        </div>
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                        onClick={() => handleRemoveItem(idx)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter className="pt-2">
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

      {/* AlertDialog Excluir Contrato */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirmar Exclusão de Contrato
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Tem certeza de que deseja excluir o contrato{' '}
                <strong className="text-foreground">{contractToDelete?.numero}</strong> (
                {contractToDelete?.schoolName})?
              </p>
              <p className="text-xs text-muted-foreground">
                Esta ação removerá o contrato e todos os itens de produto vinculados a ele na tabela{' '}
                <code className="text-primary font-mono">contrato_itens</code>.
              </p>
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
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Excluindo...
                </>
              ) : (
                'Excluir Contrato'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog Detalhes do Contrato */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Detalhes do Contrato {viewingContract?.numero}
            </DialogTitle>
            <DialogDescription>
              {viewingContract?.schoolName} • {viewingContract?.tipo || 'PNAE'}
            </DialogDescription>
          </DialogHeader>

          {viewingContract && (
            <div className="space-y-4 pt-1">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 rounded-lg border bg-muted/20">
                  <div className="text-xs text-muted-foreground">Valor Total</div>
                  <div className="text-lg font-bold text-foreground mt-0.5">
                    R${' '}
                    {viewingContract.totalValue.toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                    })}
                  </div>
                </div>
                <div className="p-3 rounded-lg border bg-muted/20">
                  <div className="text-xs text-muted-foreground">Saldo Restante</div>
                  <div className="text-lg font-bold text-emerald-600 mt-0.5">
                    R${' '}
                    {viewingContract.balance.toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                    })}
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                  <Package className="h-4 w-4 text-primary" /> Tabela de Itens e Preços Pactuados
                </h4>
                {loadingDetails ? (
                  <div className="flex items-center justify-center py-6 text-xs text-muted-foreground gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Carregando itens...
                  </div>
                ) : viewingItems.length === 0 ? (
                  <div className="p-4 rounded-lg border border-dashed text-center text-xs text-muted-foreground">
                    Nenhum produto cadastrado formalmente neste contrato.
                  </div>
                ) : (
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Produto</TableHead>
                          <TableHead className="text-xs">Unidade</TableHead>
                          <TableHead className="text-xs text-right">Preço Contratual</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {viewingItems.map((item) => {
                          const prod = products.find((p) => p.id === item.produto_id)
                          const prodName = item.expand?.produto_id?.nome || prod?.name || 'Produto'
                          const prodUnit = item.expand?.produto_id?.unidade || prod?.unit || 'Un'
                          return (
                            <TableRow key={item.id} className="text-xs">
                              <TableCell className="font-medium">{prodName}</TableCell>
                              <TableCell>{prodUnit}</TableCell>
                              <TableCell className="text-right font-medium">
                                R${' '}
                                {Number(item.preco).toLocaleString('pt-BR', {
                                  minimumFractionDigits: 2,
                                })}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="pt-2">
            {isAdmin && viewingContract && (
              <Button
                variant="outline"
                onClick={() => {
                  setDetailsDialogOpen(false)
                  handleOpenEdit(viewingContract)
                }}
              >
                <Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar Contrato
              </Button>
            )}
            <Button onClick={() => setDetailsDialogOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
