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
import { Search, Plus, TrendingUp, Loader2, Sparkles, Check, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { produtosService } from '@/services/produtos'

export default function Products() {
  const { products, isLoading, adjustProductPrices, refreshData } = useApp()
  const { isAdmin } = useAuth()
  const [search, setSearch] = useState('')
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false)
  const [percentage, setPercentage] = useState('5')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Estados de edição de disponibilidade/essencial
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<any>(null)
  const [editEssencial, setEditEssencial] = useState(false)
  const [editDisponibilidade, setEditDisponibilidade] = useState<
    'normal' | 'escassez' | 'abundancia'
  >('normal')

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()),
  )

  const handleOpenEdit = (p: any) => {
    setEditingProduct(p)
    setEditEssencial(Boolean(p.essencial))
    setEditDisponibilidade(p.disponibilidade || 'normal')
    setEditDialogOpen(true)
  }

  const handleSaveProductConfig = async () => {
    if (!editingProduct) return
    setIsSubmitting(true)
    try {
      await produtosService.update(editingProduct.id, {
        essencial: editEssencial,
        disponibilidade: editDisponibilidade,
      })
      toast.success(`Configurações de "${editingProduct.name}" atualizadas!`)
      setEditDialogOpen(false)
      await refreshData()
    } catch (err) {
      console.error('Erro ao atualizar produto:', err)
      toast.error('Falha ao atualizar parâmetros do produto.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleBulkUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    const pct = parseFloat(percentage)
    if (isNaN(pct) || pct === 0) {
      toast.error('Informe uma porcentagem válida.')
      return
    }

    setIsSubmitting(true)
    const success = await adjustProductPrices(pct)
    setIsSubmitting(false)
    if (success) {
      toast.success(`Preços ajustados com sucesso em ${pct}% no banco de dados!`)
      setBulkDialogOpen(false)
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
            <Button variant="outline" onClick={() => setBulkDialogOpen(true)}>
              <TrendingUp className="mr-2 h-4 w-4" /> Ajuste em Massa
            </Button>
            <Button onClick={() => toast.info('Cadastro de novos produtos disponível no banco.')}>
              <Plus className="mr-2 h-4 w-4" /> Novo Produto
            </Button>
          </div>
        )}
      </div>

      {/* Dialog de Ajuste em Massa Real */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Ajuste de Preços em Massa</DialogTitle>
            <DialogDescription>
              Aplique um reajuste percentual a todos os produtos cadastrados no banco de dados.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleBulkUpdate} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="percentage">Percentual de Reajuste (%)</Label>
              <div className="relative">
                <Input
                  id="percentage"
                  type="number"
                  step="0.5"
                  value={percentage}
                  onChange={(e) => setPercentage(e.target.value)}
                  placeholder="Ex: 5 ou -5"
                  required
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Valores positivos aumentam o preço; valores negativos concedem desconto.
              </p>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setBulkDialogOpen(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Atualizando...
                  </>
                ) : (
                  'Aplicar Reajuste'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
                  <TableHead>Essencial</TableHead>
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
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Carregando produtos do banco...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
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
                        <TableCell>
                          {product.essencial ? (
                            <Badge className="bg-blue-600 text-[10px]">Obrigatório</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
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
                              Configurar
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

      {/* Modal de Configuração de Essencial e Disponibilidade */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Configurar Produto: {editingProduct?.name}</DialogTitle>
            <DialogDescription>
              Defina se o produto é essencial para validação dos pedidos e o status de safra
              semanal.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
              <div>
                <Label className="font-semibold text-sm">Item Essencial Obrigatório</Label>
                <p className="text-xs text-muted-foreground">
                  Pedidos sem este produto serão sinalizados como inválidos.
                </p>
              </div>
              <input
                type="checkbox"
                checked={editEssencial}
                onChange={(e) => setEditEssencial(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
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
              {isSubmitting ? 'Salvando...' : 'Salvar Parâmetros'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
