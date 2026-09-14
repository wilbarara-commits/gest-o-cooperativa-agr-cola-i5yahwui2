import { useState, useMemo } from 'react'
import type { Product } from '@/lib/types'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { Textarea } from '@/components/ui/textarea'
import {
  Search,
  Plus,
  Trash2,
  ClipboardPaste,
  Check,
  AlertCircle,
  HelpCircle,
  RotateCcw,
  Sparkles,
  Package,
} from 'lucide-react'
import { normalizeName } from '@/lib/excelImporter'
import { toast } from 'sonner'

export interface ContractItemForm {
  id?: string
  productId: string
  price: number
}

interface ContractItemsManagerProps {
  items: ContractItemForm[]
  onChange: (items: ContractItemForm[]) => void
  catalogProducts: Product[]
}

export function ContractItemsManager({
  items,
  onChange,
  catalogProducts,
}: ContractItemsManagerProps) {
  // Modal de Seleção em Lote do Catálogo
  const [batchModalOpen, setBatchModalOpen] = useState(false)
  const [batchSearchQuery, setBatchSearchQuery] = useState('')
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set())

  // Modal de Colar em Massa
  const [pasteModalOpen, setPasteModalOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [pastePreview, setPastePreview] = useState<{
    matched: Array<{ product: Product; price: number; originalLine: string }>
    unmatched: string[]
  } | null>(null)

  // Confirmação de exclusão individual
  const [itemToDeleteIndex, setItemToDeleteIndex] = useState<number | null>(null)

  // Map rápido de produtos do catálogo por ID
  const productById = useMemo(() => {
    const map = new Map<string, Product>()
    for (const p of catalogProducts) {
      map.set(p.id, p)
    }
    return map
  }, [catalogProducts])

  // IDs já inclusos no contrato
  const includedProductIds = useMemo(() => {
    return new Set(items.map((it) => it.productId))
  }, [items])

  // Produtos disponíveis para seleção em lote (com filtro de busca)
  const filteredCatalogForBatch = useMemo(() => {
    const q = batchSearchQuery.trim().toLowerCase()
    return catalogProducts.filter((p) => {
      if (!q) return true
      return (
        p.name.toLowerCase().includes(q) ||
        (p.category && p.category.toLowerCase().includes(q)) ||
        (p.unit && p.unit.toLowerCase().includes(q))
      )
    })
  }, [catalogProducts, batchSearchQuery])

  // Abertura do modal de lote: inicializa seleção com itens que ainda NÃO estão no contrato
  const handleOpenBatchModal = () => {
    setBatchSearchQuery('')
    setSelectedProductIds(new Set())
    setBatchModalOpen(true)
  }

  const handleToggleSelectProduct = (productId: string) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev)
      if (next.has(productId)) {
        next.delete(productId)
      } else {
        next.add(productId)
      }
      return next
    })
  }

  const handleSelectAllVisible = () => {
    const availableVisible = filteredCatalogForBatch.filter((p) => !includedProductIds.has(p.id))
    const allSelected = availableVisible.every((p) => selectedProductIds.has(p.id))

    setSelectedProductIds((prev) => {
      const next = new Set(prev)
      if (allSelected) {
        for (const p of availableVisible) {
          next.delete(p.id)
        }
      } else {
        for (const p of availableVisible) {
          next.add(p.id)
        }
      }
      return next
    })
  }

  const handleConfirmBatchAdd = () => {
    if (selectedProductIds.size === 0) {
      toast.warning('Selecione pelo menos um produto.')
      return
    }

    const newItems: ContractItemForm[] = []
    let addedCount = 0

    for (const prodId of selectedProductIds) {
      if (!includedProductIds.has(prodId)) {
        const prod = productById.get(prodId)
        newItems.push({
          productId: prodId,
          price: prod?.price || 0,
        })
        addedCount++
      }
    }

    onChange([...items, ...newItems])
    toast.success(`${addedCount} produto(s) adicionado(s) ao contrato!`)
    setBatchModalOpen(false)
  }

  // Edição inline de preço
  const handlePriceChange = (index: number, newPrice: number) => {
    const updated = items.map((it, idx) => {
      if (idx !== index) return it
      return {
        ...it,
        price: isNaN(newPrice) ? 0 : Math.max(0, newPrice),
      }
    })
    onChange(updated)
  }

  // Restaurar preço original do catálogo
  const handleResetToCatalogPrice = (index: number) => {
    const it = items[index]
    const prod = productById.get(it.productId)
    if (!prod) return
    handlePriceChange(index, prod.price)
    toast.info(`Preço redefinido para o valor do catálogo (R$ ${prod.price.toFixed(2)})`)
  }

  // Exclusão de item com confirmação
  const handleConfirmRemoveItem = () => {
    if (itemToDeleteIndex === null) return
    const removed = items[itemToDeleteIndex]
    const prod = productById.get(removed.productId)
    const updated = items.filter((_, idx) => idx !== itemToDeleteIndex)
    onChange(updated)
    toast.success(`"${prod?.name || 'Item'}" removido do contrato.`)
    setItemToDeleteIndex(null)
  }

  // Limpar todos os itens (ação rápida)
  const handleClearAll = () => {
    if (items.length === 0) return
    if (window.confirm('Deseja remover todos os produtos deste contrato?')) {
      onChange([])
      toast.info('Lista de produtos do contrato esvaziada.')
    }
  }

  // Processamento de Colar em Massa
  const handleProcessPaste = () => {
    const lines = pasteText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0)

    if (lines.length === 0) {
      toast.warning('Cole ao menos uma linha para analisar.')
      return
    }

    const matched: Array<{ product: Product; price: number; originalLine: string }> = []
    const unmatched: string[] = []

    for (const line of lines) {
      // Formatos suportados: "Nome do produto; Preço", "Nome \t Preço", "Nome, Preço" ou "Nome - Preço"
      let sep = ';'
      if (line.includes('\t')) sep = '\t'
      else if (line.includes(';')) sep = ';'
      else if (line.includes(' - ')) sep = ' - '
      else if (line.includes(',')) {
        // Cuidado com vírgula de decimais (ex: "Alface, 3,50")
        // Se houver mais de uma vírgula ou vírgula antes de dígitos
        const parts = line.split(',')
        if (parts.length === 2 && !isNaN(parseFloat(parts[1].trim()))) {
          sep = ','
        }
      }

      const rawParts = line.split(sep)
      let namePart = ''
      let pricePart = ''

      if (rawParts.length >= 2) {
        namePart = rawParts
          .slice(0, rawParts.length - 1)
          .join(sep)
          .trim()
        pricePart = rawParts[rawParts.length - 1].trim()
      } else {
        namePart = line.trim()
        pricePart = ''
      }

      // Normaliza o nome do produto
      const normInput = normalizeName(namePart)
      const found = catalogProducts.find((p) => {
        const normCat = normalizeName(p.name)
        return normCat === normInput || normCat.includes(normInput) || normInput.includes(normCat)
      })

      if (!found) {
        unmatched.push(line)
        continue
      }

      // Converte preço (trata R$, vírgulas e pontos)
      let price = found.price
      if (pricePart) {
        const cleanPrice = pricePart.replace(/[R$\s]/g, '').replace(',', '.')
        const parsed = parseFloat(cleanPrice)
        if (!isNaN(parsed) && parsed >= 0) {
          price = parsed
        }
      }

      matched.push({
        product: found,
        price,
        originalLine: line,
      })
    }

    setPastePreview({ matched, unmatched })
  }

  const handleApplyPastedItems = () => {
    if (!pastePreview || pastePreview.matched.length === 0) return

    // Mesclar: se já existe o produto, atualiza o preço; se não existe, adiciona
    const currentMap = new Map<string, ContractItemForm>()
    for (const it of items) {
      currentMap.set(it.productId, { ...it })
    }

    let addedCount = 0
    let updatedCount = 0

    for (const match of pastePreview.matched) {
      if (currentMap.has(match.product.id)) {
        const existing = currentMap.get(match.product.id)!
        existing.price = match.price
        updatedCount++
      } else {
        currentMap.set(match.product.id, {
          productId: match.product.id,
          price: match.price,
        })
        addedCount++
      }
    }

    onChange(Array.from(currentMap.values()))
    toast.success(
      `Importação concluída: ${addedCount} adicionado(s), ${updatedCount} preço(s) atualizado(s)!`,
    )
    setPasteModalOpen(false)
    setPasteText('')
    setPastePreview(null)
  }

  return (
    <div className="space-y-3 pt-1">
      {/* Barra de Ações Superior */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b">
        <div>
          <Label className="text-sm font-semibold flex items-center gap-1.5">
            <Package className="h-4 w-4 text-primary" />
            Produtos e Preços Acordados ({items.length})
          </Label>
          <p className="text-xs text-muted-foreground">
            Selecione em lote do catálogo, ajuste os preços direto na tabela ou cole de planilhas.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => {
              setPasteText('')
              setPastePreview(null)
              setPasteModalOpen(true)
            }}
          >
            <ClipboardPaste className="h-3.5 w-3.5 text-muted-foreground" />
            Colar em Massa
          </Button>

          <Button
            type="button"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={handleOpenBatchModal}
          >
            <Plus className="h-3.5 w-3.5" />
            Selecionar Produtos
          </Button>
        </div>
      </div>

      {/* Tabela de Edição Inline de Itens */}
      {items.length === 0 ? (
        <div className="py-10 text-center border rounded-lg bg-muted/10 space-y-3">
          <Package className="h-8 w-8 text-muted-foreground/50 mx-auto" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              Nenhum produto associado a este contrato
            </p>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Clique em <strong>"Selecionar Produtos"</strong> para marcar vários itens do catálogo
              de uma vez com preços pré-preenchidos.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={handleOpenBatchModal}
          >
            <Plus className="h-3.5 w-3.5" />
            Abrir Catálogo de Produtos
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="rounded-md border max-h-[320px] overflow-y-auto">
            <Table>
              <TableHeader className="bg-muted/30 sticky top-0 z-10 backdrop-blur-xs">
                <TableRow className="text-xs">
                  <TableHead className="w-[45%]">Produto / Categoria</TableHead>
                  <TableHead className="w-[12%] text-center">Unidade</TableHead>
                  <TableHead className="w-[28%]">Preço Acordado (R$)</TableHead>
                  <TableHead className="w-[15%] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, index) => {
                  const prod = productById.get(item.productId)
                  const catalogPrice = prod?.price ?? 0
                  const isDiff = Math.abs(item.price - catalogPrice) > 0.009 && catalogPrice > 0

                  return (
                    <TableRow key={item.productId || index} className="text-xs hover:bg-muted/10">
                      {/* Nome e categoria */}
                      <TableCell className="py-2.5">
                        <div className="flex flex-col">
                          <span className="font-semibold text-foreground">
                            {prod?.name || 'Produto não encontrado'}
                          </span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {prod?.category && (
                              <Badge
                                variant="outline"
                                className="text-[9px] py-0 px-1 font-normal text-muted-foreground"
                              >
                                {prod.category}
                              </Badge>
                            )}
                            {prod?.disponibilidade && prod.disponibilidade !== 'normal' && (
                              <Badge
                                className={`text-[9px] py-0 px-1 font-normal ${
                                  prod.disponibilidade === 'abundancia'
                                    ? 'bg-emerald-600'
                                    : 'bg-amber-600'
                                }`}
                              >
                                {prod.disponibilidade === 'abundancia' ? 'Safra alta' : 'Escassez'}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      {/* Unidade */}
                      <TableCell className="text-center font-mono py-2.5 text-muted-foreground">
                        {prod?.unit || 'Kg'}
                      </TableCell>

                      {/* Preço editável inline */}
                      <TableCell className="py-2.5">
                        <div className="space-y-1">
                          <div className="relative max-w-[170px]">
                            <span className="absolute left-2 top-2 text-[11px] text-muted-foreground pointer-events-none font-medium">
                              R$
                            </span>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.price || ''}
                              onChange={(e) =>
                                handlePriceChange(index, parseFloat(e.target.value) || 0)
                              }
                              className={`h-7 pl-7 pr-2 text-xs font-mono font-medium ${
                                isDiff
                                  ? 'border-amber-500/70 bg-amber-50/40 dark:bg-amber-950/20 focus-visible:ring-amber-500'
                                  : ''
                              }`}
                            />
                          </div>

                          {/* Destaque visual quando difere do catálogo */}
                          {isDiff && (
                            <div className="flex items-center gap-1 text-[10px] text-amber-700 dark:text-amber-400 font-medium">
                              <span>catálogo: R$ {catalogPrice.toFixed(2)}</span>
                              <button
                                type="button"
                                onClick={() => handleResetToCatalogPrice(index)}
                                title="Restaurar preço do catálogo"
                                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5 underline text-[9px] ml-1"
                              >
                                <RotateCcw className="h-2.5 w-2.5" />
                                restaurar
                              </button>
                            </div>
                          )}
                        </div>
                      </TableCell>

                      {/* Ações */}
                      <TableCell className="text-right py-2.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          title="Remover produto do contrato"
                          onClick={() => setItemToDeleteIndex(index)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground px-1 pt-1">
            <span>
              Total: <strong>{items.length}</strong> produto(s) configurado(s)
            </span>
            {items.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClearAll}
                className="h-6 text-[11px] text-destructive hover:bg-destructive/10 px-2"
              >
                Limpar todos os produtos
              </Button>
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: SELEÇÃO EM LOTE COM CHECKBOX E BUSCA */}
      <Dialog open={batchModalOpen} onOpenChange={setBatchModalOpen}>
        <DialogContent className="sm:max-w-[620px] max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Selecionar Produtos do Catálogo
            </DialogTitle>
            <DialogDescription>
              Marque os produtos que deseja incluir no contrato. Os preços virão pré-preenchidos com
              o valor unitário cadastrado em cada produto e poderão ser ajustados.
            </DialogDescription>
          </DialogHeader>

          {/* Campo de Busca no Catálogo */}
          <div className="space-y-2 pt-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, categoria ou unidade..."
                value={batchSearchQuery}
                onChange={(e) => setBatchSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <span>
                <strong>{selectedProductIds.size}</strong> novo(s) produto(s) selecionado(s)
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleSelectAllVisible}
                className="h-6 text-[11px] p-0 text-primary hover:underline"
              >
                Marcar / Desmarcar todos visíveis
              </Button>
            </div>
          </div>

          {/* Lista com Checkboxes */}
          <div className="flex-1 overflow-y-auto border rounded-md max-h-[350px] divide-y divide-border">
            {filteredCatalogForBatch.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                Nenhum produto encontrado no catálogo.
              </div>
            ) : (
              filteredCatalogForBatch.map((p) => {
                const isAlreadyInContract = includedProductIds.has(p.id)
                const isSelected = selectedProductIds.has(p.id)

                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      if (!isAlreadyInContract) {
                        handleToggleSelectProduct(p.id)
                      }
                    }}
                    className={`flex items-center justify-between p-2.5 text-xs transition-colors cursor-pointer select-none ${
                      isAlreadyInContract
                        ? 'bg-muted/40 opacity-60 cursor-not-allowed'
                        : isSelected
                          ? 'bg-primary/10 border-l-2 border-l-primary'
                          : 'hover:bg-muted/20'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <input
                        type="checkbox"
                        checked={isAlreadyInContract || isSelected}
                        disabled={isAlreadyInContract}
                        onChange={() => {
                          if (!isAlreadyInContract) {
                            handleToggleSelectProduct(p.id)
                          }
                        }}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary shrink-0"
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-foreground truncate">{p.name}</span>
                          {p.category && (
                            <Badge
                              variant="outline"
                              className="text-[9px] py-0 px-1 font-normal text-muted-foreground shrink-0"
                            >
                              {p.category}
                            </Badge>
                          )}
                          {isAlreadyInContract && (
                            <Badge
                              variant="secondary"
                              className="text-[9px] py-0 px-1 shrink-0 text-muted-foreground"
                            >
                              Já no contrato
                            </Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">
                          Unidade: {p.unit} • Estoque: {p.stock}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0 pl-2">
                      <span className="font-mono font-medium text-foreground block">
                        R$ {p.price.toFixed(2)}
                      </span>
                      <span className="text-[10px] text-muted-foreground">preço base</span>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          <DialogFooter className="pt-3 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setBatchModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirmBatchAdd}
              disabled={selectedProductIds.size === 0}
              className="gap-1.5"
            >
              <Check className="h-3.5 w-3.5" />
              Adicionar {selectedProductIds.size} selecionado(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: COLAR EM MASSA (EXCEL/PLANILHA) */}
      <Dialog open={pasteModalOpen} onOpenChange={setPasteModalOpen}>
        <DialogContent className="sm:max-w-[620px] max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardPaste className="h-5 w-5 text-primary" />
              Colar Produtos e Preços em Massa
            </DialogTitle>
            <DialogDescription>
              Cole linhas copiadas de uma planilha no formato "produto;preço" ou "produto [tab]
              preço". O sistema fará o matching inteligente por nome.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label htmlFor="paste-area" className="text-xs font-semibold">
                  Conteúdo copiado (uma linha por produto):
                </Label>
                <span className="text-[10px] text-muted-foreground">Ex: Banana Prata; 5,50</span>
              </div>
              <Textarea
                id="paste-area"
                rows={5}
                placeholder={`Banana Prata; 5,50\nMaçã Nacional; 8,20\nCenoura; 4,00\nTomate`}
                value={pasteText}
                onChange={(e) => {
                  setPasteText(e.target.value)
                  setPastePreview(null)
                }}
                className="text-xs font-mono"
              />
            </div>

            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleProcessPaste}
                disabled={!pasteText.trim()}
                className="h-8 text-xs gap-1.5"
              >
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Processar e Analisar
              </Button>
            </div>

            {/* Preview do Matching */}
            {pastePreview && (
              <div className="space-y-2 border rounded-lg p-3 bg-muted/20 text-xs">
                <div className="flex items-center justify-between font-semibold">
                  <span className="flex items-center gap-1.5 text-emerald-600">
                    <Check className="h-4 w-4" />
                    {pastePreview.matched.length} produto(s) identificado(s)
                  </span>
                  {pastePreview.unmatched.length > 0 && (
                    <span className="flex items-center gap-1.5 text-amber-600">
                      <AlertCircle className="h-4 w-4" />
                      {pastePreview.unmatched.length} não localizado(s)
                    </span>
                  )}
                </div>

                {/* Lista de itens identificados */}
                {pastePreview.matched.length > 0 && (
                  <div className="max-h-[140px] overflow-y-auto space-y-1 pr-1">
                    {pastePreview.matched.map((m, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-1.5 rounded bg-card border text-[11px]"
                      >
                        <span className="font-medium truncate">{m.product.name}</span>
                        <span className="font-mono text-primary font-semibold shrink-0">
                          R$ {m.price.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Linhas não encontradas (avisos tolerantes, não travam) */}
                {pastePreview.unmatched.length > 0 && (
                  <div className="pt-2 border-t border-border space-y-1">
                    <p className="text-[10px] text-muted-foreground font-semibold">
                      Não encontrados no catálogo (serão ignorados sem travar):
                    </p>
                    <div className="max-h-[80px] overflow-y-auto space-y-0.5">
                      {pastePreview.unmatched.map((line, i) => (
                        <p key={i} className="text-[10px] text-amber-600 truncate font-mono">
                          • {line}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="pt-3 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setPasteModalOpen(false)
                setPastePreview(null)
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleApplyPastedItems}
              disabled={!pastePreview || pastePreview.matched.length === 0}
              className="gap-1.5"
            >
              <Check className="h-3.5 w-3.5" />
              Aplicar {pastePreview?.matched.length || 0} produto(s) ao Contrato
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CONFIRMAÇÃO DE EXCLUSÃO INDIVIDUAL */}
      <AlertDialog
        open={itemToDeleteIndex !== null}
        onOpenChange={(open) => {
          if (!open) setItemToDeleteIndex(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover produto do contrato?</AlertDialogTitle>
            <AlertDialogDescription>
              {itemToDeleteIndex !== null && items[itemToDeleteIndex] && (
                <>
                  Deseja remover{' '}
                  <strong>
                    {productById.get(items[itemToDeleteIndex].productId)?.name || 'este produto'}
                  </strong>{' '}
                  da lista de itens acordados deste contrato?
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRemoveItem}
              className="bg-destructive hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
