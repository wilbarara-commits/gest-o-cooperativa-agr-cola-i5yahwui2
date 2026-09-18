import React, { useState, useEffect, useMemo } from 'react'
import { useApp } from '@/context/app-context'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  FileCheck,
  Printer,
  Sprout,
  Loader2,
  Check,
  Download,
  Eye,
  FileText,
  AlertCircle,
  Building2,
} from 'lucide-react'
import { toast } from 'sonner'
import pb from '@/lib/pocketbase/client'
import { configuracoesService } from '@/services/configuracoes'
import { atestosService } from '@/services/atestos'
import type { ConfiguracoesRecord, Order, Atesto } from '@/lib/types'
import {
  createOfficialAtestoPdf,
  generateAtestoBlob,
  downloadAtestoPdf,
  formatQuantityBR,
  formatExtendDateBR,
  type AtestoDocumentData,
} from '@/lib/atestoPdfGenerator'

export default function Atestos() {
  const { atestos, orders, contracts, contractSchools, generateAtesto, confirmAtesto, isLoading } =
    useApp()
  const [config, setConfig] = useState<ConfiguracoesRecord | null>(null)
  const [isConfigLoading, setIsConfigLoading] = useState(true)

  // Estados de ações
  const [previewOrderId, setPreviewOrderId] = useState<string | null>(null)
  const [previewAtestoId, setPreviewAtestoId] = useState<string | null>(null)
  const [isEmitting, setIsEmitting] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  // Carregar configurações institucionais
  useEffect(() => {
    configuracoesService
      .get()
      .then((cfg) => {
        setConfig(cfg)
        setIsConfigLoading(false)
      })
      .catch((err) => {
        console.error('Erro ao carregar configurações para atestos:', err)
        setIsConfigLoading(false)
      })
  }, [])

  // Logo URL resolvida
  const logoUrl = useMemo(() => {
    return configuracoesService.getLogoUrl(config)
  }, [config])

  // Pedidos entregues sem atesto emitido (regra de negócio estrita)
  const pendingOrders = useMemo(() => {
    return orders.filter((o) => o.status === 'Entregue' && !atestos.find((a) => a.orderId === o.id))
  }, [orders, atestos])

  // Localizar contrato e número da chamada pública para uma escola
  const getNumeroChamadaForSchool = (schoolId: string): string => {
    // 1. Procurar no vínculo contrato_escolas
    const link = contractSchools.find((cs) => cs.escola_id === schoolId)
    if (link) {
      const contract = contracts.find((c) => c.id === link.contrato_id)
      if (contract?.numero_chamada?.trim()) {
        return contract.numero_chamada.trim()
      }
      if (contract?.numero) {
        return contract.numero
      }
    }
    // 2. Se não encontrar vínculo específico, usar o primeiro contrato ativo
    const activeContract = contracts.find((c) => c.status === 'Ativo')
    if (activeContract?.numero_chamada?.trim()) {
      return activeContract.numero_chamada.trim()
    }
    return activeContract?.numero || '001/2026'
  }

  // Prepara os dados canônicos do documento oficial para um Pedido ou Atesto
  const prepareDocumentData = (
    order: Order,
    atestoNumero?: string,
    dataEmissao?: string,
  ): AtestoDocumentData => {
    const numeroChamada = getNumeroChamadaForSchool(order.schoolId)
    const numeroAtesto = atestoNumero || `AT-${String(atestos.length + 1).padStart(3, '0')}`

    const items =
      order.items && order.items.length > 0
        ? order.items.map((i) => ({
            nome: i.name,
            quantidade: i.quantity,
          }))
        : [
            {
              nome: 'Gêneros alimentícios da agricultura familiar conforme nota de entrega',
              quantidade: 1,
            },
          ]

    return {
      numeroAtesto,
      numeroChamada,
      nomeEscola: order.schoolName || 'Unidade Escolar',
      nomeCooperativa: config?.nome_cooperativa || 'CooperGestão — Cooperativa Agrícola Familiar',
      siglaCooperativa: config?.sigla || 'COOPGESTÃO',
      cidadeUf: config?.cidade_uf || 'Região Serrana - RJ',
      dataEmissao: dataEmissao || new Date(),
      items,
      logoUrl: logoUrl || undefined,
    }
  }

  // 1. Abertura do Modal de Emissão com Preview
  const handleOpenPreview = (orderId: string) => {
    setPreviewOrderId(orderId)
  }

  // 2. Executar Emissão de Atesto: Gera PDF, faz upload para o banco no registro do atesto
  const handleEmitirAtesto = async () => {
    if (!previewOrderId) return
    const order = orders.find((o) => o.id === previewOrderId)
    if (!order) {
      toast.error('Pedido não localizado para emissão.')
      return
    }

    setIsEmitting(true)
    try {
      const nextNum = `AT-${String(atestos.length + 1).padStart(3, '0')}`
      let warnedLogoFailure = false
      const handleLogoError = (err: unknown) => {
        if (!warnedLogoFailure) {
          warnedLogoFailure = true
          console.warn('Falha ao carregar logotipo para o PDF:', err)
          toast.error('Falha ao carregar o logotipo — o PDF será gerado sem o logo.')
        }
      }

      const docData = {
        ...prepareDocumentData(order, nextNum),
        onLogoError: handleLogoError,
      }

      // 1. Gerar PDF oficial como Blob (robusto mesmo se logotipo falhar)
      let pdfBlob: Blob | undefined
      try {
        pdfBlob = await generateAtestoBlob(docData)
      } catch (pdfErr) {
        console.warn('Tentativa com logotipo falhou ao gerar Blob, tentando sem logo:', pdfErr)
        handleLogoError(pdfErr)
        // Fallback garantido: gerar sem logo para não barrar a emissão do atesto oficial
        pdfBlob = await generateAtestoBlob({
          ...docData,
          logoUrl: undefined,
          onLogoError: undefined,
        })
      }

      // 2. Gravar no backend no registro do atesto (com arquivo PDF no campo `arquivo`)
      const createdRecord = await generateAtesto(order.id, pdfBlob, nextNum)

      if (createdRecord) {
        toast.success(
          `Termo de Recebimento (${docData.numeroAtesto}) emitido e gravado com sucesso!`,
        )
        // Disparar download imediato do PDF oficial para conveniência
        try {
          await downloadAtestoPdf(
            docData,
            `Termo_Recebimento_${docData.numeroAtesto}_${order.schoolName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
          )
        } catch (dlErr) {
          console.warn('Download automático em navegador falhou:', dlErr)
          toast.error('O atesto foi gerado, mas houve uma falha ao disparar o download automático.')
        }
        setPreviewOrderId(null)
      }
    } catch (err: any) {
      console.error('Erro ao emitir atesto oficial:', err)
      const detail =
        err?.data?.message ||
        err?.response?.message ||
        err?.message ||
        'Falha ao emitir e armazenar atesto oficial.'
      toast.error(`Falha ao emitir atesto: ${detail}`)
    } finally {
      setIsEmitting(false)
    }
  }

  // 3. Download do PDF de um Atesto já emitido (fluxo resiliente com captura abrangente de erros)
  const handleDownloadExisting = async (atesto: Atesto) => {
    setDownloadingId(atesto.id)
    try {
      // 1. Tentar baixar arquivo PDF já gravado no backend (se houver nome de arquivo gravado)
      if (atesto.arquivo) {
        const fileUrl = atestosService.getFileUrl(
          {
            id: atesto.id,
            collectionName: 'atestos',
            arquivo: atesto.arquivo,
          },
          atesto.arquivo,
        )

        if (fileUrl) {
          let fileDownloadOk = false
          try {
            const resp = await fetch(fileUrl)
            if (resp.ok) {
              const dlBlob = await resp.blob()
              if (dlBlob && dlBlob.size > 0) {
                const objectUrl = window.URL.createObjectURL(dlBlob)
                const safeName = (
                  atesto.arquivo.endsWith('.pdf') ? atesto.arquivo : `${atesto.arquivo}.pdf`
                ).replace(/[/\\?%*:|"<>]/g, '_')
                const a = document.createElement('a')
                a.href = objectUrl
                a.download = safeName
                document.body.appendChild(a)
                a.click()
                document.body.removeChild(a)
                setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000)
                toast.success('Download do PDF armazenado iniciado com sucesso!')
                fileDownloadOk = true
                return
              }
            } else {
              console.warn(`Fetch do arquivo gravado retornou status HTTP ${resp.status}`)
            }
          } catch (fetchErr) {
            console.warn(
              'Fetch do arquivo armazenado falhou (CORS ou rede), prosseguindo para síntese retroativa:',
              fetchErr,
            )
          }

          if (!fileDownloadOk) {
            toast.error(
              'Não foi possível baixar o arquivo gravado. Iniciando regeneração do documento...',
            )
          }
        }
      }

      // 2. Síntese retroativa ou regeneração do PDF oficial
      // Procura o pedido vinculado na lista em memória ou busca no backend
      let relatedOrder = orders.find((o) => o.id === atesto.orderId)

      // Fallback: se não estiver na lista local de pedidos, buscar dados do pedido e itens direto do banco
      if (!relatedOrder && atesto.orderId) {
        try {
          const pedRec = await pb.collection('pedidos').getOne<any>(atesto.orderId, {
            expand: 'escola_id,ciclo_id,rota_id',
          })
          const pedItens = await pb.collection('pedido_itens').getFullList<any>({
            filter: `pedido_id = "${atesto.orderId}"`,
            expand: 'produto_id',
          })

          if (pedRec) {
            relatedOrder = {
              id: pedRec.id,
              numero: pedRec.numero,
              schoolId: pedRec.escola_id,
              schoolName: pedRec.expand?.escola_id?.nome || atesto.schoolName || 'Unidade Escolar',
              cicloId: pedRec.ciclo_id,
              origem: pedRec.origem || 'manual',
              rotaId: pedRec.rota_id,
              validacao: pedRec.validacao,
              date: pedRec.data_prevista || atesto.date,
              status: pedRec.status,
              entregue_em: pedRec.entregue_em,
              total: 0,
              items: pedItens.map((it: any) => ({
                id: it.id,
                productId: it.produto_id,
                name: it.expand?.produto_id?.nome || 'Gêneros Alimentícios',
                quantity: Number(it.quantidade) || 0,
                price: Number(it.preco_unitario) || 0,
              })),
            }
          }
        } catch (fetchPedErr) {
          console.warn('Busca de emergência do pedido falhou:', fetchPedErr)
          toast.error(
            'Não foi possível carregar os dados completos do pedido vinculado. Usando dados do atesto.',
          )
        }
      }

      // Se ainda não encontrou o pedido completo, construir um objeto Order sintético mínimo baseado nos dados do atesto
      const targetOrder: Order = relatedOrder || {
        id: atesto.orderId,
        numero: atesto.orderNumber || atesto.numero,
        schoolId: '',
        schoolName: atesto.schoolName || 'Unidade Escolar',
        origem: 'manual',
        validacao: { status: 'validado', motivo: 'Registro de Atesto' },
        date: atesto.date || new Date().toISOString(),
        status: 'Entregue',
        total: 0,
        items: [
          {
            id: 'fallback-item',
            productId: 'fallback',
            name: 'Gêneros alimentícios da agricultura familiar conforme registro de entrega',
            quantity: 1,
            price: 0,
          },
        ],
      }

      let warnedLogoFailure = false
      const handleLogoError = (err: unknown) => {
        if (!warnedLogoFailure) {
          warnedLogoFailure = true
          console.warn('Falha ao carregar logotipo para o PDF:', err)
          toast.error('Falha ao carregar o logotipo — o PDF será gerado sem o logo.')
        }
      }

      const docData: AtestoDocumentData = {
        ...prepareDocumentData(targetOrder, atesto.numero, atesto.date),
        onLogoError: handleLogoError,
      }

      // 3. Sintetizar PDF com tolerância máxima a falhas de imagem
      let pdfBlob: Blob | null = null
      let generationError: unknown = null

      try {
        pdfBlob = await generateAtestoBlob(docData)
      } catch (genErr) {
        generationError = genErr
        console.warn('Falha na geração com logotipo, tentando sem logo:', genErr)
        handleLogoError(genErr)

        try {
          pdfBlob = await generateAtestoBlob({
            ...docData,
            logoUrl: undefined,
            onLogoError: undefined,
          })
          generationError = null
        } catch (genFallbackErr) {
          generationError = genFallbackErr
          console.error('Falha crítica na síntese do PDF sem logotipo:', genFallbackErr)
        }
      }

      // 4. Se sintetizou o Blob, salvar retroativamente no banco para os próximos downloads
      if (pdfBlob) {
        const safeAtestoNum = (atesto.numero || atesto.id).replace(/[^a-zA-Z0-9_-]/g, '_')
        const retroFilename = `Termo_Recebimento_${safeAtestoNum}.pdf`
        try {
          await atestosService.updatePdf(atesto.id, pdfBlob, retroFilename)
        } catch (upErr) {
          console.warn(
            'Atualização retroativa no PocketBase não concluída (não impede download):',
            upErr,
          )
          toast.error(
            'PDF gerado com sucesso, mas não foi possível salvar a cópia no banco para downloads futuros.',
          )
        }
      }

      // 5. Disparar download para o usuário no navegador
      const safeSchoolName = (atesto.schoolName || 'Escola').replace(/[^a-zA-Z0-9_-]/g, '_')
      const safeNum = (atesto.numero || atesto.id).replace(/[^a-zA-Z0-9_-]/g, '_')
      const downloadFilename = `Termo_Recebimento_${safeNum}_${safeSchoolName}.pdf`

      try {
        await downloadAtestoPdf(docData, downloadFilename)
        toast.success('Termo de Recebimento gerado e baixado com sucesso!')
      } catch (dlErr: any) {
        console.error('Falha ao disparar download do PDF:', dlErr)
        const reason =
          generationError instanceof Error
            ? generationError.message
            : dlErr?.message || 'Falha ao processar o arquivo PDF.'
        toast.error(`Não foi possível regenerar o PDF do atesto: ${reason}`)
      }
    } catch (err: any) {
      console.error('Erro geral no download do atesto:', err)
      const detail = err?.data?.message || err?.message || 'Erro inesperado ao processar o atesto.'
      toast.error(`Falha no download do atesto: ${detail}`)
    } finally {
      setDownloadingId(null)
    }
  }

  // 4. Confirmar Atesto
  const handleConfirm = async (atestoId: string) => {
    setConfirmingId(atestoId)
    const success = await confirmAtesto(atestoId)
    setConfirmingId(null)
    if (success) {
      toast.success('Termo de Recebimento confirmado com sucesso!')
    }
  }

  const handlePrint = () => {
    // Garantir que a impressão dispare após renderização do DOM
    window.print()
  }

  // Ordem selecionada para emissão
  const orderForEmission = useMemo(() => {
    if (!previewOrderId) return null
    return orders.find((o) => o.id === previewOrderId) || null
  }, [previewOrderId, orders])

  // Atesto selecionado para visualização
  const atestoForView = useMemo(() => {
    if (!previewAtestoId) return null
    return atestos.find((a) => a.id === previewAtestoId) || null
  }, [previewAtestoId, atestos])

  const orderForView = useMemo(() => {
    if (!atestoForView) return null
    return orders.find((o) => o.id === atestoForView.orderId) || null
  }, [atestoForView, orders])

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            <span>Emissão de Atestos Oficiais</span>
          </h1>
          <p className="text-muted-foreground text-sm">
            Gere o <strong>Termo de Recebimento de Aquisição de Gêneros Alimentícios</strong> pronto
            para impressão e arquivamento em PDF.
          </p>
        </div>
      </div>

      {/* Bloco: Pedidos Entregues Aguardando Emissão */}
      {pendingOrders.length > 0 ? (
        <Card className="border-emerald-500/30 bg-emerald-50/20 dark:bg-emerald-950/10 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base flex items-center gap-2 text-emerald-800 dark:text-emerald-400">
                <FileCheck className="h-5 w-5 text-emerald-600" /> Pedidos Entregues Aguardando
                Emissão de Atesto
              </CardTitle>
              <Badge
                variant="outline"
                className="text-emerald-700 border-emerald-400 font-semibold"
              >
                {pendingOrders.length} pedido(s) elegível(eis)
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Regra de negócio: Apenas pedidos com status <strong>"Entregue"</strong> e sem atesto
              vinculado são listados aqui. Clique em <strong>"Visualizar e Emitir"</strong> para
              revisar o documento oficial em modelo A4 antes de gravar.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {pendingOrders.map((order) => {
                const totalKg = order.items.reduce((s, it) => s + (Number(it.quantity) || 0), 0)
                const chamada = getNumeroChamadaForSchool(order.schoolId)

                return (
                  <div
                    key={order.id}
                    className="flex flex-col justify-between bg-card p-3.5 rounded-lg border shadow-xs hover:border-emerald-400/50 transition-colors"
                  >
                    <div className="space-y-1.5 mb-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-sm line-clamp-1">{order.schoolName}</p>
                        <Badge className="bg-emerald-600 text-[10px] h-4 shrink-0">Entregue</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Pedido:{' '}
                        <span className="font-semibold text-foreground">
                          {order.numero || order.id}
                        </span>
                        {order.entregue_em && (
                          <span> • {new Date(order.entregue_em).toLocaleDateString('pt-BR')}</span>
                        )}
                      </p>
                      <div className="text-[11px] text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 pt-1 border-t">
                        <span>
                          Chamada Pública: <strong>{chamada}</strong>
                        </span>
                        <span>
                          Total de Itens: <strong>{formatQuantityBR(totalKg)} KG</strong>
                        </span>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      className="w-full bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 text-xs"
                      onClick={() => handleOpenPreview(order.id)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Visualizar e Emitir Atesto
                    </Button>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed bg-muted/20">
          <CardContent className="py-6 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-1.5">
            <Check className="h-5 w-5 text-emerald-600" />
            <span>Nenhum pedido entregue aguardando emissão de atesto no momento.</span>
            <span className="text-[11px]">
              Para emitir um novo atesto, confirme primeiro a entrega do pedido na tela de{' '}
              <strong>Pedidos</strong> ou <strong>Rotas de Entrega</strong>.
            </span>
          </CardContent>
        </Card>
      )}

      {/* Histórico de Atestos Emitidos */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle>Histórico de Termos de Recebimento</CardTitle>
              <CardDescription>
                Relação completa de atestos emitidos, prontos para download do PDF oficial e
                conferência.
              </CardDescription>
            </div>
            <div className="text-xs text-muted-foreground">
              Total emitidos: <strong>{atestos.length}</strong>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº Atesto</TableHead>
                  <TableHead>Ref. Pedido</TableHead>
                  <TableHead>Instituição / Escola</TableHead>
                  <TableHead>Data Emissão</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Arquivo PDF</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading || isConfigLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        Carregando atestos do banco...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : atestos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhum atesto emitido no banco de dados.
                    </TableCell>
                  </TableRow>
                ) : (
                  atestos.map((atesto) => {
                    return (
                      <TableRow key={atesto.id}>
                        <TableCell className="font-semibold text-primary">
                          {atesto.numero || atesto.id}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {atesto.orderNumber || atesto.orderId}
                        </TableCell>
                        <TableCell className="font-medium">{atesto.schoolName}</TableCell>
                        <TableCell className="text-xs">
                          {new Date(atesto.date).toLocaleDateString('pt-BR')}
                        </TableCell>
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
                        <TableCell>
                          {atesto.arquivo ? (
                            <Badge
                              variant="secondary"
                              className="text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-300"
                            >
                              PDF Gravado
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground">
                              Gerado ao Baixar
                            </Badge>
                          )}
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
                                Confirmar
                              </Button>
                            )}

                            {/* Botão Baixar PDF */}
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs gap-1 border-muted-foreground/30 hover:bg-muted"
                              onClick={() => handleDownloadExisting(atesto)}
                              disabled={downloadingId === atesto.id}
                              title="Baixar Termo de Recebimento em PDF"
                            >
                              {downloadingId === atesto.id ? (
                                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                              ) : (
                                <Download className="h-3 w-3 mr-1" />
                              )}
                              Baixar PDF
                            </Button>

                            {/* Botão Visualizar Documento */}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-xs"
                              onClick={() => setPreviewAtestoId(atesto.id)}
                            >
                              <Eye className="h-3.5 w-3.5 mr-1" /> Visualizar
                            </Button>
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

      {/* ========================================================================= */}
      {/* MODAL 1: PREVIEW DO DOCUMENTO ANTES DE EMITIR (COM BOTÃO "EMITIR ATESTO") */}
      {/* ========================================================================= */}
      <Dialog
        open={!!previewOrderId}
        onOpenChange={(open) => {
          if (!open && !isEmitting) setPreviewOrderId(null)
        }}
      >
        <DialogContent className="sm:max-w-[760px] max-h-[92vh] overflow-y-auto p-0">
          <DialogHeader className="p-6 pb-2 border-b">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-lg font-bold flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  <span>Preview do Documento Oficial</span>
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Confira a pré-visualização do modelo oficial A4 antes de confirmar a emissão.
                </DialogDescription>
              </div>
              <Badge variant="outline" className="text-emerald-700 border-emerald-400">
                Pendente Emissão
              </Badge>
            </div>
          </DialogHeader>

          {orderForEmission && (
            <div className="p-6 space-y-4">
              {/* Documento A4 Estilizado */}
              <DocumentoOficialView
                order={orderForEmission}
                config={config}
                logoUrl={logoUrl}
                numeroChamada={getNumeroChamadaForSchool(orderForEmission.schoolId)}
                numeroAtesto={`AT-${String(atestos.length + 1).padStart(3, '0')}`}
                dataEmissao={new Date()}
              />

              {/* Ações do Modal */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPreviewOrderId(null)}
                  disabled={isEmitting}
                >
                  Cancelar
                </Button>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePrint}
                    disabled={isEmitting}
                    className="gap-1.5"
                  >
                    <Printer className="h-4 w-4" /> Imprimir
                  </Button>
                  <Button
                    size="sm"
                    className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 flex-1 sm:flex-none"
                    onClick={handleEmitirAtesto}
                    disabled={isEmitting}
                  >
                    {isEmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Emitindo e Gravando PDF...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4" /> Emitir Atesto & Gravar PDF
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL 2: VISUALIZAÇÃO DE ATESTO JÁ EMITIDO */}
      {/* ========================================================================= */}
      <Dialog
        open={!!previewAtestoId}
        onOpenChange={(open) => {
          if (!open) setPreviewAtestoId(null)
        }}
      >
        <DialogContent className="sm:max-w-[760px] max-h-[92vh] overflow-y-auto p-0">
          <DialogHeader className="p-6 pb-2 border-b">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-lg font-bold flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  <span>Termo de Recebimento Emitido</span>
                </DialogTitle>
                <DialogDescription className="text-xs">
                  {atestoForView?.numero || atestoForView?.id} • Instituição:{' '}
                  {atestoForView?.schoolName}
                </DialogDescription>
              </div>
              <Badge
                variant={atestoForView?.status === 'Confirmado' ? 'default' : 'outline'}
                className={atestoForView?.status === 'Confirmado' ? 'bg-primary' : ''}
              >
                {atestoForView?.status}
              </Badge>
            </div>
          </DialogHeader>

          {atestoForView && (
            <div className="p-6 space-y-4">
              {orderForView ? (
                <DocumentoOficialView
                  order={orderForView}
                  config={config}
                  logoUrl={logoUrl}
                  numeroChamada={getNumeroChamadaForSchool(orderForView.schoolId)}
                  numeroAtesto={atestoForView.numero}
                  dataEmissao={atestoForView.date}
                />
              ) : (
                <div className="p-8 text-center text-sm text-muted-foreground border rounded-lg bg-muted/20">
                  Dados detalhados do pedido indisponíveis para visualização em tela. Utilize o
                  botão "Baixar PDF" para obter o arquivo oficial.
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t">
                <div>
                  {atestoForView.status === 'Pendente Assinatura' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleConfirm(atestoForView.id)}
                      disabled={confirmingId === atestoForView.id}
                      className="border-primary/40 text-primary"
                    >
                      {confirmingId === atestoForView.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      ) : (
                        <Check className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      Confirmar Recebimento
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5">
                    <Printer className="h-4 w-4" /> Imprimir
                  </Button>
                  <Button
                    size="sm"
                    className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
                    onClick={() => handleDownloadExisting(atestoForView)}
                    disabled={downloadingId === atestoForView.id}
                  >
                    {downloadingId === atestoForView.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    Baixar PDF
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

/**
 * Componente que renderiza a visualização fiel da folha A4 oficial:
 * MODELO: "TERMO DE RECEBIMENTO DE AQUISIÇÃO DE GÊNEROS ALIMENTÍCIOS"
 */
interface DocumentoOficialViewProps {
  order: Order
  config: ConfiguracoesRecord | null
  logoUrl?: string
  numeroChamada: string
  numeroAtesto: string
  dataEmissao: Date | string
}

function DocumentoOficialView({
  order,
  config,
  logoUrl,
  numeroChamada,
  numeroAtesto,
  dataEmissao,
}: DocumentoOficialViewProps) {
  const nomeCoop = config?.nome_cooperativa || 'CooperGestão — Cooperativa Agrícola Familiar'
  const cidadeUf = config?.cidade_uf || 'Região Serrana - RJ'
  const nomeEscola = order.schoolName || 'Unidade Escolar'

  const items =
    order.items && order.items.length > 0
      ? order.items
      : [
          {
            name: 'Gêneros alimentícios da agricultura familiar',
            quantity: 1,
            price: 0,
            productId: '1',
          },
        ]

  const totalQuantidade = items.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0)
  const isDense = items.length > 12

  // Linhas tracejadas de preenchimento caso haja poucos itens (conforme modelo oficial)
  const emptyRowsCount = items.length < 6 ? Math.min(2, 6 - items.length) : 0

  return (
    <div
      id="atesto-documento-oficial"
      className={`bg-white text-slate-900 border border-slate-300 shadow-md ${
        isDense ? 'p-6 sm:p-8 space-y-4' : 'p-8 sm:p-10 space-y-5'
      } rounded-sm font-sans max-w-[680px] mx-auto text-sm leading-relaxed print:p-0 print:border-none print:shadow-none print:max-w-none`}
    >
      {/* 1. Cabeçalho com logotipo, nome da cooperativa e título oficial */}
      <div className="text-center space-y-1.5 pb-3 border-b border-slate-300">
        {logoUrl ? (
          <div className="flex justify-center mb-1.5">
            <img
              src={logoUrl}
              alt="Logotipo Cooperativa"
              className={`${isDense ? 'h-11 max-w-[140px]' : 'h-13 max-w-[160px]'} object-contain`}
            />
          </div>
        ) : (
          <div className="flex justify-center mb-1">
            <div className="h-9 w-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-800">
              <Sprout className="h-5 w-5" />
            </div>
          </div>
        )}
        <h2 className="font-bold text-[11px] uppercase tracking-wider text-slate-700">
          {nomeCoop}
        </h2>
        <h1 className="font-extrabold text-xs sm:text-[13px] text-slate-900 tracking-tight leading-snug">
          TERMO DE RECEBIMENTO DE AQUISIÇÃO DE GÊNEROS ALIMENTÍCIOS REFERENTE À CHAMADA PÚBLICA - N°{' '}
          {numeroChamada || 'Nº'}
        </h1>
        {numeroAtesto && (
          <p className="text-xs font-bold text-slate-700 tracking-wide pt-0.5">
            ATESTO Nº {numeroAtesto}
          </p>
        )}
      </div>

      {/* 2. Parágrafo de Atesto */}
      <div className="text-justify text-[12.5px] text-slate-800">
        <p>
          Atesto que a <strong>{nomeEscola}</strong> recebeu os produtos listados abaixo da{' '}
          <strong>{nomeCoop}</strong>.
        </p>
      </div>

      {/* 3. Tabela de Produtos centralizada */}
      <div className="flex justify-center">
        <div className="w-full max-w-[540px] overflow-hidden border border-slate-800 rounded-none shadow-none">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-800 font-bold text-slate-900 text-center">
                <th
                  className={`border-r border-slate-800 ${isDense ? 'py-1 px-2.5' : 'py-1.5 px-3'} text-left`}
                >
                  PRODUTOS
                </th>
                <th className={`${isDense ? 'py-1 px-2.5 w-36' : 'py-1.5 px-3 w-40'} text-center`}>
                  QUANTIDADE (KG)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {items.map((it, idx) => (
                <tr key={idx}>
                  <td
                    className={`border-r border-slate-800 ${
                      isDense ? 'py-0.5 px-2.5 text-[11px]' : 'py-1 px-3 text-xs'
                    } uppercase text-slate-800 font-medium`}
                  >
                    {it.name}
                  </td>
                  <td
                    className={`${
                      isDense ? 'py-0.5 px-2.5 text-[11px]' : 'py-1 px-3 text-xs'
                    } text-center font-bold text-slate-900`}
                  >
                    {formatQuantityBR(it.quantity)}
                  </td>
                </tr>
              ))}
              {Array.from({ length: emptyRowsCount }).map((_, i) => (
                <tr key={`empty-${i}`}>
                  <td
                    className={`border-r border-slate-800 ${
                      isDense ? 'py-0.5 px-2.5 text-[11px]' : 'py-1 px-3 text-xs'
                    } text-center text-slate-400`}
                  >
                    -----
                  </td>
                  <td
                    className={`${
                      isDense ? 'py-0.5 px-2.5 text-[11px]' : 'py-1 px-3 text-xs'
                    } text-center text-slate-400`}
                  >
                    -----
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 border-t-2 border-slate-800 font-bold text-slate-900">
                <td
                  className={`border-r border-slate-800 ${isDense ? 'py-1 px-2.5 text-xs' : 'py-1.5 px-3 text-xs'} text-slate-900`}
                >
                  Total de itens
                </td>
                <td
                  className={`${isDense ? 'py-1 px-2.5 text-xs' : 'py-1.5 px-3 text-xs'} text-center text-slate-900 font-bold`}
                >
                  {formatQuantityBR(totalQuantidade)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* 4. Texto de Declaração */}
      <div
        className={`space-y-1.5 ${isDense ? 'text-[11.5px]' : 'text-[12px]'} text-slate-800 leading-normal text-justify`}
      >
        <p>Nestes termos, os produtos entregues estão de acordo com o contrato assinado.</p>
        <p>
          Declaro ainda que os produtos estão de acordo com os padrões de qualidade aceitos por esta
          instituição, pelos quais concedemos a aceitabilidade, comprometendo-nos a dar a destinação
          final aos produtos recebidos, conforme estabelecido na aquisição da Agricultura Familiar
          para Alimentação Escolar.
        </p>
      </div>

      {/* 5. Bloco de Assinatura ordenado estritamente conforme o modelo oficial */}
      <div className="pt-2 text-center space-y-2">
        {/* a) Data centralizada */}
        <p className={`${isDense ? 'text-xs' : 'text-[12.5px]'} text-slate-900 font-normal`}>
          {formatExtendDateBR(cidadeUf, dataEmissao)}
        </p>

        {/* b) Linha (traço) para assinatura SEM nenhuma identificação abaixo dela */}
        <div className="pt-4 pb-2">
          <div className="mx-auto w-72 sm:w-96 border-t border-slate-800" />
        </div>

        {/* c) Matrícula ou CPF com espaço em branco para preencher */}
        <p className={`${isDense ? 'text-[11px]' : 'text-xs'} text-slate-800 font-normal`}>
          Matrícula ou CPF: ___________________________
        </p>

        {/* d) Identificação do conferente */}
        <p className={`${isDense ? 'text-xs' : 'text-[12.5px]'} font-bold text-slate-900`}>
          Representante da Unidade Escolar (conferente)
        </p>

        {/* e) A ÚLTIMA linha do bloco inferior é o NOME DA ESCOLA */}
        <p
          className={`${isDense ? 'text-xs' : 'text-sm'} font-bold text-slate-900 uppercase tracking-wide`}
        >
          {nomeEscola}
        </p>
      </div>
    </div>
  )
}
