import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Order, ConfiguracoesRecord } from '@/lib/types'

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
 * Carrega imagem de uma URL como base64 ou HTMLImageElement para uso no jsPDF
 */
async function loadImageDataUrl(url: string): Promise<string | null> {
  if (!url) return null
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
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
  let startY = 16

  if (data.logoUrl) {
    try {
      const dataUrl = await loadImageDataUrl(data.logoUrl)
      if (dataUrl) {
        // Logotipo no topo centralizado
        const imgWidth = 28
        const imgHeight = 20
        doc.addImage(
          dataUrl,
          'JPEG',
          (pageWidth - imgWidth) / 2,
          startY,
          imgWidth,
          imgHeight,
          undefined,
          'FAST',
        )
        startY += imgHeight + 4
      }
    } catch {
      // continua sem imagem
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

  autoTable(doc, {
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

  // 5. LOCAL E DATA
  const localDataStr = formatExtendDateBR(data.cidadeUf, data.dataEmissao)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.text(localDataStr, marginX, textY)
  textY += 18

  // 6. RODAPÉ DE ASSINATURA (Linha de assinatura e identificação)
  // Matrícula ou CPF fica em branco para preenchimento manual após a impressão
  const sigX = pageWidth / 2
  const sigLineWidth = 110

  doc.setDrawColor(30, 41, 59)
  doc.setLineWidth(0.4)
  doc.line(sigX - sigLineWidth / 2, textY, sigX + sigLineWidth / 2, textY)
  textY += 5

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.text('Representante da Unidade Escolar (conferente)', sigX, textY, { align: 'center' })
  textY += 4.5

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(nomeEscola, sigX, textY, { align: 'center' })
  textY += 6

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('Matrícula ou CPF: ___________________________', sigX, textY, { align: 'center' })

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
  const doc = await createOfficialAtestoPdf(data)
  const safeFilename = filename || `Termo_Recebimento_${data.numeroAtesto || 'Atesto'}.pdf`
  doc.save(safeFilename.endsWith('.pdf') ? safeFilename : `${safeFilename}.pdf`)
}
