import { useApp } from '@/context/app-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ShoppingCart,
  FileText,
  Truck,
  DollarSign,
  ArrowRight,
  CheckCircle2,
  Clock,
  School,
  Sprout,
} from 'lucide-react'
import { Link } from 'react-router-dom'

export default function Index() {
  const { orders, contracts } = useApp()

  const pendingOrders = orders.filter((o) => o.status === 'Pendente').length
  const deliveriesToday = orders.filter((o) => o.status === 'Em Rota').length
  const totalRevenue = contracts.reduce((acc, c) => acc + c.totalValue, 0)

  const metrics = [
    {
      title: 'Pedidos Pendentes',
      value: pendingOrders,
      icon: ShoppingCart,
      color: 'text-secondary',
      bg: 'bg-secondary/10',
    },
    {
      title: 'Contratos Ativos',
      value: contracts.length,
      icon: FileText,
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      title: 'Entregas Hoje',
      value: deliveriesToday,
      icon: Truck,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
    },
    {
      title: 'Receita Total (Mês)',
      value: `R$ ${(totalRevenue / 12).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      icon: DollarSign,
      color: 'text-green-600',
      bg: 'bg-green-600/10',
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Resumo das atividades da cooperativa.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/atestos">Emitir Atesto</Link>
          </Button>
          <Button asChild>
            <Link to="/pedidos">Novo Pedido</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => (
          <Card key={m.title} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{m.title}</CardTitle>
              <div className={`p-2 rounded-full ${m.bg}`}>
                <m.icon className={`h-4 w-4 ${m.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{m.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Entregas Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {orders.slice(0, 4).map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/10 p-2 rounded-full">
                      <School className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{order.schoolName}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(order.date).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={
                      order.status === 'Entregue'
                        ? 'default'
                        : order.status === 'Pendente'
                          ? 'secondary'
                          : 'outline'
                    }
                    className={order.status === 'Entregue' ? 'bg-primary' : ''}
                  >
                    {order.status}
                  </Badge>
                </div>
              ))}
            </div>
            <Button variant="ghost" className="w-full mt-4 text-primary" asChild>
              <Link to="/pedidos">
                Ver todos os pedidos <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Feed de Atividade</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {[
                {
                  title: 'Atesto Gerado',
                  desc: 'E.E. Maria Antonieta',
                  time: 'Há 2 horas',
                  icon: CheckCircle2,
                  color: 'text-primary',
                },
                {
                  title: 'Novo Pedido',
                  desc: 'E.M. João da Silva adicionou um pedido',
                  time: 'Há 4 horas',
                  icon: Clock,
                  color: 'text-secondary',
                },
                {
                  title: 'Estoque Atualizado',
                  desc: 'Tomate Carmem',
                  time: 'Ontem',
                  icon: Sprout,
                  color: 'text-blue-500',
                },
              ].map((act, i) => (
                <div key={i} className="flex gap-4">
                  <div className={`mt-0.5 rounded-full p-1 border ${act.color} bg-background`}>
                    <act.icon className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col">
                    <p className="text-sm font-medium leading-none">{act.title}</p>
                    <p className="text-sm text-muted-foreground mt-1">{act.desc}</p>
                    <p className="text-xs text-muted-foreground mt-1">{act.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
