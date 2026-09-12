/**
 * Parser de Planilha Excel da Secretaria para Pedidos Centralizados
 *
 * A planilha tem 5 abas:
 * - ROTA A, ROTA B, ROTA C (a importar)
 * - TOTAL e TODAS UNIDADES (a ignorar)
 *
 * Em cada aba de rota:
 * - Linhas 1-4: cabeçalho institucional (índices 0-3 no array 0-indexed)
 * - Linha 6: tipo da escola por coluna (índice 5: CMEI, CRECHE, INTEGRAL, FUNDAMENTAL)
 * - Linha 7: NOME DA ESCOLA EM CADA COLUNA (índice 6)
 * - Linha 8: nº de alunos e dias servidos (índice 7)
 * - Linha 9: cabeçalho Item/Descrição (índice 8)
 * - Linhas 10-34: 25 produtos (índices 9-33; coluna C / índice 2 = descrição do produto) e quantidade em Kg em cada coluna de escola
 * - Linha 35: total (índice 34)
 * - Mapeamento: escola-por-coluna (transposto)
 * - Ignorar seção FIXOS que existe ao lado dos dados em cada aba de rota
 * - Regras de matching de escolas:
 *   - Normalização de acentos, maiúsculas e espaços extras
 *   - Casos conhecidos:
 *     - "EM PAULINO CUSTÓDUIO REZENDE" == "EM PAULINO CUSTÓDIO DE REZENDE"
 *     - "CM LAR DE ISABEL" e "EM LAR DE ISABEL" são ESCOLAS DIFERENTES (não fundir)
 *     - Apelidos entre parênteses: CEDAL, CENSF, CEROM, CMEI Várzea casam com ou sem o apelido
 */

import * as XLSX from 'xlsx'
import type { School, Product, ContractSchoolLink } from '@/lib/types'

export interface ParsedOrderItem {
  productNameRaw: string
  productId?: string
  productNameMatched?: string
  quantity: number
  price: number
}

export interface ParsedSchoolOrder {
  schoolNameRaw: string
  schoolId?: string
  schoolNameMatched?: string
  routeRaw: string
  rotaId?: string
  rotaNomeMatched?: string
  isLinkedToContract: boolean
  isDuplicateInOtherSheets?: boolean
  items: ParsedOrderItem[]
  totalCalculated: number
  issues: string[]
}

export interface ParsedExcelResult {
  routesFound: string[]
  orders: ParsedSchoolOrder[]
  totalItemsCount: number
  totalWeight: number
  anomalies: string[]
  pendingIssuesCount: number
}

// Função de normalização de strings (remove acentos, pontuação, múltiplos espaços e lowercase)
export function normalizeName(str: string): string {
  if (!str) return ''
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacríticos/acentos
    .toLowerCase()
    .replace(/[^\w\s]/gi, ' ') // pontuação vira espaço
    .replace(/\s+/g, ' ')
    .trim()
}

// Remove apelido entre parênteses, ex: "E.M. Professor João (CEROM)" -> "E.M. Professor João"
export function stripParentheses(str: string): string {
  if (!str) return ''
  return str
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Extrai o conteúdo dentro de parênteses se houver
export function extractParenthesesContent(str: string): string {
  const match = str.match(/\(([^)]+)\)/)
  return match ? match[1].trim() : ''
}

/**
 * Matching tolerante de nomes de escolas com proteção para falsos positivos
 */
