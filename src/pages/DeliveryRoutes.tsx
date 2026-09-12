import { useState, useMemo } from 'react'
import { useApp } from '@/context/app-context'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  MapPin,
  Clock,
  CheckCircle,
  Truck,
  Layers,
  Calendar,
  AlertCircle,
  ArrowRight,
  Package,
} from 'lucide-react'

export default function DeliveryRoutes() {
  const { contracts, schools, orders, rotas, activeCiclo } = useApp()

  // Selecionar contrato para filtrar rotas
  const [selectedContratoId, setSelectedContratoId] = useState<string>(contracts[0]?.id || 'todos')

  // Rotas filtradas pelo contrato
  const filteredRotas = useMemo(() => {
    if (selectedContratoId === 'todos') {
      return rotas
    }
    return rotas.filter((r) => r.contrato_id === selectedContratoId)
  }, [rotas, selectedContratoId])

  // Agrupar escolas e pedidos pendentes por rota
  const rotasDetalhes = useMemo(() => {
    return filteredRotas.map((rota) => {
      // Contrato ao qual esta rota pertence
      const contrato = contracts.find((c) => c.id === rota.contrato_id)

      // Escolas associadas a esta rota (através de contrato_escolas)
      const escolasNaRota = contrato
        ? contrato.escolas.filter((e) => e.rotaId === rota.id || e.rotaNome === rota.nome)
        : []

      const escolaIds = new Set(escolasNaRota.map((e) => e.escolaId))

      // Pedidos pendentes de entrega nesta rota (Pendente ou Em Rota)
      const pedidosPendentes = orders.filter((o) => {
        if (o.status === 'Entregue' || o.status === 'Cancelado') return false
        // Se o pedido tiver rota_id direta igual à rota
        if (o.rotaId === rota.id) return true
        // Ou se pertencer a uma das escolas da rota
        if (escolaIds.has(o.schoolId)) return true
        return false
      })

      const volumePendente = pedidosPendentes.reduce((acc, p) => {
        return acc + p.items.reduce((sum, it) => sum + it.quantity, 0)
      }, 0)

      const valorPendente = pedidosPendentes.reduce((acc, p) => acc + p.total, 0)

      return {
        rota,
        contratoNumero: contrato?.numero || 'Sem contrato',
        modalidade: contrato?.modalidade_pedido || 'individualizado',
        escolas: escolasNaRota,
        pedidosPendentes,
        volumePendente,
        valorPendente,
      }
    })
  }, [filteredRotas, contracts, orders])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Rotas de Distribuição</h1>
          <p className="text-muted-foreground">
            Acompanhe o cronograma de paradas escolares e pedidos pendentes por rota contratual.
          </p>
        </div>

        {/* Filtro por Contrato */}
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary shrink-0" />
          <Select value={selectedContratoId} onValueChange={setSelectedContratoId}>
            <SelectTrigger className="w-[240px]">
              <SelectValue placeholder="Filtrar por Contrato" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Contratos</SelectItem>
              {contracts.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.numero} ({c.escolas.length} escolas)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {rotasDetalhes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Truck className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>Nenhuma rota cadastrada para o filtro selecionado.</p>
            <p className="text-xs mt-1">
              Cadastre e gerencie rotas diretamente dentro dos Contratos.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {rotasDetalhes.map((item) => (
            <Card key={item.rota.id} className="flex flex-col border-t-4 border-t-primary">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Truck className="h-5 w-5 text-primary" /> {item.rota.nome}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Contrato: <strong className="text-foreground">{item.contratoNumero}</strong> •
                      Modalidade: <span className="capitalize">{item.modalidade}</span>
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {item.escolas.length} paradas
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 flex-1">
                {/* Resumo de Carga Pendente */}
                <div className="grid grid-cols-2 gap-2 text-xs p-2.5 rounded-lg bg-muted/30 border">
                  <div>
                    <span className="text-muted-foreground">Pedidos Pendentes:</span>
                    <p className="font-bold text-sm text-foreground">
                      {item.pedidosPendentes.length} entrega(s)
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-muted-foreground">Volume / Valor:</span>
                    <p className="font-bold text-sm text-primary">
                      {item.volumePendente} itens (R$ {item.valorPendente.toFixed(2)})
                    </p>
                  </div>
                </div>

                {/* Lista de Escolas / Paradas */}
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Escolas Atendidas (Paradas da Rota)
                  </h4>
                  {item.escolas.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">
                      Nenhuma escola atribuída a esta rota ainda.
                    </p>
                  ) : (
                    <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                      {item.escolas.map((esc, i) => (
                        <div
                          key={esc.id}
                          className="flex items-center justify-between p-2 rounded border bg-card text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                              {i + 1}
                            </span>
                            <div>
                              <p className="font-medium text-foreground">{esc.escolaNome}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {esc.escolaEndereco || 'Endereço não cadastrado'}
                              </p>
                            </div>
                          </div>
                          {esc.escolaTelefone && (
                            <span className="text-[10px] font-mono text-muted-foreground">
                              {esc.escolaTelefone}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Pedidos em Aberto nesta Rota */}
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span>Entregas em Rota / Pendentes</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {item.pedidosPendentes.length}
                    </Badge>
                  </h4>
                  {item.pedidosPendentes.length === 0 ? (
                    <div className="p-3 rounded border border-dashed text-center text-xs text-muted-foreground">
                      Nenhum pedido pendente de entrega nesta rota.
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                      {item.pedidosPendentes.map((ped) => (
                        <div
                          key={ped.id}
                          className="flex items-center justify-between p-2 rounded border bg-muted/10 text-xs"
                        >
                          <div>
                            <span className="font-semibold text-primary">{ped.numero}</span>
                            <span className="text-muted-foreground mx-1.5">•</span>
                            <span>{ped.schoolName}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              className={`text-[10px] ${
                                ped.status === 'Em Rota' ? 'bg-amber-600' : 'bg-blue-600'
                              }`}
                            >
                              {ped.status}
                            </Badge>
                            <span className="font-mono font-medium">R$ {ped.total.toFixed(2)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
