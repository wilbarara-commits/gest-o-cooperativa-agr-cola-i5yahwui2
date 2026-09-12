import { useState, useRef, useMemo, useEffect } from 'react'
import { useApp } from '@/context/app-context'
import { useAuth } from '@/context/auth-context'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
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
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ArrowRight,
  ShieldAlert,
  Info,
  Calendar,
  Layers,
  History,
  FileCheck,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { toast } from 'sonner'
import { parseSecretaryExcel, type ParsedExcelResult } from '@/lib/excelImporter'
import { rotasService } from '@/services/rotas'
import { pedidosService } from '@/services/pedidos'
import { importacoesService } from '@/services/whatsapp-import'
import type { ImportacaoRecord } from '@/lib/types'

export default function ExcelImport() {
  const { contracts, schools, products, activeCiclo, rotas, refreshData } = useApp()
  const { user } = useAuth()

  // Filtrar contratos com modalidade centralizada
  const centralContracts = useMemo(
    () => contracts.filter((c) => c.modalidade_pedido === 'centralizado'),
    [contracts],
  )

  const [selectedContractId, setSelectedContractId] = useState<string>(
    centralContracts[0]?.id || '',
  )
  const [fileName, setFileName] = useState('')
  const [isParsing, setIsParsing] = useState(false)
  const [parsedData, setParsedData] = useState<ParsedExcelResult | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [historyList, setHistoryList] = useState<ImportacaoRecord[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const selectedContract = useMemo(
    () => contracts.find((c) => c.id === selectedContractId),
    [contracts, selectedContractId],
  )

  // Carregar histórico de importações
  const loadHistory = async () => {
    setLoadingHistory(true)
    try {
      const records = await importacoesService.getAll()
      setHistoryList(records)
    } catch (err) {
      console.error('Erro ao carregar histórico:', err)
    } finally {
      setLoadingHistory(false)
    }
  }

  useEffect(() => {
    loadHistory()
  }, [])

  // Processar arquivo .xlsx selecionado
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!selectedContract) {
      toast.error('Selecione primeiro o contrato com modalidade centralizada.')
      return
    }

    setFileName(file.name)
    setIsParsing(true)
    setParsedData(null)

    try {
      const arrayBuffer = await file.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: 'array' })

      const result = parseSecretaryExcel(workbook, schools, selectedContract.escolas, products)

      setParsedData(result)
      if (result.anomalies.length > 0) {
        toast.warning(
          `Planilha lida com ${result.anomalies.length} anomalia(s) de duplicidade detectadas!`,
        )
      } else if (result.pendingIssuesCount > 0) {
        toast.info(
          `Planilha lida. Há ${result.pendingIssuesCount} pendência(s) de vinculação a resolver.`,
        )
      } else {
        toast.success(
          `Planilha processada com sucesso! ${result.orders.length} pedidos prontos para importação.`,
        )
      }
    } catch (err: any) {
      console.error('Erro ao processar planilha:', err)
      toast.error('Falha ao ler o arquivo Excel. Verifique se o formato é .xlsx válido.')
    } finally {
      setIsParsing(false)
    }
  }

  // Gerar planilha de exemplo/template
  const handleDownloadSample = () => {
    try {
      const wb = XLSX.utils.book_new()

      // Criar ROTA A de exemplo com a estrutura esperada
      const rotaAData: any[][] = [
        ['PREFEITURA MUNICIPAL - SECRETARIA DE EDUCAÇÃO'],
        ['PROGRAMA NACIONAL DE ALIMENTAÇÃO ESCOLAR - PNAE'],
        ['CRONOGRAMA DE ENTREGA - SEMANA ATIVA'],
        ['ROTA A - ZONA URBANA'],
        [],
        ['TIPO', 'DESCRIÇÃO', 'UNIDADE', 'CMEI', 'FUNDAMENTAL', 'INTEGRAL'],
        [
          'COD',
          'NOME DA ESCOLA',
          '',
          'E.M. João da Silva',
          'E.E. Maria Antonieta',
          'Creche Pingo de Gente',
        ],
        ['', 'Nº ALUNOS / DIAS', '', '150 alunos (5d)', '220 alunos (5d)', '80 alunos (5d)'],
        ['ITEM', 'DESCRIÇÃO DO PRODUTO', 'UNID', 'QTD (KG)', 'QTD (KG)', 'QTD (KG)'],
      ]

      // Linhas de produtos (10 a 34)
      for (const p of products.slice(0, 15)) {
        rotaAData.push(['01', p.name, p.unit, 15, 20, 10])
      }
      rotaAData.push(['TOTAL', 'TOTAL GERAL', 'KG', 150, 200, 100])

      const wsA = XLSX.utils.aoa_to_sheet(rotaAData)
      XLSX.utils.book_append_sheet(wb, wsA, 'ROTA A')

      // Aba TOTAL para demonstrar a regra de ignorar
      const wsTotal = XLSX.utils.aoa_to_sheet([['CONSOLIDADO GERAL DE TODAS AS ROTAS']])
      XLSX.utils.book_append_sheet(wb, wsTotal, 'TOTAL')

      XLSX.writeFile(wb, 'modelo_planilha_secretaria_centralizada.xlsx')
      toast.success('Modelo de planilha gerado e baixado!')
    } catch (err) {
      console.error('Erro ao gerar modelo:', err)
    }
  }

  // Confirmar Importação e Gravar Pedidos no Banco
  const handleConfirmImport = async () => {
    if (!parsedData || !selectedContract) return

    // Validar se existem pedidos prontos sem pendências impeditivas
    const validOrders = parsedData.orders.filter(
      (o) => o.schoolId && o.isLinkedToContract && o.items.length > 0,
    )

    if (validOrders.length === 0) {
      toast.error(
        'Nenhum pedido pode ser importado. Resolva as pendências de vinculação das escolas ao contrato.',
      )
      return
    }

    setIsImporting(true)

    try {
      const now = new Date().toISOString()
      let okCount = 0
      let errorCount = 0
      const errorLog: any[] = []

      // Mapear rotas: identificar a rota no contrato ou criar
      const routeMap = new Map<string, string>() // sheetName -> rotaId

      for (const sheetName of parsedData.routesFound) {
        const rotaRec = await rotasService.findOrCreate(selectedContract.id, sheetName)
        routeMap.set(sheetName, rotaRec.id)
      }

      // Criar cada pedido no banco PocketBase
      for (const o of validOrders) {
        try {
          const rotaId = routeMap.get(o.routeRaw)
          const orderNum = `IMP-${Date.now().toString().slice(-4)}-${Math.floor(Math.random() * 900 + 100)}`

          await pedidosService.create({
            numero: orderNum,
            escola_id: o.schoolId!,
            ciclo_id: activeCiclo?.id,
            origem: 'excel',
            rota_id: rotaId,
            validacao: {
              status: 'validado',
              motivo: `Importado de planilha centralizada (${o.routeRaw})`,
              detalhes: [`${o.items.length} itens recebidos da secretaria`],
            },
            data_prevista: now,
            status: 'Pendente',
            itens: o.items.map((it) => ({
              produto_id: it.productId || '',
              quantidade: it.quantity,
              preco_unitario: it.price,
            })),
          })
          okCount++
        } catch (itemErr: any) {
          console.error('Erro ao salvar pedido da escola:', o.schoolNameRaw, itemErr)
          errorCount++
          errorLog.push({
            escola: o.schoolNameRaw,
            erro: itemErr?.message || 'Falha ao salvar pedido',
          })
        }
      }

      // Registrar o histórico na collection 'importacoes'
      await importacoesService.create({
        ciclo_id: activeCiclo?.id || '',
        contrato_id: selectedContract.id,
        arquivo: fileName || 'planilha_secretaria.xlsx',
        data: now,
        usuario_id: user?.id,
        linhas_total: parsedData.orders.length,
        linhas_ok: okCount,
        linhas_erro: errorCount + (parsedData.orders.length - validOrders.length),
        erros: errorLog,
      })

      toast.success(
        `Importação concluída! ${okCount} pedidos criados com sucesso com origem = excel.`,
      )
      setParsedData(null)
      setFileName('')
      await refreshData()
      await loadHistory()
    } catch (err: any) {
      console.error('Erro geral na importação:', err)
      toast.error('Falha ao concluir a importação no banco.')
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Importação de Pedidos (Planilha)</h1>
          <p className="text-muted-foreground">
            Carga de pedidos consolidados da Secretaria de Educação para contratos com modalidade
            centralizada.
          </p>
        </div>

        <Button variant="outline" onClick={handleDownloadSample} className="gap-2">
          <FileSpreadsheet className="h-4 w-4" /> Baixar Modelo Exemplo (.xlsx)
        </Button>
      </div>

      {/* Seleção de Contrato Centralizado */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" /> Contrato Centralizado de Destino
          </CardTitle>
          <CardDescription>
            Apenas contratos com <code>modalidade_pedido = centralizado</code> recebem pedidos por
            importação de planilha.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {centralContracts.length === 0 ? (
            <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 text-sm">
              <AlertTriangle className="h-5 w-5 inline mr-2 text-amber-600" />
              Nenhum contrato com modalidade "centralizado" encontrado. Ajuste a modalidade na tela
              de Contratos para habilitar a importação.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
              <div>
                <Label htmlFor="contrato-select" className="text-xs font-semibold">
                  Selecione o Contrato Centralizado
                </Label>
                <Select
                  value={selectedContractId}
                  onValueChange={(val) => {
                    setSelectedContractId(val)
                    setParsedData(null)
                  }}
                >
                  <SelectTrigger id="contrato-select" className="mt-1">
                    <SelectValue placeholder="Selecione o Contrato" />
                  </SelectTrigger>
                  <SelectContent>
                    {centralContracts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.numero} — {c.tipo || 'PNAE'} ({c.escolas.length} escolas vinculadas)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedContract && (
                <div className="p-3 rounded-lg bg-muted/40 border text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Modalidade:</span>
                    <Badge variant="outline" className="font-mono text-[10px] capitalize">
                      {selectedContract.modalidade_pedido}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Escolas Vinculadas:</span>
                    <span className="font-semibold text-primary">
                      {selectedContract.escolas.length} escolas
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Ciclo Ativo Vinculado:</span>
                    <span className="font-semibold text-foreground">
                      {activeCiclo?.nome || 'Sem ciclo ativo'} ({activeCiclo?.status || '-'})
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Área de Upload e Drag-and-Drop */}
      {selectedContract && (
        <Card className="border-dashed border-2">
          <CardContent className="p-8 text-center space-y-4">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".xlsx,.xls"
              className="hidden"
            />
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Upload className="h-7 w-7" />
            </div>

            <div>
              <h3 className="text-base font-semibold">
                Faça o upload da planilha da Secretaria (.xlsx)
              </h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1">
                O motor irá processar as abas de Rota (ROTA A, ROTA B, ROTA C...), transpor as
                colunas de escola e casar os nomes com tolerância inteligente.
              </p>
            </div>

            <div className="flex justify-center gap-3">
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={isParsing}
                className="gap-2"
              >
                {isParsing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Processando Planilha...
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="h-4 w-4" /> Selecionar Arquivo
                  </>
                )}
              </Button>
            </div>

            {fileName && (
              <p className="text-xs font-mono text-muted-foreground">
                Arquivo selecionado: <strong>{fileName}</strong>
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Preview dos Dados Extraídos antes de Confirmar */}
      {parsedData && (
        <div className="space-y-4 animate-fade-in">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileCheck className="h-5 w-5 text-primary" /> Prévia da Importação
                  </CardTitle>
                  <CardDescription>
                    Revise as rotas, escolas, quantidades e solucione eventuais pendências antes de
                    gravar.
                  </CardDescription>
                </div>
                <Button
                  onClick={handleConfirmImport}
                  disabled={isImporting || parsedData.orders.length === 0}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Gravando no Banco...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" /> Confirmar e Criar Pedidos
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Cards de Resumo da Leitura */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-muted/30">
                  <CardContent className="p-3 text-center">
                    <p className="text-xs text-muted-foreground">Abas de Rota</p>
                    <p className="text-xl font-bold text-primary">
                      {parsedData.routesFound.length}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {parsedData.routesFound.join(', ')}
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-muted/30">
                  <CardContent className="p-3 text-center">
                    <p className="text-xs text-muted-foreground">Escolas Identificadas</p>
                    <p className="text-xl font-bold text-primary">{parsedData.orders.length}</p>
                    <p className="text-[10px] text-muted-foreground">colunas mapeadas</p>
                  </CardContent>
                </Card>

                <Card className="bg-muted/30">
                  <CardContent className="p-3 text-center">
                    <p className="text-xs text-muted-foreground">Volume Total (Kg/Un)</p>
                    <p className="text-xl font-bold text-primary">
                      {parsedData.totalWeight.toLocaleString('pt-BR')}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {parsedData.totalItemsCount} linhas de produto
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-muted/30">
                  <CardContent className="p-3 text-center">
                    <p className="text-xs text-muted-foreground">Pendências de Cadastro</p>
                    <p
                      className={`text-xl font-bold ${
                        parsedData.pendingIssuesCount > 0 ? 'text-amber-600' : 'text-emerald-600'
                      }`}
                    >
                      {parsedData.pendingIssuesCount}
                    </p>
                    <p className="text-[10px] text-muted-foreground">necessitam atenção</p>
                  </CardContent>
                </Card>
              </div>

              {/* Alertas de Anomalias de Duplicidade */}
              {parsedData.anomalies.length > 0 && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-900 dark:text-rose-200 text-xs space-y-1">
                  <p className="font-semibold flex items-center gap-1.5 text-rose-700 dark:text-rose-300">
                    <ShieldAlert className="h-4 w-4" /> Anomalias Detectadas na Planilha:
                  </p>
                  {parsedData.anomalies.map((anom, idx) => (
                    <p key={idx} className="pl-5">
                      • {anom}
                    </p>
                  ))}
                </div>
              )}

              {/* Tabela de Preview dos Pedidos */}
              <div className="rounded-md border max-h-[420px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Aba / Rota</TableHead>
                      <TableHead>Escola na Planilha</TableHead>
                      <TableHead>Vínculo no Contrato</TableHead>
                      <TableHead>Itens / Demanda</TableHead>
                      <TableHead className="text-right">Valor Estimado</TableHead>
                      <TableHead>Status / Pendência</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.orders.map((po, idx) => {
                      const hasIssues = po.issues.length > 0

                      return (
                        <TableRow key={idx} className={hasIssues ? 'bg-amber-500/5' : ''}>
                          <TableCell className="font-semibold text-xs text-primary">
                            {po.routeRaw}
                          </TableCell>
                          <TableCell className="font-medium text-xs">{po.schoolNameRaw}</TableCell>
                          <TableCell className="text-xs">
                            {po.isLinkedToContract ? (
                              <span className="text-emerald-600 flex items-center gap-1">
                                <CheckCircle2 className="h-3.5 w-3.5" /> {po.schoolNameMatched}
                              </span>
                            ) : (
                              <span className="text-rose-600 flex items-center gap-1">
                                <AlertTriangle className="h-3.5 w-3.5" /> Não vinculada
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">
                            <span
                              className="text-muted-foreground"
                              title={po.items
                                .map(
                                  (i) =>
                                    `${i.quantity}x ${i.productNameMatched || i.productNameRaw}`,
                                )
                                .join(', ')}
                            >
                              {po.items.length} produto(s)
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            R${' '}
                            {po.totalCalculated.toLocaleString('pt-BR', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </TableCell>
                          <TableCell>
                            {hasIssues ? (
                              <div className="text-[11px] text-amber-700 space-y-0.5">
                                {po.issues.map((iss, i) => (
                                  <p key={i}>⚠️ {iss}</p>
                                ))}
                              </div>
                            ) : (
                              <Badge className="bg-emerald-600 text-[10px]">
                                Pronto para importar
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Histórico de Importações Anteriores */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-5 w-5 text-primary" /> Histórico de Importações
          </CardTitle>
          <CardDescription>
            Registro de auditoria de planilhas carregadas no sistema CooperGestão.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data / Hora</TableHead>
                  <TableHead>Arquivo</TableHead>
                  <TableHead>Ciclo</TableHead>
                  <TableHead>Contrato</TableHead>
                  <TableHead className="text-center">Total Linhas</TableHead>
                  <TableHead className="text-center">Criados com Sucesso</TableHead>
                  <TableHead className="text-center">Erros / Pendências</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingHistory ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> Carregando histórico...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : historyList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                      Nenhuma importação registrada até o momento.
                    </TableCell>
                  </TableRow>
                ) : (
                  historyList.map((imp) => (
                    <TableRow key={imp.id}>
                      <TableCell className="text-xs">
                        {new Date(imp.data || imp.created || '').toLocaleString('pt-BR')}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-primary">
                        {imp.arquivo}
                      </TableCell>
                      <TableCell className="text-xs">
                        {imp.expand?.ciclo_id?.nome || imp.ciclo_id}
                      </TableCell>
                      <TableCell className="text-xs">
                        {imp.expand?.contrato_id?.numero || imp.contrato_id}
                      </TableCell>
                      <TableCell className="text-center font-mono text-xs">
                        {imp.linhas_total}
                      </TableCell>
                      <TableCell className="text-center font-mono text-xs text-emerald-600 font-semibold">
                        {imp.linhas_ok}
                      </TableCell>
                      <TableCell className="text-center font-mono text-xs text-amber-600">
                        {imp.linhas_erro}
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
