import { useApp } from '@/context/app-context'
import { useAuth } from '@/context/auth-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Search, Plus, Loader2, FileSpreadsheet } from 'lucide-react'
import { toast } from 'sonner'
import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { produtosService } from '@/services/produtos'
import { CANONICAL_PRODUCT_UNITS } from '@/lib/productCsvImporter'
import { ProductImportDialog } from '@/components/ProductImportDialog'

export default function Products() {
  const { products, isLoading, refreshData } = useApp()
  const { isAdmin } = useAuth()
  const [search, setSearch] = useState('')
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Estados de edição de produto (unidade, disponibilidade, estoque e preço)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<any>(null)
  const [editPreco, setEditPreco] = useState('')
  const [editEstoque, setEditEstoque] = useState('')
  const [editUnidade, setEditUnidade] = useState('KG')
  const [editDisponibilidade, setEditDisponibilidade] = useState<
    'normal' | 'escassez' | 'abundancia'
  >('normal')

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()),
  )

  const handleOpenEdit = (p: any) => {
    setEditingProduct(p)
    setEditPreco(String(p.price ?? 0))
    setEditEstoque(String(p.stock ?? 0))
    setEditUnidade(p.unit || 'KG')
    setEditDisponibilidade(p.disponibilidade || 'normal')
    setEditDialogOpen(true)
  }

  const handleSaveProductConfig = async () => {
    if (!editingProduct) return
    const parsedPrice = parseFloat(editPreco.replace(',', '.'))
    const parsedStock = parseInt(editEstoque, 10)

    if (isNaN(parsedPrice) || parsedPrice < 0) {
      toast.error('Informe um preço unitário válido.')
      return
    }
    if (isNaN(parsedStock) || parsedStock < 0) {
      toast.error('Informe uma quantidade de estoque válida.')
      return
    }

    setIsSubmitting(true)
    try {
      await produtosService.update(editingProduct.id, {
        preco_unitario: parsedPrice,
        estoque: parsedStock,
        unidade: editUnidade || 'KG',
        disponibilidade: editDisponibilidade,
      })
      toast.success(`Produto "${editingProduct.name}" atualizado com sucesso!`)
      setEditDialogOpen(false)
      await refreshData()
    } catch (err) {
      console.error('Erro ao atualizar produto:', err)
      toast.error('Falha ao atualizar parâmetros do produto.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Produtos & Preços</h1>
          <p className="text-muted-foreground">
            Gerencie o inventário e tabela de preços da cooperativa.
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setImportDialogOpen(true)} className="gap-1.5">
              <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Importar CSV
            </Button>
            <Button onClick={() => toast.info('Cadastro de novos produtos disponível no banco.')}>
              <Plus className="mr-2 h-4 w-4" /> Novo Produto
            </Button>
          </div>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>Catálogo de Produtos</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar produto..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Disponibilidade</TableHead>
                  <TableHead className="text-right">Estoque</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead className="text-right">Preço Unit.</TableHead>
                  {isAdmin && <TableHead className="text-right">Ação</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Carregando produtos do banco...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhum produto encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts.map((product) => {
                    const dispBadge =
                      product.disponibilidade === 'abundancia' ? (
                        <Badge className="bg-emerald-600 hover:bg-emerald-700 text-xs">
                          Abundância
                        </Badge>
                      ) : product.disponibilidade === 'escassez' ? (
                        <Badge className="bg-amber-600 hover:bg-amber-700 text-xs">Escassez</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          Normal
                        </Badge>
                      )

                    return (
                      <TableRow key={product.id}>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="font-normal">
                            {product.category}
                          </Badge>
                        </TableCell>
                        <TableCell>{dispBadge}</TableCell>
                        <TableCell className="text-right">
                          <span
                            className={product.stock < 100 ? 'text-destructive font-medium' : ''}
                          >
                            {product.stock}
                          </span>
                        </TableCell>
                        <TableCell>{product.unit}</TableCell>
                        <TableCell className="text-right font-medium font-mono">
                          R${' '}
                          {product.price.toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </TableCell>
                        {isAdmin && (
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs h-7"
                              onClick={() => handleOpenEdit(product)}
                            >
                              Editar
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Modal de Edição Individual do Produto */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Produto: {editingProduct?.name}</DialogTitle>
            <DialogDescription>
              Ajuste individualmente a unidade de medida, preço, estoque e a disponibilidade de
              safra deste produto.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="edit-unidade" className="text-sm font-semibold">
                  Unidade de Medida
                </Label>
                <select
                  id="edit-unidade"
                  value={editUnidade}
                  onChange={(e) => setEditUnidade(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  {CANONICAL_PRODUCT_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                  {/* Se o produto possuir uma unidade legada fora da lista canônica, mantém como opção selecionável */}
                  {!CANONICAL_PRODUCT_UNITS.includes(editUnidade as any) && editUnidade && (
                    <option value={editUnidade}>{editUnidade}</option>
                  )}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-preco" className="text-sm font-semibold">
                  Preço Unitário (R$)
                </Label>
                <Input
                  id="edit-preco"
                  type="number"
                  step="0.01"
                  min="0"
                  value={editPreco}
                  onChange={(e) => setEditPreco(e.target.value)}
                  placeholder="Ex: 5.50"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-estoque" className="text-sm font-semibold">
                Estoque ({editUnidade || 'KG'})
              </Label>
              <Input
                id="edit-estoque"
                type="number"
                step="1"
                min="0"
                value={editEstoque}
                onChange={(e) => setEditEstoque(e.target.value)}
                placeholder="Ex: 100"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Disponibilidade na Safra do Ciclo</Label>
              <select
                value={editDisponibilidade}
                onChange={(e) =>
                  setEditDisponibilidade(e.target.value as 'normal' | 'escassez' | 'abundancia')
                }
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="normal">Normal (Estoque Regular)</option>
                <option value="abundancia">Abundância (Safra Alta / Incentivo)</option>
                <option value="escassez">Escassez (Restrição / Compensar em Correção)</option>
              </select>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button onClick={handleSaveProductConfig} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...
                </>
              ) : (
                'Salvar Alterações'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Importação CSV / Planilha de Produtos */}
      <ProductImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        products={products}
        onSuccess={async () => {
          await refreshData()
        }}
      />
    </div>
  )
}