export function matchSchoolName(
  excelName: string,
  availableSchools: School[],
  contractSchools: ContractSchoolLink[],
): { school: School | null; isLinked: boolean; reason?: string } {
  const normExcel = normalizeName(excelName)
  const normExcelNoParen = normalizeName(stripParentheses(excelName))
  const excelParenContent = normalizeName(extractParenthesesContent(excelName))

  // Caso específico 1: CM LAR DE ISABEL vs EM LAR DE ISABEL
  // "CM LAR DE ISABEL" e "EM LAR DE ISABEL" são escolas DIFERENTES
  const isCmLar = normExcel.includes('cm lar de isabel') || normExcel.startsWith('cm lar')
  const isEmLar = normExcel.includes('em lar de isabel') || normExcel.startsWith('em lar')

  // Caso específico 2: "EM PAULINO CUSTÓDUIO REZENDE" == "EM PAULINO CUSTÓDIO DE REZENDE"
  const isCustodio = normExcel.includes('custod') && normExcel.includes('rezende')

  for (const sch of availableSchools) {
    const normSch = normalizeName(sch.name)
    const normSchNoParen = normalizeName(stripParentheses(sch.name))
    const schParenContent = normalizeName(extractParenthesesContent(sch.name))

    // Verificação de Lar de Isabel
    if (isCmLar) {
      if (normSch.startsWith('cm lar') || normSch.includes('creche lar')) {
        const isLinked = contractSchools.some((cs) => cs.escolaId === sch.id)
        return { school: sch, isLinked }
      }
      continue
    }
    if (isEmLar) {
      if (normSch.startsWith('em lar') || normSch.includes('escola municipal lar')) {
        const isLinked = contractSchools.some((cs) => cs.escolaId === sch.id)
        return { school: sch, isLinked }
      }
      continue
    }

    // Verificação de Paulino Custódio Rezende
    if (isCustodio && normSch.includes('custod') && normSch.includes('rezende')) {
      const isLinked = contractSchools.some((cs) => cs.escolaId === sch.id)
      return { school: sch, isLinked }
    }

    // Igualdade direta normalizada
    if (normExcel === normSch) {
      const isLinked = contractSchools.some((cs) => cs.escolaId === sch.id)
      return { school: sch, isLinked }
    }

    // Igualdade sem parênteses (ex: CEDAL, CENSF, CEROM, CMEI Várzea)
    if (normExcelNoParen && normSchNoParen && normExcelNoParen === normSchNoParen) {
      const isLinked = contractSchools.some((cs) => cs.escolaId === sch.id)
      return { school: sch, isLinked }
    }

    // Se o apelido entre parênteses de uma casar com o apelido da outra (ou com o nome)
    if (
      excelParenContent &&
      (normSch.includes(excelParenContent) || schParenContent === excelParenContent)
    ) {
      const isLinked = contractSchools.some((cs) => cs.escolaId === sch.id)
      return { school: sch, isLinked }
    }
    if (
      schParenContent &&
      (normExcel.includes(schParenContent) || schParenContent === excelParenContent)
    ) {
      const isLinked = contractSchools.some((cs) => cs.escolaId === sch.id)
      return { school: sch, isLinked }
    }

    // Tolerância para prefixos como "E.M.", "EM", "ESCOLA", "CMEI"
    const cleanPrefixExcel = normExcel
      .replace(/^(em|ee|cmei|cm|creche|escola municipal|escola estadual)\s+/, '')
      .trim()
    const cleanPrefixSch = normSch
      .replace(/^(em|ee|cmei|cm|creche|escola municipal|escola estadual)\s+/, '')
      .trim()

    if (
      cleanPrefixExcel &&
      cleanPrefixSch &&
      (cleanPrefixExcel === cleanPrefixSch ||
        cleanPrefixExcel.includes(cleanPrefixSch) ||
        cleanPrefixSch.includes(cleanPrefixExcel))
    ) {
      const isLinked = contractSchools.some((cs) => cs.escolaId === sch.id)
      return { school: sch, isLinked }
    }
  }

  return { school: null, isLinked: false }
}

/**
 * Match de produto pelo nome com normalização
 */
export function matchProductName(rawName: string, allProducts: Product[]): Product | null {
  const norm = normalizeName(rawName)
  for (const p of allProducts) {
    const normP = normalizeName(p.name)
    if (norm === normP) return p
    if (norm.includes(normP) || normP.includes(norm)) return p
  }
  return null
}

/**
 * Parser principal do arquivo Excel (.xlsx)
 */
