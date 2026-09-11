import { useApp } from '@/context/app-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Map, Navigation2, CheckCircle2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useState } from 'react'

export default function DeliveryRoutes() {
  const { orders, schools, updateOrderStatus, isLoading } = useApp()
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  // Group pending/in-route orders by route
  const activeOrders = orders.filter((o) => o.status === 'Pendente' || o.status === 'Em Rota')

  const groupedByRoute = activeOrders.reduce(
    (acc, order) => {
      const school = schools.find((s) => s.id === order.schoolId)
      const routeName = school?.route || 'Sem Rota'
      if (!acc[routeName]) acc[routeName] = []
      acc[routeName].push({
        ...order,
        address: school?.address || 'Endereço não informado',
      })
      return acc
    },
    {} as Record<string, any[]>,
  )

  const handleMarkDelivered = async (orderId: string) => {
    setUpdatingId(orderId)
    const success = await updateOrderStatus(orderId, 'Entregue')
    setUpdatingId(null)
    if (success) {
      toast.success('Entrega confirmada no banco de dados! Pronto para gerar atesto.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Planejamento de Rotas</h1>
          <p className="text-muted-foreground">
            Organize as entregas por região e confirme o recebimento diretamente no banco.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" /> Carregando rotas de entrega...
        </div>
      ) : Object.keys(groupedByRoute).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-muted-foreground">
            <Map className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p>Não há entregas pendentes para planejamento no momento.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {Object.entries(groupedByRoute).map(([route, deliveries]) => (
            <Card key={route} className="overflow-hidden border-t-4 border-t-primary">
              <CardHeader className="bg-muted/30 pb-4">
                <CardTitle className="flex justify-between items-center text-lg">
                  <span className="flex items-center gap-2">
                    <Navigation2 className="h-5 w-5 text-primary" />
                    {route}
                  </span>
                  <Badge variant="outline">{deliveries.length} paradas</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {deliveries.map((delivery, idx) => (
                    <div
                      key={delivery.id}
                      className="p-4 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center"
                    >
                      <div className="flex gap-3">
                        <div className="flex items-center justify-center h-6 w-6 rounded-full bg-secondary/20 text-secondary-foreground text-xs font-bold shrink-0 mt-0.5">
                          {idx + 1}
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{delivery.schoolName}</p>
                          <p className="text-xs text-muted-foreground">{delivery.address}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Pedido: {delivery.numero || delivery.id} • Data:{' '}
                            {new Date(delivery.date).toLocaleDateString('pt-BR')}
                          </p>
                          {delivery.items && delivery.items.length > 0 && (
                            <p className="text-xs text-primary/80 mt-0.5">
                              {delivery.items
                                .map((i: any) => `${i.quantity}x ${i.name}`)
                                .join(', ')}
                            </p>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant={delivery.status === 'Em Rota' ? 'default' : 'outline'}
                        onClick={() => handleMarkDelivered(delivery.id)}
                        disabled={updatingId === delivery.id}
                        className="w-full sm:w-auto"
                      >
                        {updatingId === delivery.id ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Atualizando...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="mr-2 h-4 w-4" /> Entregue
                          </>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
