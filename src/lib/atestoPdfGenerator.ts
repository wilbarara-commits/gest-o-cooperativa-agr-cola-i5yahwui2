import jsPDF from 'jspdf'
import autoTable, { applyPlugin } from 'jspdf-autotable'
import type { Order, ConfiguracoesRecord } from '@/lib/types'

// Assegura que o plugin autoTable esteja devidamente acoplado ao protótipo do jsPDF
try {
  if (typeof applyPlugin === 'function') {
    applyPlugin(jsPDF)
  }
} catch {
  // Ignora se já estiver inicializado
}

/**
 * Função segura para chamar o autoTable em qualquer ambiente (Vite dev/build ESM/CJS interop)
 */
function runAutoTable(doc: jsPDF, options: any): void {
  const docAny = doc as any
  if (typeof autoTable === 'function') {
    autoTable(doc, options)
    return
  }
  if ((autoTable as any)?.default && typeof (autoTable as any).default === 'function') {
    ;(autoTable as any).default(doc, options)
    return
  }
  if (typeof docAny.autoTable === 'function') {
    docAny.autoTable(options)
    return
  }
  throw new Error('Falha ao carregar o motor de tabela autoTable do jsPDF')
}

export interface AtestoDocumentData {
  numeroAtesto: string
  numeroChamada: string
  nomeEscola: string
  nomeCooperativa: string
  siglaCooperativa?: string
  cidadeUf: string
  dataEmissao: Date | string
  items: Array<{
    nome: string
    quantidade: number
    unidade?: string
  }>
  logoUrl?: string
  onLogoError?: (err: unknown) => void
}

/**
 * Converte número com formatação brasileira (vírgula decimal)
 */
export function formatQuantityBR(val: number): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: Number.isInteger(val) ? 0 : 2,
    maximumFractionDigits: 3,
  }).format(val || 0)
}

/**
 * Formata data por extenso no padrão: "Nova Friburgo - RJ, 13 de setembro de 2026."
 */
export function formatExtendDateBR(cidadeUf: string, dateInput?: Date | string): string {
  const d = dateInput ? new Date(dateInput) : new Date()
  const validDate = isNaN(d.getTime()) ? new Date() : d

  const day = validDate.getDate()
  const months = [
    'janeiro',
    'fevereiro',
    'março',
    'abril',
    'maio',
    'junho',
    'julho',
    'agosto',
    'setembro',
    'outubro',
    'novembro',
    'dezembro',
  ]
  const monthName = months[validDate.getMonth()]
  const year = validDate.getFullYear()

  const cidade = cidadeUf?.trim() || 'Município'
  return `${cidade}, ${day} de ${monthName} de ${year}.`
}

/**
 * Carrega imagem de uma URL como dataURL (base64) e determina suas dimensões e formato (PNG / JPEG)
 */
interface LoadedImageInfo {
  dataUrl: string
  format: 'PNG' | 'JPEG' | 'WEBP'
  aspectRatio: number // width / height
}

async function loadImageDataUrl(url: string): Promise<LoadedImageInfo | null> {
  if (!url || typeof window === 'undefined') return null
  try {
    // 1. Tentar primeiro fetch com timeout rápido (2,5s) para pegar Blob diretamente e evitar problemas de canvas tainted por CORS
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
    const fetchTimer = controller ? setTimeout(() => controller.abort(), 2500) : null

    try {
      const res = await fetch(url, { signal: controller?.signal })
      if (fetchTimer) clearTimeout(fetchTimer)
      if (res.ok) {
        const blob = await res.blob()
        const mimeType = blob.type.toLowerCase()
        let format: 'PNG' | 'JPEG' | 'WEBP' = 'PNG'
        if (mimeType.includes('jpeg') || mimeType.includes('jpg')) {
          format = 'JPEG'
        } else if (mimeType.includes('webp')) {
          format = 'WEBP'
        }

        const dataUrl = await new Promise<string | null>((resolve) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result as string)
          reader.onerror = () => resolve(null)
          reader.readAsDataURL(blob)
        })

        if (dataUrl) {
          const aspectRatio = await new Promise<number>((resolve) => {
            const probeImg = new window.Image()
            const timer = setTimeout(() => resolve(1.4), 1500)
            probeImg.onload = () => {
              clearTimeout(timer)
              if (probeImg.naturalWidth && probeImg.naturalHeight) {
                resolve(probeImg.naturalWidth / probeImg.naturalHeight)
              } else {
                resolve(1.4)
              }
            }
            probeImg.onerror = () => {
              clearTimeout(timer)
              resolve(1.4)
            }
            probeImg.src = dataUrl
          })

          return { dataUrl, format, aspectRatio }
        }
      }
    } catch (fetchErr) {
      if (fetchTimer) clearTimeout(fetchTimer)
      console.warn('Fetch do logo falhou ou deu timeout, tentando via Image():', fetchErr)
    }

    // 2. Fallback: carregar imagem em HTMLImageElement com timeout
    const img = new window.Image()
    img.crossOrigin = 'anonymous'

    const loaded = await new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => {
        img.onload = null
        img.onerror = null
        resolve(false)
      }, 2000)

      img.onload = () => {
        clearTimeout(timer)
        resolve(true)
      }
      img.onerror = () => {
        clearTimeout(timer)
        resolve(false)
      }
      img.src = url
    })

    if (loaded && img.naturalWidth && img.naturalHeight) {
      const naturalWidth = img.naturalWidth
      const naturalHeight = img.naturalHeight
      const aspectRatio = naturalWidth / naturalHeight

      try {
        const canvas = document.createElement('canvas')
        canvas.width = naturalWidth
        canvas.height = naturalHeight
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(img, 0, 0)
          const pngDataUrl = canvas.toDataURL('image/png')
          if (pngDataUrl && pngDataUrl.startsWith('data:image/png')) {
            return {
              dataUrl: pngDataUrl,
              format: 'PNG',
              aspectRatio: aspectRatio > 0 ? aspectRatio : 1.4,
            }
          }
        }
      } catch (canvasErr) {
        console.warn('Canvas toDataURL falhou:', canvasErr)
      }
    }

    return null
  } catch (err) {
    console.warn('Falha ao carregar logotipo para o PDF (prosseguindo sem logo):', err)
    return null
  }
}