export function parseSecretaryExcel(
  workbook: XLSX.WorkBook,
  availableSchools: School[],
  contractSchools: ContractSchoolLink[],
  allProducts: Product[],
): ParsedExcelResult {
  const sheetNames = workbook.SheetNames
  const routesToImport: string[] = []
  const ignoredSheets: string[] = []

  // Filtrar abas: ROTA A, ROTA B, ROTA C a importar; TOTAL e TODAS UNIDADES a ignorar
  for (const name of sheetNames) {
    const upper = name.trim().toUpperCase()
    if (upper === 'TOTAL' || upper === 'TODAS UNIDADES' || upper === 'TODAS AS UNIDADES') {
      ignoredSheets.push(name)
    } else if (upper.includes('ROTA')) {
      routesToImport.push(name)
    } else {
      // Caso a aba tenha outro nome mas não seja totalizador
      routesToImport.push(name)
    }
  }

  const parsedOrders: ParsedSchoolOrder[] = []
  const schoolSheetOccurrence = new Map<string, string[]>() // escolaNorm -> sheetNames[]
  const anomalies: string[] = []

  for (const sheetName of routesToImport) {
    const worksheet = workbook.Sheets[sheetName]
    if (!worksheet) continue

    // Converter para matriz de dados bruta [linha][coluna]
    const data: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' })
    if (data.length < 10) continue // Planilha vazia ou com formato incorreto

    // Linha 7 (índice 6): Nomes das escolas por coluna
    const schoolRowIndex = 6
    const schoolRow = data[schoolRowIndex] || []

    // Linhas 10 a 34 (índices 9 a 33): 25 produtos (coluna C / índice 2 = descrição do produto)
    const startProductRow = 9
    const endProductRow = Math.min(data.length - 1, 33)

    // Identificar colunas que contêm escolas (geralmente da coluna D em diante, índice 3 em diante)
    // Parar se encontrar coluna com cabeçalho "FIXOS", "TOTAL" ou vazio
    const schoolColumns: { colIndex: number; schoolNameRaw: string }[] = []

    for (let col = 3; col < schoolRow.length; col++) {
      const cellVal = String(schoolRow[col] || '').trim()
      const upperVal = cellVal.toUpperCase()

      // Ignorar seção FIXOS ou colunas de totais
      if (!cellVal || upperVal.includes('FIXO') || upperVal.includes('TOTAL')) {
        // Se já lemos escolas e encontramos coluna vazia/total, continuamos verificando se há mais ou paramos
        continue
      }

      schoolColumns.push({
        colIndex: col,
        schoolNameRaw: cellVal,
      })
    }

    // Para cada coluna de escola identificada, montar o pedido
    for (const sc of schoolColumns) {
      const normSchool = normalizeName(sc.schoolNameRaw)

      // Rastrear ocorrência em mais de uma aba para detectar anomalia
      const occurrences = schoolSheetOccurrence.get(normSchool) || []
      occurrences.push(sheetName)
      schoolSheetOccurrence.set(normSchool, occurrences)

      const issues: string[] = []

      // Matching da escola com o cadastro existente
      const matchResult = matchSchoolName(sc.schoolNameRaw, availableSchools, contractSchools)
      const matchedSchool = matchResult.school
      const isLinked = matchResult.isLinked

      if (!matchedSchool) {
        issues.push(`Escola "${sc.schoolNameRaw}" não encontrada no cadastro do sistema.`)
      } else if (!isLinked) {
        issues.push(
          `Escola "${matchedSchool.name}" não está vinculada a este contrato em contrato_escolas. Vincule antes de importar.`,
        )
      }

      // Ler os produtos da linha 10 à linha 34 para esta coluna
      const items: ParsedOrderItem[] = []
      let totalCalculated = 0

      for (let r = startProductRow; r <= endProductRow; r++) {
        const row = data[r] || []
        // Descrição do produto: coluna C (índice 2) ou B (índice 1)
        const productDescRaw = String(row[2] || row[1] || '').trim()
        if (!productDescRaw) continue

        // Quantidade da escola nesta coluna
        const rawQtd = row[sc.colIndex]
        let qty = 0
        if (typeof rawQtd === 'number') {
          qty = rawQtd
        } else if (typeof rawQtd === 'string') {
          qty = parseFloat(rawQtd.replace(',', '.')) || 0
        }

        // Regra: Quantidade 0 ou vazia não gera item de pedido
        if (qty <= 0 || isNaN(qty)) continue

        // Matching do produto
        const matchedProd = matchProductName(productDescRaw, allProducts)
        if (!matchedProd) {
          issues.push(`Produto "${productDescRaw}" não encontrado no catálogo de produtos.`)
        }

        const price = matchedProd?.price || 0
        totalCalculated += qty * price

        items.push({
          productNameRaw: productDescRaw,
          productId: matchedProd?.id,
          productNameMatched: matchedProd?.name,
          quantity: qty,
          price,
        })
      }

      parsedOrders.push({
        schoolNameRaw: sc.schoolNameRaw,
        schoolId: matchedSchool?.id,
        schoolNameMatched: matchedSchool?.name,
        routeRaw: sheetName,
        isLinkedToContract: isLinked,
        items,
        totalCalculated: Math.round(totalCalculated * 100) / 100,
        issues,
      })
    }
  }

  // Verificar escolas encontradas em mais de uma aba (Anomalia de duplicidade)
  for (const [normSchool, sheets] of schoolSheetOccurrence.entries()) {
    if (sheets.length > 1) {
      const msg = `Anomalia de duplicidade: A escola "${normSchool}" foi encontrada em múltiplas abas (${sheets.join(', ')}).`
      anomalies.push(msg)

      // Marcar nos pedidos afetados
      for (const po of parsedOrders) {
        if (normalizeName(po.schoolNameRaw) === normSchool) {
          po.isDuplicateInOtherSheets = true
          po.issues.push(
            `Atenção: Esta escola apareceu em mais de uma rota da planilha (${sheets.join(', ')}).`,
          )
        }
      }
    }
  }

  let totalItemsCount = 0
  let totalWeight = 0
  let pendingIssuesCount = 0

  for (const po of parsedOrders) {
    if (po.issues.length > 0) {
      pendingIssuesCount++
    }
    for (const it of po.items) {
      totalItemsCount++
      totalWeight += it.quantity
    }
  }

  return {
    routesFound: routesToImport,
    orders: parsedOrders,
    totalItemsCount,
    totalWeight: Math.round(totalWeight * 100) / 100,
    anomalies,
    pendingIssuesCount,
  }
}
