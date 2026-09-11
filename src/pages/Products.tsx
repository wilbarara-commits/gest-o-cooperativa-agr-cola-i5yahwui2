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
import { Search, Plus, TrendingUp, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useState } from 'react'
import { Label } from '@/components/ui/label'

export default function Products() {
  const { products, isLoading, adjustProductPrices } = useApp()
  const { isAdmin } = useAuth()
  const [search, setSearch] = useState('')
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false)
  const [percentage, setPercentage] = useState('5')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()),
  )

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
                  <TableHead className="text-right">Estoque</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead className="text-right">Preço Unit.</TableHead>
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
                  filteredProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-normal">
                          {product.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={product.stock < 100 ? 'text-destructive font-medium' : ''}>
                          {product.stock}
                        </span>
                      </TableCell>
                      <TableCell>{product.unit}</TableCell>
                      <TableCell className="text-right font-medium">
                        R${' '}
                        {product.price.toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