/**
 * Constrói o documento oficial jsPDF de Termo de Recebimento (modelo A4 de 1 página)
 */
export async function createOfficialAtestoPdf(data: AtestoDocumentData): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = doc.internal.pageSize.getWidth() // 210mm
  const marginX = 20
  const contentWidth = pageWidth - marginX * 2 // 170mm

  // 1. CABEÇALHO COM LOGOTIPO OU SÍMBOLO
  let startY = 14

  if (data.logoUrl) {
    try {
      const imgInfo = await loadImageDataUrl(data.logoUrl)
      if (imgInfo) {
        // Logotipo no topo centralizado preservando a proporção de aspecto (máximo 45mm x 22mm)
        const maxW = 45
        const maxH = 22
        let imgWidth = maxW
        let imgHeight = imgWidth / imgInfo.aspectRatio

        if (imgHeight > maxH) {
          imgHeight = maxH
          imgWidth = imgHeight * imgInfo.aspectRatio
        }

        doc.addImage(
          imgInfo.dataUrl,
          imgInfo.format,
          (pageWidth - imgWidth) / 2,
          startY,
          imgWidth,
          imgHeight,
          undefined,
          'FAST',
        )
        startY += imgHeight + 4
      } else {
        // Notifica falha no carregamento do logo se callback estiver configurado
        data.onLogoError?.(new Error('Logotipo inacessível ou formato inválido'))
      }
    } catch (e) {
      // continua sem imagem sem travar a geração (degradante, não bloqueante)
      console.warn('Não foi possível embutir o logotipo no PDF:', e)
      data.onLogoError?.(e)
    }
  }

  // Nome da Cooperativa em destaque no topo
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(30, 41, 59)
  const coopLabel = (data.nomeCooperativa || 'CooperGestão').toUpperCase()
  doc.text(coopLabel, pageWidth / 2, startY, { align: 'center' })
  startY += 6

  // Título do documento oficial
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(15, 23, 42)
  const chamadaNum = data.numeroChamada?.trim() || 'Nº'
  const docTitle = `TERMO DE RECEBIMENTO DE AQUISIÇÃO DE GÊNEROS ALIMENTÍCIOS REFERENTE À CHAMADA PÚBLICA-N° ${chamadaNum}`

  const splitTitle = doc.splitTextToSize(docTitle, contentWidth)
  doc.text(splitTitle, pageWidth / 2, startY, { align: 'center' })
  startY += splitTitle.length * 5.2 + 6

  // Linha sutil separadora
  doc.setDrawColor(203, 213, 225)
  doc.setLineWidth(0.4)
  doc.line(marginX, startY, pageWidth - marginX, startY)
  startY += 7

  // Número do Atesto (referência)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(100, 116, 139)
  doc.text(`Identificador do Atesto: ${data.numeroAtesto}`, pageWidth - marginX, startY - 2, {
    align: 'right',
  })

  // 2. PARÁGRAFO DE ATESTO
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10.5)
  doc.setTextColor(30, 41, 59)

  const nomeEscola = data.nomeEscola || 'Unidade Escolar'
  const nomeCoop = data.nomeCooperativa || 'Cooperativa'
  const atestoParagraph = `Atesto que a ${nomeEscola} recebeu os produtos listados abaixo da ${nomeCoop}.`

  const splitAtesto = doc.splitTextToSize(atestoParagraph, contentWidth)
  doc.text(splitAtesto, marginX, startY)
  startY += splitAtesto.length * 5 + 4

  // 3. TABELA DE PRODUTOS
  // Uma linha por produto com PRODUTOS e QUANTIDADE (KG)
  const totalQuantidade = data.items.reduce((sum, item) => sum + (Number(item.quantidade) || 0), 0)

  const head = [['PRODUTOS', 'QUANTIDADE (KG)']]
  const body = data.items.map((item) => [
    item.nome.toUpperCase(),
    formatQuantityBR(item.quantidade),
  ])

  const foot = [['Total de itens', formatQuantityBR(totalQuantidade)]]

  runAutoTable(doc, {
    startY: startY,
    head: head,
    body: body,
    foot: foot,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 9,
      cellPadding: 2.8,
      textColor: [30, 41, 59],
      lineColor: [100, 116, 139],
      lineWidth: 0.25,
    },
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      halign: 'left',
      lineWidth: 0.25,
      lineColor: [100, 116, 139],
    },
    columnStyles: {
      0: { halign: 'left', cellWidth: 125 },
      1: { halign: 'center', cellWidth: 45, fontStyle: 'bold' },
    },
    footStyles: {
      fillColor: [248, 250, 252],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      halign: 'left',
      lineWidth: 0.35,
      lineColor: [100, 116, 139],
    },
    margin: { left: marginX, right: marginX },
  })

  // Coordenada Y após a tabela
  const finalY = (doc as any).lastAutoTable?.finalY || startY + 40
  let textY = finalY + 8

  // 4. TEXTO DE DECLARAÇÃO
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(30, 41, 59)

  const declaracao1 =
    'Nestes termos, os produtos entregues estão de acordo com o contrato assinado.'
  doc.text(declaracao1, marginX, textY)
  textY += 6

  const declaracao2 =
    'Declaro ainda que os produtos estão de acordo com os padrões de qualidade aceitos por esta instituição, pelos quais concedemos a aceitabilidade, comprometendo-nos a dar a destinação final aos produtos recebidos, conforme estabelecido na aquisição da Agricultura Familiar para Alimentação Escolar.'

  const splitDecl2 = doc.splitTextToSize(declaracao2, contentWidth)
  doc.text(splitDecl2, marginX, textY, { align: 'justify', maxWidth: contentWidth })
  textY += splitDecl2.length * 4.8 + 10

  // 5. LOCAL E DATA (CENTRALIZADO)
  const localDataStr = formatExtendDateBR(data.cidadeUf, data.dataEmissao)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.text(localDataStr, pageWidth / 2, textY, { align: 'center' })
  textY += 14

  // 6. IDENTIFICAÇÃO DO PRODUTOR / CONFERENTE (Matrícula ou CPT / CPF ACIMA da linha de assinatura)
  const sigX = pageWidth / 2
  const sigLineWidth = 110

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.text('Representante da Unidade Escolar (conferente)', sigX, textY, { align: 'center' })
  textY += 4.5

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(nomeEscola, sigX, textY, { align: 'center' })
  textY += 5

  // Matrícula ou CPT/CPF fica ACIMA da linha de assinatura
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('Matrícula ou CPT: ___________________________', sigX, textY, { align: 'center' })
  textY += 14

  // Linha de assinatura
  doc.setDrawColor(30, 41, 59)
  doc.setLineWidth(0.4)
  doc.line(sigX - sigLineWidth / 2, textY, sigX + sigLineWidth / 2, textY)
  textY += 4

  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8)
  doc.setTextColor(100, 116, 139)
  doc.text('Assinatura do Recebedor', sigX, textY, { align: 'center' })

  return doc
}

