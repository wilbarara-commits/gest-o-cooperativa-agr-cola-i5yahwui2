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
  Filter,
  Check,
  RefreshCw,
  PackageCheck,
  AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  parseProductsFile,
  type ProductCsvParseResult,
  type ParsedCsvProductRow,
} from '@/lib/productCsvImporter'
import { produtosService } from '@/services/produtos'
import type { Product } from '@/lib/types'

interface ProductImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  products: Product[]
  onSuccess: () => Promise<void>
}

export function ProductImportDialog({
  open,
  onOpenChange,
  products,
  onSuccess,
}: ProductImportDialogProps) {
  const fileInputId = useId()
  const [file, setFile] = useState<File | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveProgress, setSaveProgress] = useState(0)
  const [parseResult, setParseResult] = useState<ProductCsvParseResult | null>(null)
  const [filterTab, setFilterTab] = useState<'all' | 'valid' | 'duplicate' | 'error'>('all')
  const [importSummary, setImportSummary] = useState<{
    created: number
    duplicatesIgnored: number
    errors: number
  } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile)
    setImportSummary(null)
    setIsParsing(true)
    try {
      const existing = products.map((p) => ({ id: p.id, name: p.name }))
      const result = await parseProductsFile(selectedFile, existing)
      setParseResult(result)
      if (result.validRows.length > 0) {
        toast.info(`${result.validRows.length} novo(s) produto(s) detectado(s) para importação.`)
      } else {
        toast.warning(
          'Nenhum produto novo detectado. Todas as linhas já existem no cadastro ou contêm erros.',
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
    setFilterTab('all')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleConfirmImport = async () => {
    if (!parseResult || parseResult.validRows.length === 0) return

    setIsSaving(true)
    setSaveProgress(0)

    try {
      const payload = parseResult.validRows.map((r) => ({
        nome: r.nome,
        categoria: (r.categoria || 'Outros') as any,
        unidade: r.unidade || 'Kg',
        estoque: r.estoque,
        preco_unitario: r.preco_unitario,
        disponibilidade: r.disponibilidade,
      }))

      const { created, errors } = await produtosService.createBatch(payload, (processed, total) => {
        setSaveProgress(Math.round((processed / total) * 100))
      })

      const totalDuplicates = parseResult.duplicateMasterCount + parseResult.duplicateFileCount
      const totalErrors = errors.length + parseResult.errorCount

      setImportSummary({
        created,
        duplicatesIgnored: totalDuplicates,
        errors: totalErrors,
      })

      if (created > 0) {
        toast.success(
          `Importação concluída: ${created} produto(s) cadastrado(s) com sucesso no catálogo!`,
        )
        await onSuccess()
      } else {
        toast.error('Nenhum produto pôde ser gravado.')
      }
    } catch (err: any) {
      console.error('Erro durante a gravação em lote de produtos:', err)
      toast.error('Ocorreu um erro ao gravar os produtos no banco.')
    } finally {
      setIsSaving(false)
    }
  }

  // Filtragem dos itens no preview
  const displayRows =
    parseResult?.allRows.filter((row) => {
      if (filterTab === 'valid') return row.status === 'valid'
      if (filterTab === 'duplicate') {
        return row.status === 'duplicate_master' || row.status === 'duplicate_file'
      }
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
            Importar Produtos via CSV / Planilha
          </DialogTitle>
          <DialogDescription>
            Faça upload de uma planilha (.csv ou .xlsx) contendo as colunas{' '}
            <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">
              nome, categoria, unidade, estoque, preco_unitario, disponibilidade
            </code>
            . Os produtos serão cadastrados no banco de dados com prevenção contra duplicidades.
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
                  O catálogo de produtos foi atualizado com sucesso no banco de dados.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="bg-card p-3 rounded-lg border border-border">
                <span className="text-xs text-muted-foreground">Criados com Sucesso</span>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {importSummary.created}
                </p>
              </div>
              <div className="bg-card p-3 rounded-lg border border-border">
                <span className="text-xs text-muted-foreground">Ignorados (Duplicados)</span>
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
            {/* Header com métricas e filtros */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-muted/50 rounded-lg text-xs">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-primary" />
                <span className="font-medium truncate max-w-[220px]">{parseResult.fileName}</span>
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
                  A Importar ({parseResult.validRows.length})
                </Button>
                <Button
                  size="sm"
                  variant={filterTab === 'duplicate' ? 'default' : 'ghost'}
                  className="h-7 text-xs px-2.5 text-amber-600 dark:text-amber-400"
                  onClick={() => setFilterTab('duplicate')}
                >
                  <Filter className="h-3 w-3 mr-1" />
                  Duplicados ({parseResult.duplicateMasterCount + parseResult.duplicateFileCount})
                </Button>
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
                    Gravando produtos no banco de dados...
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
                    <th className="py-2 px-3">Produto</th>
                    <th className="py-2 px-3">Categoria</th>
                    <th className="py-2 px-3">Unidade</th>
                    <th className="py-2 px-3 text-right">Estoque</th>
                    <th className="py-2 px-3 text-right">Preço</th>
                    <th className="py-2 px-3">Disponibilidade</th>
                    <th className="py-2 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {displayRows.map((row: ParsedCsvProductRow) => {
                    const isError = row.status === 'error'
                    const isDuplicate =
                      row.status === 'duplicate_master' || row.status === 'duplicate_file'
                    const isValid = row.status === 'valid'

                    const dispBadge =
                      row.disponibilidade === 'abundancia' ? (
                        <Badge className="bg-emerald-600 hover:bg-emerald-700 text-[10px]">
                          Abundância
                        </Badge>
                      ) : row.disponibilidade === 'escassez' ? (
                        <Badge className="bg-amber-600 hover:bg-amber-700 text-[10px]">
                          Escassez
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">
                          Normal
                        </Badge>
                      )

                    return (
                      <tr
                        key={row.index}
                        className={
                          isError
                            ? 'bg-destructive/10'
                            : isDuplicate
                              ? 'bg-amber-500/10'
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
                          {row.warnings.length > 0 && (
                            <div className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-0.5">
                              <AlertTriangle className="h-3 w-3 shrink-0" />
                              <span>{row.warnings.join(' ')}</span>
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          <Badge variant="secondary" className="text-[10px] font-normal">
                            {row.categoria || 'Outros'}
                          </Badge>
                        </td>
                        <td className="py-2 px-3">{row.unidade}</td>
                        <td className="py-2 px-3 text-right font-mono">{row.estoque}</td>
                        <td className="py-2 px-3 text-right font-mono font-medium">
                          R${' '}
                          {row.preco_unitario.toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className="py-2 px-3">{dispBadge}</td>
                        <td className="py-2 px-3">
                          {isValid && (
                            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                              Pronto para gravar
                            </span>
                          )}
                          {row.status === 'duplicate_master' && (
                            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate max-w-[180px]" title={row.statusReason}>
                                Já cadastrado
                              </span>
                            </span>
                          )}
                          {row.status === 'duplicate_file' && (
                            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate max-w-[180px]" title={row.statusReason}>
                                Duplicado na planilha
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
                      <td colSpan={8} className="py-8 text-center text-muted-foreground text-xs">
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
                  disabled={isSaving || parseResult.validRows.length === 0}
                  className="bg-primary text-primary-foreground"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Gravando...
                    </>
                  ) : (
                    `Confirmar e Gravar ${parseResult.validRows.length} Produto(s)`
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
