import { useApp } from '@/context/app-context'
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Plus, ShoppingCart, Calendar as CalIcon, Loader2, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'

interface OrderFormItem {
  productId: string
  quantity: number
}

export default function Orders() {
  const { orders, schools, products, addOrder, isLoading } = useApp()
  const [open, setOpen] = useState(false)
  const [selectedSchool, setSelectedSchool] = useState('')
  const [orderDate, setOrderDate] = useState(() => new Date().toISOString().split('T')[0])
  const [orderItems, setOrderItems] = useState<OrderFormItem[]>([{ productId: '', quantity: 10 }])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleAddItem = () => {
    setOrderItems((prev) => [...prev, { productId: '', quantity: 1 }])
  }

  const handleRemoveItem = (index: number) => {
    if (orderItems.length === 1) {
      toast.error('O pedido deve conter pelo menos um produto.')
      return
    }
    setOrderItems((prev) => prev.filter((_, i) => i !== index))
  }

  const handleItemChange = (index: number, field: 'productId' | 'quantity', value: any) => {
    setOrderItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item
        return { ...item, [field]: value }
      }),
    )
  }

  // Calculate dynamic order total
  const calculatedTotal = orderItems.reduce((acc, it) => {
    const prod = products.find((p) => p.id === it.productId)
    if (!prod) return acc
    return acc + prod.price * (Number(it.quantity) || 0)
  }, 0)

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedSchool) {
      toast.error('Por favor, selecione a escola.')
      return
    }

    const validItems = orderItems.filter((it) => it.productId && Number(it.quantity) > 0)

    if (validItems.length === 0) {
      toast.error('Adicione ao menos um produto válido com quantidade.')
      return
    }

    setIsSubmitting(true)
    const success = await addOrder({
      schoolId: selectedSchool,
      date: orderDate,
      items: validItems.map((it) => ({
        productId: it.productId,
        quantity: Number(it.quantity),
      })),
    })
    setIsSubmitting(false)

    if (success) {
      toast.success('Pedido gravado com sucesso no banco de dados!')
      setOpen(false)
      setSelectedSchool('')
      setOrderItems([{ productId: '', quantity: 10 }])
      setOrderDate(new Date().toISOString().split('T')[0])
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Entregue':
        return <Badge className="bg-primary hover:bg-primary/90">Entregue</Badge>
      case 'Pendente':
        return (
          <Badge variant="secondary" className="bg-secondary text-secondary-foreground">
            Pendente
          </Badge>
        )
      case 'Em Rota':
        return (
          <Badge variant="outline" className="text-blue-600 border-blue-600">
            Em Rota
          </Badge>
        )
      default:
        return <Badge variant="destructive">Cancelado</Badge>
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pedidos</h1>
          <p className="text-muted-foreground">Lançamento de pedidos e acompanhamento de status.</p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Nova Encomenda
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Lançar Novo Pedido</DialogTitle>
              <DialogDescription>
                Selecione a instituição, data prevista e os produtos agrícolas do catálogo.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateOrder} className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="school">Escola / Instituição</Label>
                <Select value={selectedSchool} onValueChange={setSelectedSchool} required>
                  <SelectTrigger id="school">
                    <SelectValue placeholder="Selecione a escola" />
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
                <Label htmlFor="date">Data Prevista de Entrega</Label>
                <div className="relative">
                  <CalIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    type="date"
                    id="date"
                    className="pl-9"
                    value={orderDate}
                    onChange={(e) => setOrderDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <Label className="font-semibold">Itens do Pedido</Label>
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

                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {orderItems.map((item, idx) => {
                    const selectedProd = products.find((p) => p.id === item.productId)
                    const itemSubtotal = selectedProd
                      ? selectedProd.price * (Number(item.quantity) || 0)
                      : 0

                    return (
                      <div
                        key={idx}
                        className="flex items-center gap-2 p-2 rounded-lg border bg-muted/20"
                      >
                        <div className="flex-1">
                          <Select
                            value={item.productId}
                            onValueChange={(val) => handleItemChange(idx, 'productId', val)}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Selecione o produto" />
                            </SelectTrigger>
                            <SelectContent>
                              {products.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.name} (R$ {p.price.toFixed(2)} / {p.unit})
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
                            className="h-9"
                            placeholder="Qtd"
                            value={item.quantity}
                            onChange={(e) =>
                              handleItemChange(idx, 'quantity', parseInt(e.target.value) || 1)
                            }
                          />
                        </div>
                        <div className="w-20 text-right text-xs font-medium text-muted-foreground">
                          R$ {itemSubtotal.toFixed(2)}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleRemoveItem(idx)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )
                  })}
                </div>

                <div className="flex justify-between items-center p-3 bg-primary/5 rounded-lg border border-primary/20">
                  <span className="font-semibold text-sm">Valor Total Previsto:</span>
                  <span className="text-lg font-bold text-primary">
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            Lista de Pedidos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº Pedido</TableHead>
                  <TableHead>Instituição</TableHead>
                  <TableHead>Data Prevista</TableHead>
                  <TableHead>Itens</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Carregando pedidos do banco...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhum pedido registrado no banco.
                    </TableCell>
                  </TableRow>
                ) : (
                  orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium text-primary">
                        {order.numero || order.id}
                      </TableCell>
                      <TableCell>{order.schoolName}</TableCell>
                      <TableCell>{new Date(order.date).toLocaleDateString('pt-BR')}</TableCell>
                      <TableCell>
                        <span
                          className="text-xs text-muted-foreground"
                          title={order.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                        >
                          {order.items.length > 0 ? `${order.items.length} item(ns)` : 'Sem itens'}
                        </span>
                      </TableCell>
                      <TableCell>{getStatusBadge(order.status)}</TableCell>
                      <TableCell className="text-right font-medium">
                        R${' '}
                        {order.total.toLocaleString('pt-BR', {
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