/**
 * Gera o arquivo PDF e o retorna como Blob para salvar no backend
 */
export async function generateAtestoBlob(data: AtestoDocumentData): Promise<Blob> {
  const doc = await createOfficialAtestoPdf(data)
  return doc.output('blob')
}

/**
 * Gera e dispara o download imediato no navegador
 */
export async function downloadAtestoPdf(
  data: AtestoDocumentData,
  filename?: string,
): Promise<void> {
  let doc: jsPDF
  try {
    doc = await createOfficialAtestoPdf(data)
  } catch (err) {
    console.warn('Falha na criação do PDF com logotipo, gerando versão sem logotipo:', err)
    // Fallback garantido sem logo caso ocorra algum problema de renderização
    doc = await createOfficialAtestoPdf({ ...data, logoUrl: undefined })
  }

  const rawName = filename || `Termo_Recebimento_${data.numeroAtesto || 'Atesto'}.pdf`
  const sanitizedName = rawName.replace(/[/\\?%*:|"<>]/g, '_')
  const finalFilename = sanitizedName.endsWith('.pdf') ? sanitizedName : `${sanitizedName}.pdf`

  try {
    doc.save(finalFilename)
  } catch (saveErr) {
    console.warn('doc.save() falhou, tentando fallback via Blob URL:', saveErr)
    const blob = doc.output('blob')
    const blobUrl = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = blobUrl
    link.download = finalFilename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000)
  }
}
