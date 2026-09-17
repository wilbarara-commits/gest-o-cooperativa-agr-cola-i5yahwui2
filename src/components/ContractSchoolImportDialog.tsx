import { useState, useRef, useId, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import {
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  Check,
  RefreshCw,
  ArrowRight,
  Sparkles,
  ClipboardPaste,
  ShieldAlert,
  Download,
  Link2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  parseContractSchoolsMatrix,
  type ContractSchoolParseResult,
  type ParsedContractSchoolRow,
} from '@/lib/contractSchoolCsvImporter'
import { escolasService } from '@/services/escolas'
import type { School, Contract } from '@/lib/types'
import * as XLSX from 'xlsx'

export interface ImportedSchoolLinkResult {
  escolaId: string
  escolaNome: string
  rotaPlanilha: string
}

interface ContractSchoolImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contractId?: string
  contractRotas: Array<{ id?: string; nome: string; ordem?: number }>
  masterSchools: School[]
  allContracts: Contract[]
  currentLinkedSchoolIds: Set<string>
  /**
   * Callback ao confirmar importação com sucesso.
   * Recebe os vínculos a adicionar/atualizar no form do contrato
   */
  onSuccess: (links: ImportedSchoolLinkResult[]) => Promise<void> | void
}

export function ContractSchoolImportDialog({
  open,
  onOpenChange,
  contractId,
  contractRotas,
  masterSchools,
  allContracts,
  currentLinkedSchoolIds,
  onSuccess,
}: ContractSchoolImportDialogProps) {
  const fileInputId = useId()
  const [sourceMode, setSourceMode] = useState<'upload' | 'paste'>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [pastedText, setPastedText] = useState('')
  const [selectedRota, setSelectedRota] = useState<string>('')

  const [isParsing, setIsParsing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveProgress, setSaveProgress] = useState(0)

  const [parseResult, setParseResult] = useState<ContractSchoolParseResult | null>(null)
  const [filterTab, setFilterTab] = useState<
    'all' | 'processable' | 'created' | 'updated' | 'conflicts' | 'errors'
  >('all')

  const [importSummary, setImportSummary] = useState<{
    created: number
    updated: number
    linked: number
    conflictsIgnored: number
    errors: number
  } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Selecionar rota automaticamente se só houver uma
  useMemo(() => {
    if (!selectedRota && contractRotas.length === 1) {
      setSelectedRota(contractRotas[0].nome)
    }
  }, [contractRotas, selectedRota])

  const runParse = async (input: File | string, fileName?: string) => {
    if (!selectedRota) {
      toast.error('Selecione primeiro a Rota da Planilha deste contrato a atribuir às escolas.')
      return
    }

    setIsParsing(true)
    setImportSummary(null)

    try {
      const res = await parseContractSchoolsMatrix({
        fileOrText: input,
        fileName,
        selectedRota,
        currentContractId: contractId,
        currentContractSchoolIds: currentLinkedSchoolIds,
        masterSchools,
        allContracts,
      })

      setParseResult(res)

      if (res.processableRows.length > 0) {
        toast.info(
          `${res.processableRows.length} escola(s) elegíveis para vincular com a rota "${selectedRota}".`,
        )
      } else {
        toast.warning('Nenhuma escola elegível para importação identificada no arquivo.')
      }

      if (res.conflictOtherContractRows.length > 0) {
        toast.warning(
          `${res.conflictOtherContractRows.length} escola(s) vinculada(s) a outro contrato foram bloqueadas e não serão vinculadas.`,
        )
      }
    } catch (err: any) {
      console.error('Erro na análise das escolas:', err)
      toast.error(err?.message || 'Falha ao processar arquivo/texto.')
      setParseResult(null)
    } finally {
      setIsParsing(false)
    }
  }

  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile)
    runParse(selectedFile, selectedFile.name)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0])
    }
  }

  const handleProcessPastedText = () => {
    if (!pastedText.trim()) {
      toast.warning('Cole os dados no campo de texto antes de analisar.')
      return
    }
    runParse(pastedText, 'dados_colados.csv')
  }

  const handleReset = () => {
    setFile(null)
    setPastedText('')
    setParseResult(null)
    setImportSummary(null)
    setSaveProgress(0)
    setFilterTab('all')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleDownloadModel = () => {
    const wsData = [
      ['Nome da Escola', 'Tipo', 'Nº Alunos', 'Telefone / WhatsApp', 'E-mail', 'Endereço'],
      [
        'CMEI MARIA TEREZA PRIES DE ABREU',
        'CMEI',
        '125',
        '(21) 98765-4321',
        'cmei.maria@educacao.gov.br',
        'Rua das Palmeiras, 120 - Centro',
      ],
      [
        'CC LAR VOVÔ MIGUEL',
        'CRECHE',
        '47',
        '(21) 99887-1122',
        'creche.miguel@educacao.gov.br',
        'Av. Brasil, 450 - Bairro Novo',
      ],
      [
        'EM ALICE SALDANHA',
        'FUNDAMENTAL',
        '171',
        '(21) 97766-3344',
        'em.alice@educacao.gov.br',
        'Rua São Pedro, 80',
      ],
      [
        'CE ROSE DALMASO (CEDAL)',
        'INTEGRAL',
        '275',
        '(21) 96655-2211',
        'cedal@educacao.gov.br',
        'Estrada Geral, km 5',
      ],
    ]
    const ws = XLSX.utils.aoa_to_sheet(wsData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Escolas')
    XLSX.writeFile(wb, 'modelo_importacao_escolas_contrato.xlsx')
  }

  // Executa a confirmação da importação
  const handleConfirmImport = async () => {
    if (!parseResult || parseResult.processableRows.length === 0) return

    setIsSaving(true)
    setSaveProgress(0)

    try {
      const processable = parseResult.processableRows
      let createdCount = 0
      let updatedCount = 0
      const linksToForm: ImportedSchoolLinkResult[] = []

      // Processar em lote com progresso
      for (let i = 0; i < processable.length; i++) {
        const row = processable[i]

        try {
          if (row.status === 'create_and_link') {
            // 1. Criar escola no cadastro mestre global
            // Rota no mestre global fica como 'Sem Rota' (a rota da planilha é gravada estritamente no vínculo)
            const created = await escolasService.create({
              nome: row.nome,
              tipo: row.tipo || undefined,
              alunos: row.alunos,
              telefone: row.telefone || '',
              email: row.email || undefined,
              endereco: row.endereco || '',
              rota: 'Sem Rota',
            })
            createdCount++

            linksToForm.push({
              escolaId: created.id,
              escolaNome: created.nome,
              rotaPlanilha: selectedRota,
            })
          } else if (
            (row.status === 'update_and_link' || row.status === 'update_current_link') &&
            row.existingSchoolId
          ) {
            // 2. Atualizar dados no cadastro mestre global (se houver campos a atualizar)
            const updatePayload: Record<string, any> = {}

            if (row.presentColumns.tipo && row.tipo) {
              updatePayload.tipo = row.tipo
            }
            if (row.presentColumns.alunos && row.alunos !== undefined) {
              updatePayload.alunos = row.alunos
            }
            if (row.presentColumns.telefone && row.telefone) {
              updatePayload.telefone = row.telefone
            }
            if (row.presentColumns.email && row.email) {
              updatePayload.email = row.email
            }
            if (row.presentColumns.endereco && row.endereco) {
              updatePayload.endereco = row.endereco
            }

            if (Object.keys(updatePayload).length > 0) {
              await escolasService.update(row.existingSchoolId, updatePayload)
            }
            updatedCount++

            linksToForm.push({
              escolaId: row.existingSchoolId,
              escolaNome: row.existingSchoolName || row.nome,
              rotaPlanilha: selectedRota,
            })
          }
        } catch (subErr) {
          console.error(`Erro ao salvar escola [${row.nome}]:`, subErr)
        }

        setSaveProgress(Math.round(((i + 1) / processable.length) * 100))
      }

      setImportSummary({
        created: createdCount,
        updated: updatedCount,
        linked: linksToForm.length,
        conflictsIgnored: parseResult.conflictOtherContractRows.length,
        errors: parseResult.errorRows.length + parseResult.duplicateFileRows.length,
      })

      // Chamar o callback para aplicar ao contrato
      await onSuccess(linksToForm)

      toast.success(
        `Importação concluída: ${linksToForm.length} escola(s) vinculada(s) à rota "${selectedRota}" (${createdCount} nova(s), ${updatedCount} atualizada(s)).`,
      )
    } catch (err: any) {
      console.error('Erro ao confirmar importação:', err)
      toast.error('Ocorreu um erro ao gravar as escolas e vínculos.')
    } finally {
      setIsSaving(false)
    }
  }

  // Filtragem dos itens no preview
  const displayRows =
    parseResult?.allRows.filter((row) => {
      if (filterTab === 'processable')
        return (
          row.status === 'create_and_link' ||
          row.status === 'update_and_link' ||
          row.status === 'update_current_link'
        )
      if (filterTab === 'created') return row.status === 'create_and_link'
      if (filterTab === 'updated')
        return row.status === 'update_and_link' || row.status === 'update_current_link'
      if (filterTab === 'conflicts') return row.status === 'conflict_other_contract'
      if (filterTab === 'errors') return row.status === 'error' || row.status === 'duplicate_file'
      return true
    }) || []

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!isSaving) {
          onOpenChange(v)
          if (!v) handleReset()
        }
      }}
    >
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Importar Escolas para o Contrato (CSV / Planilha)
          </DialogTitle>
          <DialogDescription>
            Importe a lista de escolas participantes já atribuindo a elas a Rota da Planilha deste
            contrato. Escolas novas serão cadastradas no mestre global e as já existentes terão seus
            dados atualizados.
          </DialogDescription>
        </DialogHeader>

        {/* SELETOR OBRIGATÓRIO DE ROTA DA PLANILHA */}
        <div className="p-3 bg-muted/40 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
              <Link2 className="h-4 w-4 text-primary" />
              1. Rota da Planilha a atribuir no vínculo <span className="text-destructive">*</span>
            </Label>
            <p className="text-[11px] text-muted-foreground">
              A rota da planilha selecionada será salva no vínculo deste contrato (nunca na escola
              em si).
            </p>
          </div>

          <div className="w-full sm:w-64 shrink-0">
            {contractRotas.length === 0 ? (
              <div className="p-2 border border-destructive/40 bg-destructive/10 rounded text-[11px] text-destructive">
                Nenhuma rota da planilha cadastrada neste contrato. Adicione uma rota no topo da aba
                Escolas antes de importar.
              </div>
            ) : (
              <Select
                value={selectedRota}
                onValueChange={(val) => {
                  setSelectedRota(val)
                  // Se já analisou com outra rota, avisa para reprocessar
                  if (parseResult) {
                    toast.info(
                      `Rota alterada para "${val}". Processe novamente para atualizar o preview.`,
                    )
                  }
                }}
                disabled={isSaving}
              >
                <SelectTrigger className="h-8 text-xs bg-background font-medium">
                  <SelectValue placeholder="Selecione a Rota da Planilha..." />
                </SelectTrigger>
                <SelectContent>
                  {contractRotas.map((cr, idx) => (
                    <SelectItem key={idx} value={cr.nome} className="text-xs font-medium">
                      {cr.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* SELEÇÃO DO MÉTODO: ARQUIVO OU COLAR */}
        {!parseResult && !importSummary && (
          <div className="space-y-3 flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between">
              <div className="flex rounded-lg border bg-muted p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setSourceMode('upload')}
                  className={`px-3 py-1 rounded font-medium transition-colors ${
                    sourceMode === 'upload'
                      ? 'bg-background shadow-xs text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Upload className="h-3.5 w-3.5 inline mr-1.5" />
                  Arquivo (.csv ou .xlsx)
                </button>
                <button
                  type="button"
                  onClick={() => setSourceMode('paste')}
                  className={`px-3 py-1 rounded font-medium transition-colors ${
                    sourceMode === 'paste'
                      ? 'bg-background shadow-xs text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <ClipboardPaste className="h-3.5 w-3.5 inline mr-1.5" />
                  Colar Dados
                </button>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1.5 text-muted-foreground"
                onClick={handleDownloadModel}
              >
                <Download className="h-3.5 w-3.5" /> Baixar Modelo
              </Button>
            </div>

            {sourceMode === 'upload' ? (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className="flex-1 border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/60 transition-colors flex flex-col items-center justify-center gap-3 min-h-[220px]"
              >
                <div className="p-3 bg-primary/10 text-primary rounded-full">
                  {isParsing ? (
                    <Loader2 className="h-7 w-7 animate-spin" />
                  ) : (
                    <Upload className="h-7 w-7" />
                  )}
                </div>

                <div className="space-y-1">
                  <p className="font-medium text-sm">
                    {isParsing
                      ? 'Analisando arquivo e validando contratos...'
                      : 'Arraste seu arquivo CSV ou Excel aqui'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Colunas aceitas: <strong>Nome da Escola</strong>, <strong>Tipo</strong>,{' '}
                    <strong>Alunos</strong>, <strong>Telefone</strong>, <strong>E-mail</strong>,{' '}
                    <strong>Endereço</strong>
                  </p>
                </div>

                <input
                  id={fileInputId}
                  ref={fileInputRef}
                  type="file"
                  accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel, text/csv"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileSelect(e.target.files[0])
                    }
                  }}
                  disabled={isParsing || !selectedRota}
                />

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isParsing || !selectedRota}
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-1"
                >
                  Selecionar Arquivo do Computador
                </Button>
                {!selectedRota && (
                  <p className="text-[11px] text-amber-600 font-medium">
                    * Escolha a Rota da Planilha acima antes de selecionar o arquivo.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2 flex-1 flex flex-col">
                <Textarea
                  placeholder={`Cole as linhas do Excel ou CSV aqui...\nExemplo:\nEM ALICE SALDANHA\tFUNDAMENTAL\t171\t(21) 98765-4321\nalice@educacao.gov.br\tRua São Pedro, 80\nCMEI SEBASTIÃO BRANCO\tCMEI\t375`}
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  className="flex-1 min-h-[200px] text-xs font-mono resize-none"
                />
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-muted-foreground">
                    Suporta colunas separadas por tabulação (Excel), vírgula ou ponto-e-vírgula.
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleProcessPastedText}
                    disabled={isParsing || !selectedRota || !pastedText.trim()}
                    className="gap-1.5"
                  >
                    {isParsing ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Analisando...
                      </>
                    ) : (
                      <>
                        <Check className="h-3.5 w-3.5" /> Analisar e Validar
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* RESUMO PÓS-IMPORTAÇÃO (SUCESSO) */}
        {importSummary && (
          <div className="p-6 bg-muted/40 rounded-xl space-y-4 my-2 border border-border">
            <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-7 w-7 shrink-0" />
              <div>
                <h3 className="font-semibold text-lg">Vínculo e Atualização Concluídos</h3>
                <p className="text-sm text-muted-foreground">
                  As escolas foram integradas ao contrato com a Rota da Planilha "{selectedRota}".
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="bg-card p-3 rounded-lg border border-border">
                <span className="text-xs text-muted-foreground">Novas Criadas no Mestre</span>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {importSummary.created}
                </p>
              </div>
              <div className="bg-card p-3 rounded-lg border border-border">
                <span className="text-xs text-muted-foreground">Atualizadas no Mestre</span>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {importSummary.updated}
                </p>
              </div>
              <div className="bg-card p-3 rounded-lg border border-border">
                <span className="text-xs text-muted-foreground">Total Vinculadas</span>
                <p className="text-2xl font-bold text-primary">{importSummary.linked}</p>
              </div>
              <div className="bg-card p-3 rounded-lg border border-border">
                <span className="text-xs text-muted-foreground">Bloqueadas (Outro Contrato)</span>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {importSummary.conflictsIgnored}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* PREVIEW DA IMPORTAÇÃO COM MÉTRICAS E FILTROS */}
        {parseResult && !importSummary && (
          <div className="flex-1 min-h-0 flex flex-col space-y-3">
            {/* Aviso de bloqueio se houver conflitos com outro contrato */}
            {parseResult.conflictOtherContractRows.length > 0 && (
              <div className="p-3 bg-amber-500/10 border border-amber-300 dark:border-amber-800 rounded-lg flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
                <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-semibold">
                    {parseResult.conflictOtherContractRows.length} escola(s) já vinculada(s) a outro
                    contrato
                  </p>
                  <p className="text-[11px] text-amber-800 dark:text-amber-300">
                    Conforme a regra operacional, uma escola não pode pertencer a mais de um
                    contrato simultaneamente. Essas linhas <strong>não serão vinculadas</strong>{' '}
                    (devem ser desvinculadas do contrato anterior primeiro). As demais linhas
                    válidas prosseguirão normalmente.
                  </p>
                </div>
              </div>
            )}

            {/* Cabeçalho de Métricas e Filtros */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-muted/50 rounded-lg text-xs">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-primary" />
                <span className="font-medium truncate max-w-[200px]">{parseResult.fileName}</span>
                <Badge variant="outline" className="text-[11px]">
                  {parseResult.totalRows} linhas
                </Badge>
                <Badge variant="secondary" className="text-[11px]">
                  Rota: {parseResult.selectedRota}
                </Badge>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <Button
                  size="sm"
                  variant={filterTab === 'all' ? 'default' : 'ghost'}
                  className="h-7 text-xs px-2.5"
                  onClick={() => setFilterTab('all')}
                >
                  Todas ({parseResult.totalRows})
                </Button>
                <Button
                  size="sm"
                  variant={filterTab === 'processable' ? 'default' : 'ghost'}
                  className="h-7 text-xs px-2.5 text-primary"
                  onClick={() => setFilterTab('processable')}
                >
                  <Check className="h-3 w-3 mr-1" />
                  Elegíveis ({parseResult.processableRows.length})
                </Button>
                <Button
                  size="sm"
                  variant={filterTab === 'created' ? 'default' : 'ghost'}
                  className="h-7 text-xs px-2.5 text-emerald-600 dark:text-emerald-400"
                  onClick={() => setFilterTab('created')}
                >
                  <Sparkles className="h-3 w-3 mr-1" />
                  Novas ({parseResult.createAndLinkRows.length})
                </Button>
                <Button
                  size="sm"
                  variant={filterTab === 'updated' ? 'default' : 'ghost'}
                  className="h-7 text-xs px-2.5 text-blue-600 dark:text-blue-400"
                  onClick={() => setFilterTab('updated')}
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Existentes (
                  {parseResult.updateAndLinkRows.length + parseResult.updateCurrentLinkRows.length})
                </Button>
                {parseResult.conflictOtherContractRows.length > 0 && (
                  <Button
                    size="sm"
                    variant={filterTab === 'conflicts' ? 'default' : 'ghost'}
                    className="h-7 text-xs px-2.5 text-amber-600 dark:text-amber-400 font-semibold"
                    onClick={() => setFilterTab('conflicts')}
                  >
                    <ShieldAlert className="h-3 w-3 mr-1" />
                    Outro Contrato ({parseResult.conflictOtherContractRows.length})
                  </Button>
                )}
                {(parseResult.errorRows.length > 0 || parseResult.duplicateFileRows.length > 0) && (
                  <Button
                    size="sm"
                    variant={filterTab === 'errors' ? 'default' : 'ghost'}
                    className="h-7 text-xs px-2.5 text-destructive"
                    onClick={() => setFilterTab('errors')}
                  >
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Pendências/Erros (
                    {parseResult.errorRows.length + parseResult.duplicateFileRows.length})
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs px-2 text-muted-foreground ml-1"
                  onClick={handleReset}
                  title="Trocar dados / Recomeçar"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Barra de progresso de gravação */}
            {isSaving && (
              <div className="space-y-1.5 p-3 bg-card border rounded-lg">
                <div className="flex justify-between text-xs">
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                    Criando novas escolas, atualizando dados e vinculando ao contrato...
                  </span>
                  <span className="font-semibold">{saveProgress}%</span>
                </div>
                <Progress value={saveProgress} className="h-2" />
              </div>
            )}

            {/* Tabela de Preview */}
            <ScrollArea className="flex-1 border rounded-lg bg-card min-h-[260px] max-h-[380px]">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/70 text-muted-foreground uppercase sticky top-0 z-10 border-b">
                  <tr>
                    <th className="py-2 px-3 w-12">#</th>
                    <th className="py-2 px-3">Escola</th>
                    <th className="py-2 px-3">Tipo</th>
                    <th className="py-2 px-3">Alunos</th>
                    <th className="py-2 px-3">Rota a Atribuir</th>
                    <th className="py-2 px-3">Situação & Ação Prevista</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {displayRows.map((row: ParsedContractSchoolRow) => {
                    const isConflictOther = row.status === 'conflict_other_contract'
                    const isError = row.status === 'error'
                    const isDuplicateFile = row.status === 'duplicate_file'
                    const isCreate = row.status === 'create_and_link'
                    const isUpdateAndLink = row.status === 'update_and_link'
                    const isUpdateCurrent = row.status === 'update_current_link'

                    return (
                      <tr
                        key={row.index}
                        className={
                          isConflictOther
                            ? 'bg-amber-500/10 hover:bg-amber-500/15'
                            : isError
                              ? 'bg-destructive/10'
                              : isDuplicateFile
                                ? 'bg-amber-500/5'
                                : isCreate
                                  ? 'bg-emerald-500/5 hover:bg-emerald-500/10'
                                  : 'hover:bg-muted/40'
                        }
                      >
                        <td className="py-2 px-3 text-muted-foreground font-mono">{row.index}</td>
                        <td className="py-2 px-3 font-medium">
                          {row.nome || (
                            <span className="text-destructive italic">
                              [Nome Vazio] (bruto: "{row.rawNome}")
                            </span>
                          )}
                          {row.existingSchoolName && row.existingSchoolName !== row.nome && (
                            <span className="text-[10px] text-muted-foreground block">
                              Mestre: "{row.existingSchoolName}"
                            </span>
                          )}
                          {row.endereco && (
                            <span className="text-[10px] text-muted-foreground block truncate max-w-[280px]">
                              {row.endereco}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          {row.tipo ? (
                            <Badge variant="outline" className="text-[10px] font-normal">
                              {row.tipo}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground italic text-[11px]">-</span>
                          )}
                        </td>
                        <td className="py-2 px-3 font-mono">
                          {row.alunos !== undefined ? (
                            row.alunos
                          ) : (
                            <span className="text-muted-foreground italic">-</span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          <Badge variant="secondary" className="text-[10px] font-medium">
                            {row.assignedRota}
                          </Badge>
                        </td>
                        <td className="py-2 px-3">
                          {/* CONFLITO: VINCULADA A OUTRO CONTRATO */}
                          {isConflictOther && (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 font-semibold">
                                <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                                Bloqueada: Contrato {row.otherContractNumber}
                              </span>
                              <span className="text-[10px] text-muted-foreground block">
                                Não será vinculada. Requer desvinculação prévia do contrato{' '}
                                <strong>{row.otherContractNumber}</strong>.
                              </span>
                            </div>
                          )}

                          {/* NOVA ESCOLA: CRIAR E VINCULAR */}
                          {isCreate && (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Criar no Mestre & Vincular
                              </span>
                              <span className="text-[10px] text-muted-foreground block">
                                Escola nova no sistema global
                              </span>
                            </div>
                          )}

                          {/* JÁ EXISTE NO MESTRE: ATUALIZAR E VINCULAR */}
                          {isUpdateAndLink && (
                            <div className="space-y-1">
                              <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium">
                                <RefreshCw className="h-3 w-3 shrink-0" />
                                Atualizar Mestre & Vincular
                              </span>
                              {row.fieldChanges.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {row.fieldChanges.map((ch, cIdx) => (
                                    <span
                                      key={cIdx}
                                      className="inline-flex items-center gap-1 bg-blue-100/70 dark:bg-blue-900/40 text-blue-900 dark:text-blue-200 px-1.5 py-0.5 rounded text-[10px]"
                                    >
                                      <strong>{ch.label}:</strong>
                                      <span className="line-through text-muted-foreground">
                                        {ch.oldValue}
                                      </span>
                                      <ArrowRight className="h-2.5 w-2.5" />
                                      <span className="font-semibold">{ch.newValue}</span>
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-[10px] text-muted-foreground block">
                                  Dados idênticos aos cadastrados
                                </span>
                              )}
                            </div>
                          )}

                          {/* JÁ VINCULADA A ESTE CONTRATO: ATUALIZAR VÍNCULO E DADOS */}
                          {isUpdateCurrent && (
                            <div className="space-y-1">
                              <span className="inline-flex items-center gap-1 text-purple-600 dark:text-purple-400 font-medium">
                                <RefreshCw className="h-3 w-3 shrink-0" />
                                Já Vinculada (Atualizar Dados & Rota)
                              </span>
                              {row.fieldChanges.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {row.fieldChanges.map((ch, cIdx) => (
                                    <span
                                      key={cIdx}
                                      className="inline-flex items-center gap-1 bg-purple-100/70 dark:bg-purple-900/40 text-purple-900 dark:text-purple-200 px-1.5 py-0.5 rounded text-[10px]"
                                    >
                                      <strong>{ch.label}:</strong> {ch.newValue}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {/* DUPLICADA NO ARQUIVO */}
                          {isDuplicateFile && (
                            <span className="inline-flex items-center gap-1 text-amber-600">
                              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                              <span title={row.statusReason}>Duplicada na planilha</span>
                            </span>
                          )}

                          {/* ERRO DE DADOS */}
                          {isError && (
                            <span className="inline-flex items-center gap-1 text-destructive font-medium">
                              <XCircle className="h-3.5 w-3.5 shrink-0" />
                              <span>{row.statusReason || 'Linha inválida'}</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {displayRows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-muted-foreground text-xs">
                        Nenhuma linha encontrada neste filtro.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </ScrollArea>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t">
          {importSummary ? (
            <Button
              type="button"
              onClick={() => {
                onOpenChange(false)
                handleReset()
              }}
            >
              Concluir
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onOpenChange(false)
                  handleReset()
                }}
                disabled={isSaving}
              >
                Cancelar
              </Button>
              {parseResult && (
                <Button
                  type="button"
                  onClick={handleConfirmImport}
                  disabled={isSaving || parseResult.processableRows.length === 0}
                  className="bg-primary text-primary-foreground gap-1.5"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Gravando e Vinculando...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Confirmar Importação de {parseResult.processableRows.length} escola(s) para a
                      Rota "{selectedRota}"
                    </>
                  )}
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
