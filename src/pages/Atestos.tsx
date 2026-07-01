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
import { FileCheck, Printer, Sprout } from 'lucide-react'
import { toast } from 'sonner'

export default function Atestos() {
  const { atestos, orders, generateAtesto } = useApp()

  const pendingOrders = orders.filter(
    (o) => o.status === 'Entregue' && !atestos.find((a) => a.orderId === o.id),
  )

  const handleGenerate = (orderId: string) => {
    generateAtesto(orderId)
    toast.success('Atesto gerado com sucesso!')
  }

  const handlePrint = () => {
    toast('Iniciando impressão...', { icon: <Printer className="h-4 w-4" /> })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Emissão de Atestos</h1>
          <p className="text-muted-foreground">
            Gerencie os certificados de recebimento para faturamento.
          </p>
        </div>
      </div>

      {pendingOrders.length > 0 && (
        <Card className="border-secondary/50 bg-secondary/5 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-secondary" /> Pedidos Prontos para Atesto
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {pendingOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between bg-card p-3 rounded-md border flex-1 min-w-[300px]"
                >
                  <div>
                    <p className="font-medium text-sm">{order.schoolName}</p>
                    <p className="text-xs text-muted-foreground">Pedido {order.id}</p>
                  </div>
                  <Button size="sm" onClick={() => handleGenerate(order.id)}>
                    Gerar Atesto
                  </Button>
                </div>
              ))}
            </div>
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
                {atestos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                      Nenhum atesto emitido.
                    </TableCell>
                  </TableRow>
                ) : (
                  atestos.map((atesto) => (
                    <TableRow key={atesto.id}>
                      <TableCell className="font-medium">{atesto.id}</TableCell>
                      <TableCell className="text-muted-foreground">{atesto.orderId}</TableCell>
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
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="sm">
                              Visualizar
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle className="sr-only">Atesto de Recebimento</DialogTitle>
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
                                  <p className="text-sm">Nº {atesto.id}</p>
                                </div>
                              </div>
                              <div className="space-y-2 text-sm">
                                <p>
                                  <strong>Instituição Recebedora:</strong> {atesto.schoolName}
                                </p>
                                <p>
                                  <strong>Data de Entrega:</strong>{' '}
                                  {new Date(atesto.date).toLocaleDateString('pt-BR')}
                                </p>
                                <p>
                                  <strong>Ref. Pedido:</strong> {atesto.orderId}
                                </p>
                              </div>
                              <div className="min-h-[150px] border border-black p-4 text-sm flex items-center justify-center text-gray-500">
                                [Lista de Produtos Detalhada Aqui]
                              </div>
                              <div className="pt-12 text-center space-y-8">
                                <p className="text-sm">
                                  Declaro ter recebido os produtos descritos acima em perfeitas
                                  condições.
                                </p>
                                <div className="mx-auto w-64 border-t border-black pt-2">
                                  <p className="text-xs font-bold uppercase">
                                    Assinatura do Responsável
                                  </p>
                                </div>
                              </div>
                            </div>
                            <div className="flex justify-end mt-4">
                              <Button onClick={handlePrint}>
                                <Printer className="mr-2 h-4 w-4" /> Imprimir PDF
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
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
