import { useState, useRef, useId } from 'react'
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
  Settings2,
} from 'lucide-react'
import { toast } from 'sonner'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import {
  parseSchoolsFile,
  type CsvParseResult,
  type ParsedCsvSchoolRow,
  type ExistingSchoolData,
} from '@/lib/schoolCsvImporter'
import { escolasService } from '@/services/escolas'
import type { School } from '@/lib/types'

interface SchoolImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  schools: School[]
  onSuccess: () => Promise<void>
}

export function SchoolImportDialog({
  open,
  onOpenChange,
  schools,
  onSuccess,
}: SchoolImportDialogProps) {
  const fileInputId = useId()
  const [file, setFile] = useState<File | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveProgress, setSaveProgress] = useState(0)
  const [parseResult, setParseResult] = useState<CsvParseResult | null>(null)
  const [filterTab, setFilterTab] = useState<
    'all' | 'valid' | 'update' | 'duplicate_file' | 'error'
  >('all')
  const [conflictMode, setConflictMode] = useState<'merge' | 'overwrite'>('merge')
  const [importSummary, setImportSummary] = useState<{
    created: number
    updated: number
    duplicatesIgnored: number
    errors: number
  } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile)
    setImportSummary(null)
    setIsParsing(true)
    try {
      const existing: ExistingSchoolData[] = schools.map((s) => ({
        id: s.id,
        nome: s.name,
        tipo: s.tipo,
        rota: s.route,
        alunos: s.alunos,
        endereco: s.address,
        telefone: s.contact,
        email: s.email,
      }))
      const result = await parseSchoolsFile(selectedFile, existing)
      setParseResult(result)

      const totalProcessable = result.validRows.length + result.updateRows.length
      if (totalProcessable > 0) {
        toast.info(
          `${result.validRows.length} nova(s) e ${result.updateRows.length} existente(s) para atualizar.`,
        )
      } else {
        toast.warning(
          'Nenhuma escola elegível detectada. Verifique se as linhas contêm dados válidos.',
        )
      }
    } catch (err: any) {
      console.error('Erro ao analisar arquivo:', err)
      toast.error(err.message || 'Erro ao processar o arquivo.')
      setParseResult(null)
    } finally {
      setIsParsing(false)
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0])
    }
  }

  const handleReset = () => {
    setFile(null)
    setParseResult(null)
    setImportSummary(null)
    setSaveProgress(0)
    setConflictMode('merge')
    setFilterTab('all')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleConfirmImport = async () => {
    if (!parseResult) return
    const processableRows = parseResult.allRows.filter(
      (r) => r.status === 'valid' || r.status === 'update',
    )
    if (processableRows.length === 0) return

    setIsSaving(true)
    setSaveProgress(0)

    try {
      const payload = processableRows.map((r) => ({
        action: r.status === 'update' ? ('update' as const) : ('create' as const),
        id: r.existingSchoolId,
        nome: r.nome,
        tipo: r.tipo,
        rota: r.rota,
        alunos: r.alunos,
        endereco: r.endereco,
        telefone: r.telefone,
        email: r.email,
        presentColumns: r.presentColumns,
      }))

      const { created, updated, errors } = await escolasService.importBatch(
        payload,
        conflictMode,
        (processed, total) => {
          setSaveProgress(Math.round((processed / total) * 100))
        },
      )

      const totalDuplicates = parseResult.duplicateFileCount
      const totalErrors = errors.length + parseResult.errorCount

      setImportSummary({
        created,
        updated,
        duplicatesIgnored: totalDuplicates,
        errors: totalErrors,
      })

      const totalSuccess = created + updated
      if (totalSuccess > 0) {
        toast.success(
          `Importação concluída: ${created} criada(s), ${updated} atualizada(s) no cadastro mestre!`,
        )
        await onSuccess()
      } else {
        toast.error('Nenhuma escola pôde ser gravada ou atualizada.')
      }
    } catch (err: any) {
      console.error('Erro durante a gravação/atualização em lote:', err)
      toast.error('Ocorreu um erro ao gravar as alterações no banco.')
    } finally {
      setIsSaving(false)
    }
  }

  // Total de itens a processar (novas + atualizações)
  const processableCount =
    (parseResult?.validRows.length || 0) + (parseResult?.updateRows.length || 0)

  // Filtragem dos itens no preview
  const displayRows =
    parseResult?.allRows.filter((row) => {
      if (filterTab === 'valid') return row.status === 'valid'
      if (filterTab === 'update') return row.status === 'update'
      if (filterTab === 'duplicate_file') return row.status === 'duplicate_file'
      if (filterTab === 'error') return row.status === 'error'
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
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Importar Escolas via CSV / Planilha
          </DialogTitle>
          <DialogDescription>
            Faça upload de uma planilha (.csv ou .xlsx) com as colunas{' '}
            <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">
              nome, tipo, rota, alunos
            </code>
            . As escolas serão adicionadas ao cadastro mestre global com prevenção de duplicidades.
          </DialogDescription>
        </DialogHeader>

        {/* ÁREA DE UPLOAD */}
        {!parseResult && !importSummary && (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/60 transition-colors flex flex-col items-center justify-center gap-4 my-2"
          >
            <div className="p-4 bg-primary/10 text-primary rounded-full">
              {isParsing ? (
                <Loader2 className="h-8 w-8 animate-spin" />
              ) : (
                <Upload className="h-8 w-8" />
              )}
            </div>

            <div className="space-y-1">
              <p className="font-medium text-base">
                {isParsing
                  ? 'Analisando arquivo e checando duplicidades...'
                  : 'Arraste seu arquivo CSV ou Excel aqui'}
              </p>
              <p className="text-xs text-muted-foreground">
                Formatos aceitos: <strong>.csv</strong> (vírgula ou ponto-e-vírgula, UTF-8) e{' '}
                <strong>.xlsx</strong>
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
              disabled={isParsing}
            />

            <Button
              type="button"
              variant="outline"
              disabled={isParsing}
              onClick={() => fileInputRef.current?.click()}
            >
              Selecionar Arquivo do Computador
            </Button>
          </div>
        )}

        {/* RESUMO PÓS-IMPORTAÇÃO (SUCESSO) */}
        {importSummary && (
          <div className="p-6 bg-muted/40 rounded-xl space-y-4 my-2 border border-border">
            <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-7 w-7 shrink-0" />
              <div>
                <h3 className="font-semibold text-lg">Processamento Concluído</h3>
                <p className="text-sm text-muted-foreground">
                  O cadastro mestre de escolas foi processado com sucesso.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="bg-card p-3 rounded-lg border border-border">
                <span className="text-xs text-muted-foreground">Novas Criadas</span>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {importSummary.created}
                </p>
              </div>
              <div className="bg-card p-3 rounded-lg border border-border">
                <span className="text-xs text-muted-foreground">Atualizadas (Upsert)</span>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {importSummary.updated}
                </p>
              </div>
              <div className="bg-card p-3 rounded-lg border border-border">
                <span className="text-xs text-muted-foreground">Duplicadas no Arquivo</span>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {importSummary.duplicatesIgnored}
                </p>
              </div>
              <div className="bg-card p-3 rounded-lg border border-border">
                <span className="text-xs text-muted-foreground">Linhas com Erro</span>
                <p className="text-2xl font-bold text-destructive">{importSummary.errors}</p>
              </div>
            </div>
          </div>
        )}

        {/* PREVIEW DA IMPORTAÇÃO */}
        {parseResult && !importSummary && (
          <div className="flex-1 min-h-0 flex flex-col space-y-3">
            {/* Opção de resolução de conflito para escolas existentes */}
            {parseResult.updateRows.length > 0 && (
              <div className="p-3 bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 rounded-lg space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-blue-900 dark:text-blue-300">
                  <Settings2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span>
                    Regra de Atualização para {parseResult.updateRows.length} escola(s) já
                    existente(s):
                  </span>
                </div>
                <RadioGroup
                  value={conflictMode}
                  onValueChange={(val) => setConflictMode(val as 'merge' | 'overwrite')}
                  className="space-y-1.5 text-xs"
                >
                  <div className="flex items-start gap-2 cursor-pointer">
                    <RadioGroupItem value="merge" id="mode-merge" className="mt-0.5" />
                    <Label
                      htmlFor="mode-merge"
                      className="font-normal cursor-pointer leading-tight"
                    >
                      <strong className="text-foreground font-medium">
                        Atualizar campos preenchidos no arquivo
                      </strong>{' '}
                      <span className="text-muted-foreground">
                        (recomendado: mantém os valores já salvos quando a coluna estiver vazia no
                        arquivo)
                      </span>
                    </Label>
                  </div>
                  <div className="flex items-start gap-2 cursor-pointer">
                    <RadioGroupItem value="overwrite" id="mode-overwrite" className="mt-0.5" />
                    <Label
                      htmlFor="mode-overwrite"
                      className="font-normal cursor-pointer leading-tight"
                    >
                      <strong className="text-foreground font-medium">
                        Sobrescrever todos os campos com os valores do arquivo
                      </strong>{' '}
                      <span className="text-muted-foreground">
                        (limpa dados existentes se o campo vier vazio na coluna correspondente)
                      </span>
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            )}

            {/* Header com métricas e filtros */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-muted/50 rounded-lg text-xs">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-primary" />
                <span className="font-medium truncate max-w-[200px]">{parseResult.fileName}</span>
                <Badge variant="outline" className="text-[11px]">
                  {parseResult.totalRows} linhas
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
                  variant={filterTab === 'valid' ? 'default' : 'ghost'}
                  className="h-7 text-xs px-2.5 text-emerald-600 dark:text-emerald-400"
                  onClick={() => setFilterTab('valid')}
                >
                  <Check className="h-3 w-3 mr-1" />
                  Novas ({parseResult.validRows.length})
                </Button>
                <Button
                  size="sm"
                  variant={filterTab === 'update' ? 'default' : 'ghost'}
                  className="h-7 text-xs px-2.5 text-blue-600 dark:text-blue-400"
                  onClick={() => setFilterTab('update')}
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Atualizações ({parseResult.updateRows.length})
                </Button>
                {parseResult.duplicateFileCount > 0 && (
                  <Button
                    size="sm"
                    variant={filterTab === 'duplicate_file' ? 'default' : 'ghost'}
                    className="h-7 text-xs px-2.5 text-amber-600 dark:text-amber-400"
                    onClick={() => setFilterTab('duplicate_file')}
                  >
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Duplicadas no arquivo ({parseResult.duplicateFileCount})
                  </Button>
                )}
                {parseResult.errorCount > 0 && (
                  <Button
                    size="sm"
                    variant={filterTab === 'error' ? 'default' : 'ghost'}
                    className="h-7 text-xs px-2.5 text-destructive"
                    onClick={() => setFilterTab('error')}
                  >
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Erros ({parseResult.errorCount})
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs px-2 text-muted-foreground ml-1"
                  onClick={handleReset}
                  title="Trocar arquivo"
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
                    Gravando e atualizando escolas no banco de dados...
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
                    <th className="py-2 px-3">Tipo Normalizado</th>
                    <th className="py-2 px-3">Rota</th>
                    <th className="py-2 px-3">Alunos</th>
                    <th className="py-2 px-3">Ação / Alterações Previstas</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {displayRows.map((row: ParsedCsvSchoolRow) => {
                    const isError = row.status === 'error'
                    const isDuplicateFile = row.status === 'duplicate_file'
                    const isValid = row.status === 'valid'
                    const isUpdate = row.status === 'update'

                    return (
                      <tr
                        key={row.index}
                        className={
                          isError
                            ? 'bg-destructive/10'
                            : isDuplicateFile
                              ? 'bg-amber-500/10'
                              : isUpdate
                                ? 'bg-blue-500/5 hover:bg-blue-500/10'
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
                          {isUpdate &&
                            row.existingSchoolName &&
                            row.existingSchoolName !== row.nome && (
                              <span className="text-[10px] text-muted-foreground block">
                                Mestre: "{row.existingSchoolName}"
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
                          {row.rawTipo && row.rawTipo !== row.tipo && (
                            <span className="text-[10px] text-muted-foreground block">
                              de: {row.rawTipo}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3">{row.rota}</td>
                        <td className="py-2 px-3 font-mono">
                          {row.alunos !== undefined ? (
                            row.alunos
                          ) : row.rawAlunos ? (
                            <span className="text-amber-500">{row.rawAlunos} (inválido)</span>
                          ) : (
                            <span className="text-muted-foreground italic">-</span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          {isValid && (
                            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Nova (Criar)
                            </span>
                          )}

                          {isUpdate && (
                            <div className="space-y-1">
                              <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium">
                                <RefreshCw className="h-3 w-3 shrink-0" />
                                Atualizar Existente
                              </span>
                              {row.fieldChanges && row.fieldChanges.length > 0 ? (
                                <div className="flex flex-wrap gap-1 pt-0.5">
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
                                      <span className="font-semibold text-blue-700 dark:text-blue-300">
                                        {ch.newValue}
                                      </span>
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

                          {isDuplicateFile && (
                            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate max-w-[200px]" title={row.statusReason}>
                                Duplicada na planilha
                              </span>
                            </span>
                          )}

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
                  disabled={isSaving || processableCount === 0}
                  className="bg-primary text-primary-foreground gap-1.5"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Gravando e Atualizando...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Confirmar ({parseResult.validRows.length} nova(s) +{' '}
                      {parseResult.updateRows.length} atualização(ões))
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
