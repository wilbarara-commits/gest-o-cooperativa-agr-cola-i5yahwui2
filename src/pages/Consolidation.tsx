import { useState, useMemo } from 'react'
import { useApp } from '@/context/app-context'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Grid,
  FileSpreadsheet,
  Download,
  Filter,
  Package,
  School,
  Calendar,
  Layers,
  Search,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { toast } from 'sonner'

export default function Consolidation() {
  const { products, schools, orders, ciclos, activeCiclo } = useApp()

  const [selectedCicloId, setSelectedCicloId] = useState<string>(activeCiclo?.id || 'todos')
  const [ocultarVazios, setOcultarVazios] = useState(true)
  const [filtroTexto, setFiltroTexto] = useState('')
  const [tabAtiva, setTabAtiva] = useState<'produto' | 'escola'>('produto')

  // Filtrar pedidos pelo ciclo selecionado (se não for "todos") e não cancelados
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (o.status === 'Cancelado') return false
      if (selectedCicloId !== 'todos' && o.cicloId && o.cicloId !== selectedCicloId) return false
      return true
    })
  }, [orders, selectedCicloId])

  // Matriz de dados: Map<produtoId, Map<schoolId, quantity>>
  const matriz = useMemo(() => {
    const data = new Map<string, Map<string, number>>()

    for (const order of filteredOrders) {
      for (const item of order.items) {
        if (!data.has(item.productId)) {
          data.set(item.productId, new Map<string, number>())
        }
        const schoolMap = data.get(item.productId)!
        const currentQtd = schoolMap.get(order.schoolId) || 0
        schoolMap.set(order.schoolId, currentQtd + (Number(item.quantity) || 0))
      }
    }

    return data
  }, [filteredOrders])

  // Escolas ativas que possuem pedido no período ou todas se não ocultar vazios
  const escolasExibidas = useMemo(() => {
    return schools.filter((s) => {
      if (filtroTexto.trim()) {
        const match = s.name.toLowerCase().includes(filtroTexto.toLowerCase())
        if (!match) return false
      }
      if (!ocultarVazios) return true
      // Tem ao menos uma quantidade na matriz
      for (const [, schoolMap] of matriz.entries()) {
        if ((schoolMap.get(s.id) || 0) > 0) return true
      }
      return false
    })
  }, [schools, matriz, ocultarVazios, filtroTexto])

  // Produtos exibidos
  const produtosExibidos = useMemo(() => {
    return products.filter((p) => {
      if (filtroTexto.trim()) {
        const match = p.name.toLowerCase().includes(filtroTexto.toLowerCase())
        if (!match) return false
      }
      if (!ocultarVazios) return true
      const schoolMap = matriz.get(p.id)
      if (!schoolMap) return false
      let soma = 0
      for (const qtd of schoolMap.values()) {
        soma += qtd
      }
      return soma > 0
    })
  }, [products, matriz, ocultarVazios, filtroTexto])

  // Totais por produto
  const totaisPorProduto = useMemo(() => {
    const res: Record<string, { totalQtd: number; totalValor: number }> = {}
    for (const prod of products) {
      const schoolMap = matriz.get(prod.id)
      let totalQtd = 0
      if (schoolMap) {
        for (const qtd of schoolMap.values()) {
          totalQtd += qtd
        }
      }
      res[prod.id] = {
        totalQtd,
        totalValor: totalQtd * prod.price,
      }
    }
    return res
  }, [products, matriz])

  // Totais por escola
  const totaisPorEscola = useMemo(() => {
    const res: Record<string, { totalItens: number; totalValor: number }> = {}
    for (const sch of schools) {
      let totalItens = 0
      let totalValor = 0
      for (const prod of products) {
        const qtd = matriz.get(prod.id)?.get(sch.id) || 0
        totalItens += qtd
        totalValor += qtd * prod.price
      }
      res[sch.id] = { totalItens, totalValor }
    }
    return res
  }, [schools, products, matriz])

  // Total Geral da Consolidação
  const totalGeral = useMemo(() => {
    let qtd = 0
    let valor = 0
    for (const prod of produtosExibidos) {
      const tot = totaisPorProduto[prod.id] || { totalQtd: 0, totalValor: 0 }
      qtd += tot.totalQtd
      valor += tot.totalValor
    }
    return { qtd, valor }
  }, [produtosExibidos, totaisPorProduto])

  // Exportar Excel usando SheetJS
  const handleExportarExcel = () => {
    try {
      const wb = XLSX.utils.book_new()

      // 1. Aba Por Produto (Matriz)
      const headers = [
        'Produto',
        'Unidade',
        'Categoria',
        ...escolasExibidas.map((e) => e.name),
        'Total Qtd',
        'Total R$',
      ]
      const rowsProduto: any[] = []

      for (const prod of produtosExibidos) {
        const row: any[] = [prod.name, prod.unit, prod.category]
        for (const sch of escolasExibidas) {
          const qtd = matriz.get(prod.id)?.get(sch.id) || 0
          row.push(qtd)
        }
        const tot = totaisPorProduto[prod.id] || { totalQtd: 0, totalValor: 0 }
        row.push(tot.totalQtd)
        row.push(tot.totalValor)
        rowsProduto.push(row)
      }

      // Totalizador no rodapé
      const footerRow: any[] = ['TOTAL GERAL', '', '']
      for (const sch of escolasExibidas) {
        footerRow.push(totaisPorEscola[sch.id]?.totalItens || 0)
      }
      footerRow.push(totalGeral.qtd)
      footerRow.push(totalGeral.valor)
      rowsProduto.push(footerRow)

      const wsProduto = XLSX.utils.aoa_to_sheet([headers, ...rowsProduto])
      XLSX.utils.book_append_sheet(wb, wsProduto, 'Consolidado Matriz')

      // 2. Aba Resumo por Escola
      const headersEscola = ['Escola', 'Rota', 'Total Itens (Kg/Un)', 'Valor Previsto (R$)']
      const rowsEscola = escolasExibidas.map((sch) => [
        sch.name,
        sch.route,
        totaisPorEscola[sch.id]?.totalItens || 0,
        totaisPorEscola[sch.id]?.totalValor || 0,
      ])
      rowsEscola.push(['TOTAL GERAL', '', totalGeral.qtd, totalGeral.valor])

      const wsEscola = XLSX.utils.aoa_to_sheet([headersEscola, ...rowsEscola])
      XLSX.utils.book_append_sheet(wb, wsEscola, 'Resumo por Escola')

      const fileName = `consolidacao-pedidos-${new Date().toISOString().split('T')[0]}.xlsx`
      XLSX.writeFile(wb, fileName)
      toast.success('Planilha de consolidação exportada com sucesso!')
    } catch (err) {
      console.error('Erro ao exportar planilha:', err)
      toast.error('Falha ao gerar arquivo Excel.')
    }
  }

  const cicloSelecionadoNome =
    selectedCicloId === 'todos'
      ? 'Todos os Ciclos'
      : ciclos.find((c) => c.id === selectedCicloId)?.nome || 'Ciclo Selecionado'

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Consolidação de Pedidos</h1>
          <p className="text-muted-foreground">
            Matriz de demanda agregada Produto × Escola para planejamento de compras e colheita.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleExportarExcel} className="gap-2">
            <Download className="h-4 w-4" /> Exportar Planilha (XLSX)
          </Button>
        </div>
      </div>

      {/* Barra de Filtros e Controles */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 min-w-[220px]">
                <Calendar className="h-4 w-4 text-primary shrink-0" />
                <Label className="text-xs font-semibold shrink-0">Ciclo:</Label>
                <Select value={selectedCicloId} onValueChange={setSelectedCicloId}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Selecione o Ciclo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os Ciclos</SelectItem>
                    {ciclos.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome} ({c.status})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                <Input
                  placeholder="Filtrar por nome..."
                  value={filtroTexto}
                  onChange={(e) => setFiltroTexto(e.target.value)}
                  className="h-9 w-48 text-sm"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="ocultar-vazios"
                  checked={ocultarVazios}
                  onCheckedChange={setOcultarVazios}
                />
                <Label htmlFor="ocultar-vazios" className="text-xs cursor-pointer">
                  Ocultar sem demanda
                </Label>
              </div>
            </div>

            <div className="flex items-center gap-4 text-right">
              <div>
                <p className="text-xs text-muted-foreground">Total de Demanda</p>
                <p className="text-lg font-bold text-primary">
                  {totalGeral.qtd.toLocaleString('pt-BR')} itens / Kg
                </p>
              </div>
              <div className="border-l pl-4">
                <p className="text-xs text-muted-foreground">Valor Previsto</p>
                <p className="text-lg font-bold text-foreground">
                  R${' '}
                  {totalGeral.valor.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs Por Produto e Por Escola */}
      <Tabs
        value={tabAtiva}
        onValueChange={(v) => setTabAtiva(v as 'produto' | 'escola')}
        className="w-full"
      >
        <div className="flex items-center justify-between pb-2">
          <TabsList>
            <TabsTrigger value="produto" className="gap-2">
              <Package className="h-4 w-4" /> Por Produto (Matriz Geral)
            </TabsTrigger>
            <TabsTrigger value="escola" className="gap-2">
              <School className="h-4 w-4" /> Por Escola (Resumo)
            </TabsTrigger>
          </TabsList>
          <Badge variant="outline" className="text-xs">
            {cicloSelecionadoNome} • {produtosExibidos.length} produtos • {escolasExibidas.length}{' '}
            escolas
          </Badge>
        </div>

        {/* Tab 1: Matriz Produto x Escola */}
        <TabsContent value="produto" className="space-y-4">
          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Grid className="h-4 w-4 text-primary" /> Matriz Cruzada de Distribuição
              </CardTitle>
              <CardDescription>
                Quantidades consolidadas por produto para cada unidade escolar no ciclo ativo.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto max-h-[550px] border-t">
                <Table className="relative w-full border-collapse">
                  <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                    <TableRow>
                      <TableHead className="min-w-[180px] sticky left-0 bg-background z-20 font-bold border-r">
                        Produto
                      </TableHead>
                      <TableHead className="w-16">Unidade</TableHead>
                      <TableHead className="w-24">Preço (R$)</TableHead>
                      {escolasExibidas.map((sch) => (
                        <TableHead
                          key={sch.id}
                          className="text-center min-w-[110px] max-w-[130px] truncate text-xs"
                          title={sch.name}
                        >
                          {sch.name}
                        </TableHead>
                      ))}
                      <TableHead className="text-right font-bold bg-primary/10 min-w-[100px]">
                        Total Qtd
                      </TableHead>
                      <TableHead className="text-right font-bold bg-primary/15 min-w-[120px]">
                        Total R$
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {produtosExibidos.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={escolasExibidas.length + 5}
                          className="text-center py-8 text-muted-foreground"
                        >
                          Nenhum produto com demanda para os filtros aplicados.
                        </TableCell>
                      </TableRow>
                    ) : (
                      produtosExibidos.map((prod) => {
                        const tot = totaisPorProduto[prod.id] || { totalQtd: 0, totalValor: 0 }
                        return (
                          <TableRow key={prod.id} className="hover:bg-muted/40">
                            <TableCell className="font-medium sticky left-0 bg-background z-10 border-r">
                              <div className="flex items-center gap-1.5">
                                <span>{prod.name}</span>
                                {prod.essencial && (
                                  <Badge
                                    variant="secondary"
                                    className="text-[9px] px-1 py-0 h-3.5 bg-amber-100 text-amber-800"
                                  >
                                    Essencial
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {prod.unit}
                            </TableCell>
                            <TableCell className="text-xs">R$ {prod.price.toFixed(2)}</TableCell>
                            {escolasExibidas.map((sch) => {
                              const qtd = matriz.get(prod.id)?.get(sch.id) || 0
                              return (
                                <TableCell
                                  key={sch.id}
                                  className={`text-center text-xs font-mono ${
                                    qtd > 0
                                      ? 'font-semibold text-primary bg-primary/5'
                                      : 'text-muted-foreground/30'
                                  }`}
                                >
                                  {qtd > 0 ? qtd : '-'}
                                </TableCell>
                              )
                            })}
                            <TableCell className="text-right font-bold font-mono bg-primary/5 text-primary">
                              {tot.totalQtd}
                            </TableCell>
                            <TableCell className="text-right font-bold font-mono bg-primary/10">
                              R$ {tot.totalValor.toFixed(2)}
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
        </TabsContent>

        {/* Tab 2: Resumo Por Escola */}
        <TabsContent value="escola" className="space-y-4">
          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-base flex items-center gap-2">
                <School className="h-4 w-4 text-primary" /> Demanda Consolidada por Escola
              </CardTitle>
              <CardDescription>
                Totais e lista detalhada de itens que cada escola parceira solicitou no ciclo.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Escola / Unidade</TableHead>
                      <TableHead>Rota Logística</TableHead>
                      <TableHead>Itens Solicitados</TableHead>
                      <TableHead className="text-right">Volume Total (Kg/Un)</TableHead>
                      <TableHead className="text-right">Valor Total Previsto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {escolasExibidas.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          Nenhuma escola com demanda registrada.
                        </TableCell>
                      </TableRow>
                    ) : (
                      escolasExibidas.map((sch) => {
                        const tot = totaisPorEscola[sch.id] || { totalItens: 0, totalValor: 0 }
                        // Lista de itens desta escola
                        const itensDaEscola = products
                          .map((p) => ({
                            nome: p.name,
                            qtd: matriz.get(p.id)?.get(sch.id) || 0,
                            unidade: p.unit,
                          }))
                          .filter((i) => i.qtd > 0)

                        return (
                          <TableRow key={sch.id}>
                            <TableCell className="font-semibold text-primary">{sch.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{sch.route}</Badge>
                            </TableCell>
                            <TableCell>
                              <span
                                className="text-xs text-muted-foreground"
                                title={itensDaEscola
                                  .map((i) => `${i.qtd} ${i.unidade} ${i.nome}`)
                                  .join(', ')}
                              >
                                {itensDaEscola.length > 0
                                  ? `${itensDaEscola.length} produto(s) distintos`
                                  : 'Nenhum item'}
                              </span>
                            </TableCell>
                            <TableCell className="text-right font-mono font-medium">
                              {tot.totalItens}
                            </TableCell>
                            <TableCell className="text-right font-mono font-bold text-foreground">
                              R${' '}
                              {tot.totalValor.toLocaleString('pt-BR', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
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
        </TabsContent>
      </Tabs>
    </div>
  )
}
