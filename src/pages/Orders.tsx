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
} from '@/components/ui/dialog'
import { Plus, ShoppingCart, Calendar as CalIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'

export default function Orders() {
  const { orders, schools, products, addOrder } = useApp()
  const [open, setOpen] = useState(false)

  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault()
    const schoolId = (e.target as any).school.value
    const school = schools.find((s) => s.id === schoolId)
    if (!school) return

    addOrder({
      id: `ORD-${Math.floor(Math.random() * 1000)}`,
      schoolId: school.id,
      schoolName: school.name,
      date: new Date().toISOString().split('T')[0],
      status: 'Pendente',
      total: 120.5, // mock total
      items: [{ productId: products[0].id, name: products[0].name, quantity: 10 }],
    })
    setOpen(false)
    toast.success('Pedido criado com sucesso!')
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
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Lançar Novo Pedido</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateOrder} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="school">Escola / Instituição</Label>
                <Select name="school" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a escola" />
                  </SelectTrigger>
                  <SelectContent>
                    {schools.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Data Prevista de Entrega</Label>
                <div className="relative">
                  <CalIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input type="date" name="date" className="pl-9" required />
                </div>
              </div>
              <div className="p-3 border border-dashed rounded-lg bg-muted/30 text-sm text-center text-muted-foreground">
                Seleção de produtos simplificada para demonstração.
              </div>
              <DialogFooter>
                <Button type="submit" className="w-full">
                  Salvar Pedido
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
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium text-primary">{order.id}</TableCell>
                    <TableCell>{order.schoolName}</TableCell>
                    <TableCell>{new Date(order.date).toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell>{getStatusBadge(order.status)}</TableCell>
                    <TableCell className="text-right">R$ {order.total.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
