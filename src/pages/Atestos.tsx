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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { FileCheck, Printer, Sprout, Loader2, Check } from 'lucide-react'
import { toast } from 'sonner'
import { useState } from 'react'

export default function Atestos() {
  const { atestos, orders, generateAtesto, confirmAtesto, isLoading } = useApp()
  const [generatingId, setGeneratingId] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  // Pedidos entregues sem atesto emitido
  const pendingOrders = orders.filter(
    (o) => o.status === 'Entregue' && !atestos.find((a) => a.orderId === o.id),
  )

  const handleGenerate = async (orderId: string) => {
    setGeneratingId(orderId)
    const success = await generateAtesto(orderId)
    setGeneratingId(null)
    if (success) {
      toast.success('Atesto emitido e registrado no banco com sucesso!')
    }
  }

  const handleConfirm = async (atestoId: string) => {
    setConfirmingId(atestoId)
    const success = await confirmAtesto(atestoId)
    setConfirmingId(null)
    if (success) {
      toast.success('Atesto confirmado com sucesso!')
    }
  }

  const handlePrint = () => {
    toast('Iniciando impressão...', { icon: <Printer className="h-4 w-4" /> })
    window.print()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Emissão de Atestos</h1>
          <p className="text-muted-foreground">
            Gerencie os certificados de recebimento para comprovação e faturamento.
          </p>
        </div>
      </div>

      {pendingOrders.length > 0 ? (
        <Card className="border-emerald-500/30 bg-emerald-50/20 dark:bg-emerald-950/10 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-emerald-800 dark:text-emerald-400">
              <FileCheck className="h-5 w-5 text-emerald-600" /> Pedidos Entregues Aguardando
              Emissão de Atesto
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Regra de negócio: Apenas pedidos com status <strong>"Entregue"</strong> e sem atesto
              emitido são listados aqui.
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {pendingOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between bg-card p-3 rounded-md border flex-1 min-w-[300px] shadow-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{order.schoolName}</p>
                      <Badge className="bg-emerald-600 text-[10px] h-4">Entregue</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Pedido{' '}
                      <span className="font-bold text-foreground">{order.numero || order.id}</span>
                      {order.entregue_em &&
                        ` • Entregue em ${new Date(order.entregue_em).toLocaleDateString('pt-BR')}`}{' '}
                      • R$ {order.total.toFixed(2)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                    onClick={() => handleGenerate(order.id)}
                    disabled={generatingId === order.id}
                  >
                    {generatingId === order.id ? (
                      <>
                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Gerando...
                      </>
                    ) : (
                      'Gerar Atesto'
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed bg-muted/20">
          <CardContent className="py-6 text-center text-xs text-muted-foreground">
            Nenhum pedido entregue aguardando emissão de atesto no momento. Para emitir um atesto,
            confirme primeiro a entrega do pedido na tela de <strong>Pedidos</strong> ou{' '}
            <strong>Rotas de Entrega</strong>.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Histórico de Atestos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº Atesto</TableHead>
                  <TableHead>Ref. Pedido</TableHead>
                  <TableHead>Instituição</TableHead>
                  <TableHead>Data Emissão</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Carregando atestos do banco...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : atestos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                      Nenhum atesto emitido no banco.
                    </TableCell>
                  </TableRow>
                ) : (
                  atestos.map((atesto) => {
                    const relatedOrder = orders.find((o) => o.id === atesto.orderId)
                    return (
                      <TableRow key={atesto.id}>
                        <TableCell className="font-medium">{atesto.numero || atesto.id}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {atesto.orderNumber || atesto.orderId}
                        </TableCell>
                        <TableCell>{atesto.schoolName}</TableCell>
                        <TableCell>{new Date(atesto.date).toLocaleDateString('pt-BR')}</TableCell>
                        <TableCell>
                          <Badge
                            variant={atesto.status === 'Confirmado' ? 'default' : 'outline'}
                            className={
                              atesto.status === 'Confirmado'
                                ? 'bg-primary'
                                : 'text-secondary-foreground border-secondary bg-secondary/10'
                            }
                          >
                            {atesto.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {atesto.status === 'Pendente Assinatura' && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs border-primary/30 text-primary hover:bg-primary/10"
                                onClick={() => handleConfirm(atesto.id)}
                                disabled={confirmingId === atesto.id}
                              >
                                {confirmingId === atesto.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                ) : (
                                  <Check className="h-3 w-3 mr-1" />
                                )}
                                Confirmar Recebimento
                              </Button>
                            )}
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 text-xs">
                                  Visualizar
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
                                <DialogHeader>
                                  <DialogTitle className="sr-only">
                                    Atesto de Recebimento
                                  </DialogTitle>
                                </DialogHeader>
                                <div className="p-8 bg-white text-black border shadow-sm mx-auto w-full space-y-6">
                                  <div className="flex items-center justify-between border-b-2 border-black pb-4">
                                    <div className="flex items-center gap-3">
                                      <Sprout className="h-8 w-8 text-black" />
                                      <div>
                                        <h2 className="font-bold text-lg uppercase tracking-wider">
                                          CoopGestão
                                        </h2>
                                        <p className="text-xs">Cooperativa Agrícola Familiar</p>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <p className="font-bold text-xl uppercase">Atesto</p>
                                      <p className="text-sm">Nº {atesto.numero || atesto.id}</p>
                                    </div>
                                  </div>

                                  <div className="space-y-2 text-sm">
                                    <p>
                                      <strong>Instituição Recebedora:</strong> {atesto.schoolName}
                                    </p>
                                    <p>
                                      <strong>Data de Emissão:</strong>{' '}
                                      {new Date(atesto.date).toLocaleDateString('pt-BR')}
                                    </p>
                                    <p>
                                      <strong>Ref. Pedido:</strong>{' '}
                                      {atesto.orderNumber || atesto.orderId}
                                    </p>
                                  </div>

                                  <div className="border border-black p-4 text-sm space-y-2">
                                    <p className="font-bold border-b border-black/20 pb-1">
                                      Produtos Entregues e Conferidos:
                                    </p>
                                    {relatedOrder && relatedOrder.items.length > 0 ? (
                                      <ul className="space-y-1">
                                        {relatedOrder.items.map((it, idx) => (
                                          <li key={idx} className="flex justify-between">
                                            <span>
                                              • {it.quantity}x {it.name}
                                            </span>
                                            <span>R$ {(it.quantity * it.price).toFixed(2)}</span>
                                          </li>
                                        ))}
                                        <li className="pt-2 border-t font-semibold flex justify-between">
                                          <span>Total do Pedido:</span>
                                          <span>R$ {relatedOrder.total.toFixed(2)}</span>
                                        </li>
                                      </ul>
                                    ) : (
                                      <p className="text-gray-600 italic">
                                        Itens conferidos conforme nota de entrega e contrato
                                        institucional.
                                      </p>
                                    )}
                                  </div>

                                  <div className="pt-8 text-center space-y-8">
                                    <p className="text-sm">
                                      Declaro ter recebido os gêneros alimentícios descritos acima
                                      em perfeitas condições de conservação e higiene para o consumo
                                      escolar.
                                    </p>
                                    <div className="mx-auto w-64 border-t border-black pt-2">
                                      <p className="text-xs font-bold uppercase">
                                        Assinatura do Responsável
                                      </p>
                                      <p className="text-[10px] text-gray-600">
                                        Direção / Nutricionista / CAE
                                      </p>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between mt-4">
                                  <div>
                                    {atesto.status === 'Pendente Assinatura' && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleConfirm(atesto.id)}
                                        disabled={confirmingId === atesto.id}
                                      >
                                        {confirmingId === atesto.id ? (
                                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                                        ) : (
                                          <Check className="h-3.5 w-3.5 mr-1.5" />
                                        )}
                                        Confirmar Recebimento
                                      </Button>
                                    )}
                                  </div>
                                  <Button onClick={handlePrint}>
                                    <Printer className="mr-2 h-4 w-4" /> Imprimir Atesto
                                  </Button>
                                </div>
                              </DialogContent>
                            </Dialog>
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
    </div>
  )
}
