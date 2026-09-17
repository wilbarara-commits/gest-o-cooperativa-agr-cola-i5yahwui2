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

export type SchoolMatchStatus = 'ok' | 'needs_link' | 'needs_register'

export interface ParsedSchoolOrder {
  schoolNameRaw: string
  schoolId?: string
  schoolNameMatched?: string
  routeRaw: string
  sheetMatchedContractRota?: string
  isSheetUnmatchedInContract?: boolean
  rotaId?: string
  rotaNomeMatched?: string
  isLinkedToContract: boolean
  isDuplicateInOtherSheets?: boolean
  matchStatus: SchoolMatchStatus
  prefilledLink?: {
    escolaId: string
    escolaNome: string
    rotaSugerida: string
  }
  items: ParsedOrderItem[]
  totalCalculated: number
  issues: string[]
  mergedColumnsCount?: number
}

export interface ParsedExcelResult {
  routesFound: string[]
  unmatchedSheets?: string[]
  ignoredUnmatchedSheets?: string[]
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
 * Casa tolerante do nome de uma aba da planilha com as rotas cadastradas no contrato.
 * Normaliza acentos, pontuação, múltiplos espaços e caixa alta/baixa.
 */
/**
 * Casa tolerante de uma linha de texto colada (ex: nome da escola e opcionalmente endereço)
 * com as escolas vinculadas ao contrato.
 * Suporta separadores comuns como "\t", ";", " - " ou vírgula.
 * Tolerante a acentos, caixa, pontuação e espaços extras.
 */
export function matchPastedSchoolLine(
  rawLine: string,
  contractSchools: ContractSchoolLink[],
  allSchools?: School[],
): {
  matchedLink: ContractSchoolLink | null
  extractedName: string
  extractedAddress?: string
} {
  const line = (rawLine || '').trim()
  if (!line) {
    return { matchedLink: null, extractedName: '' }
  }

  // Divisão em nome e possível endereço por tab, ponto-e-vírgula ou traço com espaços em volta
  let namePart = line
  let addressPart = ''

  if (line.includes('\t')) {
    const parts = line
      .split('\t')
      .map((p) => p.trim())
      .filter(Boolean)
    namePart = parts[0] || ''
    addressPart = parts.slice(1).join(' ')
  } else if (line.includes(';')) {
    const parts = line
      .split(';')
      .map((p) => p.trim())
      .filter(Boolean)
    namePart = parts[0] || ''
    addressPart = parts.slice(1).join(' ')
  } else if (/\s+-\s+/.test(line)) {
    const parts = line
      .split(/\s+-\s+/)
      .map((p) => p.trim())
      .filter(Boolean)
    namePart = parts[0] || ''
    addressPart = parts.slice(1).join(' ')
  } else if (line.includes(',')) {
    // Se houver vírgula mas nenhum outro separador, testa se antes da vírgula já parece nome
    const parts = line
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
    if (parts.length > 1) {
      namePart = parts[0] || ''
      addressPart = parts.slice(1).join(', ')
    }
  }

  const normLine = normalizeName(line)
  const normName = normalizeName(namePart)
  const normNameNoParen = normalizeName(stripParentheses(namePart))
  const normAddress = addressPart ? normalizeName(addressPart) : ''

  // Função auxiliar de match para um ContractSchoolLink
  const testCandidate = (cs: ContractSchoolLink): boolean => {
    const schoolObj = allSchools?.find((s) => s.id === cs.escolaId)
    const candName = cs.escolaNome || schoolObj?.name || ''
    const candAddress = cs.escolaEndereco || schoolObj?.address || ''

    const normCand = normalizeName(candName)
    const normCandNoParen = normalizeName(stripParentheses(candName))
    const candParen = normalizeName(extractParenthesesContent(candName))
    const inputParen = normalizeName(extractParenthesesContent(namePart))

    if (!normCand) return false

    // 1. Igualdade exata no nome normalizado
    if (normCand === normName || normCand === normLine) return true

    // 2. Sem parênteses
    if (normCandNoParen && normNameNoParen && normCandNoParen === normNameNoParen) return true

    // 3. Parênteses / siglas coincidentes (ex: CMEI Várzea (CEROM))
    if (inputParen && (normCand.includes(inputParen) || candParen === inputParen)) return true
    if (candParen && (normName.includes(candParen) || candParen === inputParen)) return true

    // 4. Limpeza de prefixos ("em", "cmei", "escola municipal", etc.)
    const cleanCand = normCand
      .replace(/^(em|ee|cmei|cm|creche|escola municipal|escola estadual)\s+/, '')
      .trim()
    const cleanInput = normName
      .replace(/^(em|ee|cmei|cm|creche|escola municipal|escola estadual)\s+/, '')
      .trim()
    if (
      cleanCand &&
      cleanInput &&
      (cleanCand === cleanInput || cleanCand.includes(cleanInput) || cleanInput.includes(cleanCand))
    ) {
      return true
    }

    // 5. Contém o nome inteiro ou a linha inteira contém o nome da escola
    if (normLine.includes(normCand) || normCand.includes(normName)) {
      return true
    }

    // 6. Fallback por endereço se tiver endereço informado e candidato tiver endereço
    if (normAddress && candAddress) {
      const normCandAddr = normalizeName(candAddress)
      if (
        normCandAddr &&
        (normAddress.includes(normCandAddr) || normCandAddr.includes(normAddress))
      ) {
        return true
      }
    }

    return false
  }

  // Tentar encontrar entre as escolas do contrato
  for (const cs of contractSchools) {
    if (testCandidate(cs)) {
      return {
        matchedLink: cs,
        extractedName: namePart,
        extractedAddress: addressPart || undefined,
      }
    }
  }

  // Se não achou com namePart separado por vírgula, tenta testar a linha inteira como nome
  if (namePart !== line) {
    for (const cs of contractSchools) {
      const schoolObj = allSchools?.find((s) => s.id === cs.escolaId)
      const candName = cs.escolaNome || schoolObj?.name || ''
      const normCand = normalizeName(candName)
      if (normCand && normLine.includes(normCand)) {
        return {
          matchedLink: cs,
          extractedName: line,
          extractedAddress: undefined,
        }
      }
    }
  }

  return {
    matchedLink: null,
    extractedName: namePart || line,
    extractedAddress: addressPart || undefined,
  }
}

export function matchSheetToContractRota(
  sheetName: string,
  contractRotas: Array<{ nome: string } | string>,
): string | null {
  const normSheet = normalizeName(sheetName)
  if (!normSheet) return null

  for (const r of contractRotas) {
    const rotaNome = typeof r === 'string' ? r : r.nome
    const normRota = normalizeName(rotaNome)
    if (!normRota) continue

    if (normSheet === normRota) {
      return rotaNome
    }
    // Tolerância para sufixos/prefixos equivalentes (ex.: "ROTA A" vs "ROTA - A")
    if (
      normSheet.replace(/\s+/g, '') === normRota.replace(/\s+/g, '') ||
      normSheet === normRota.replace(/^rota\s+/, '') ||
      normRota === normSheet.replace(/^rota\s+/, '')
    ) {
      return rotaNome
    }
  }

  return null
}

/**
 * Parser principal do arquivo Excel (.xlsx)
 * Agora recebe opcionalmente a lista de rotas cadastradas do contrato selecionado.
 * Remove a heurística fixa 'ROTA' e casa os nomes das abas com tolerância a acentos, maiúsculas e espaços.
 */
export function parseSecretaryExcel(
  workbook: XLSX.WorkBook,
  availableSchools: School[],
  contractSchools: ContractSchoolLink[],
  allProducts: Product[],
  contractRotas?: Array<{ nome: string } | string>,
): ParsedExcelResult {
  const sheetNames = workbook.SheetNames
  const candidateSheets: string[] = []
  const routesToImport: string[] = []
  const ignoredSheets: string[] = []
  const ignoredUnmatchedSheets: string[] = []

  // Normalizar lista de rotas do contrato se fornecida
  const hasContractRotas = Boolean(contractRotas && contractRotas.length > 0)

  // Filtrar abas: ignorar abas de consolidado/totalizador comuns
  for (const name of sheetNames) {
    const norm = normalizeName(name)
    if (
      norm === 'total' ||
      norm === 'totais' ||
      norm === 'todas unidades' ||
      norm === 'todas as unidades' ||
      norm === 'consolidado' ||
      norm === 'resumo'
    ) {
      ignoredSheets.push(name)
    } else {
      candidateSheets.push(name)
    }
  }

  const sheetMatchedMap = new Map<string, string | null>() // sheetName -> matchedContractRotaNome

  // Quando o contrato possui rotas cadastradas:
  // Abas não cadastradas são COMPLETAMENTE IGNORADAS (não lidas, não geram pedidos, nem pendências/erros).
  for (const sheetName of candidateSheets) {
    if (hasContractRotas && contractRotas) {
      const matched = matchSheetToContractRota(sheetName, contractRotas)
      if (matched) {
        sheetMatchedMap.set(sheetName, matched)
        routesToImport.push(sheetName)
      } else {
        ignoredUnmatchedSheets.push(sheetName)
      }
    } else {
      routesToImport.push(sheetName)
    }
  }

  const parsedOrders: ParsedSchoolOrder[] = []
  // Rastrear ocorrências de escolas por aba: escolaNorm -> Map<sheetName, count de colunas>
  const schoolSheetOccurrences = new Map<string, Map<string, number>>()
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

    // Agrupar colunas por escola para consolidar ocorrências na mesma aba.
    // Regra: "Em caso de anomalia de duplicidade na mesma aba, some as quantidades e considere o pedido válido."
    // Chave de agrupamento: escola resolvida (matchedSchool.id) quando identificada,
    // ou nome normalizado (normSchool) caso ainda não esteja cadastrada/identificada.
    interface ExtractedColumnData {
      colIndex: number
      schoolNameRaw: string
      matchedSchool: School | null
      isLinked: boolean
      matchStatus: SchoolMatchStatus
      prefilledLink?: { escolaId: string; escolaNome: string; rotaSugerida: string }
      matchedContractRota?: string
      isSheetUnmatched: boolean
      baseIssues: string[]
      items: ParsedOrderItem[]
    }

    const matchedContractRota = sheetMatchedMap.has(sheetName)
      ? sheetMatchedMap.get(sheetName) || undefined
      : undefined
    const isSheetUnmatched = false
    const suggestedRotaName = matchedContractRota || sheetName

    // Extrair dados de cada coluna individual
    const extractedCols: ExtractedColumnData[] = []

    for (const sc of schoolColumns) {
      const normSchool = normalizeName(sc.schoolNameRaw)

      // Rastrear contagem de colunas por aba (para estatística / auditoria / rastreio)
      let sheetMap = schoolSheetOccurrences.get(normSchool)
      if (!sheetMap) {
        sheetMap = new Map<string, number>()
        schoolSheetOccurrences.set(normSchool, sheetMap)
      }
      sheetMap.set(sheetName, (sheetMap.get(sheetName) || 0) + 1)

      const baseIssues: string[] = []

      // Matching da escola contra o CADASTRO MESTRE GLOBAL
      const matchResult = matchSchoolName(sc.schoolNameRaw, availableSchools, contractSchools)
      const matchedSchool = matchResult.school
      const isLinked = matchResult.isLinked

      let matchStatus: SchoolMatchStatus = 'ok'
      let prefilledLink: { escolaId: string; escolaNome: string; rotaSugerida: string } | undefined

      if (!matchedSchool) {
        matchStatus = 'needs_register'
        baseIssues.push(
          `Cadastrar escola: "${sc.schoolNameRaw}" não existe no cadastro mestre global de escolas.`,
        )
      } else if (!isLinked) {
        matchStatus = 'needs_link'
        prefilledLink = {
          escolaId: matchedSchool.id,
          escolaNome: matchedSchool.name,
          rotaSugerida: suggestedRotaName,
        }
        baseIssues.push(
          `Vincular ao contrato: Escola "${matchedSchool.name}" existe no cadastro mestre, mas não está vinculada ao contrato.`,
        )
      }

      // Ler os produtos da linha 10 à linha 34 para esta coluna
      const items: ParsedOrderItem[] = []

      for (let r = startProductRow; r <= endProductRow; r++) {
        const row = data[r] || []
        const productDescRaw = String(row[2] || row[1] || '').trim()
        if (!productDescRaw) continue

        const rawQtd = row[sc.colIndex]
        let qty = 0
        if (typeof rawQtd === 'number') {
          qty = rawQtd
        } else if (typeof rawQtd === 'string') {
          qty = parseFloat(rawQtd.replace(',', '.')) || 0
        }

        if (qty <= 0 || isNaN(qty)) continue

        const matchedProd = matchProductName(productDescRaw, allProducts)
        if (!matchedProd) {
          baseIssues.push(`Produto "${productDescRaw}" não encontrado no catálogo de produtos.`)
        }

        const price = matchedProd?.price || 0
        items.push({
          productNameRaw: productDescRaw,
          productId: matchedProd?.id,
          productNameMatched: matchedProd?.name,
          quantity: qty,
          price,
        })
      }

      extractedCols.push({
        colIndex: sc.colIndex,
        schoolNameRaw: sc.schoolNameRaw,
        matchedSchool,
        isLinked,
        matchStatus,
        prefilledLink,
        matchedContractRota,
        isSheetUnmatched,
        baseIssues,
        items,
      })
    }

    // Agrupar por escola na mesma aba e consolidar somando quantidades
    const groupsInSheet = new Map<string, ExtractedColumnData[]>()
    for (const ec of extractedCols) {
      // Chave: ID da escola se matched, caso contrário nome normalizado
      const groupKey = ec.matchedSchool
        ? `id:${ec.matchedSchool.id}`
        : `raw:${normalizeName(ec.schoolNameRaw)}`
      const existing = groupsInSheet.get(groupKey)
      if (existing) {
        existing.push(ec)
      } else {
        groupsInSheet.set(groupKey, [ec])
      }
    }

    for (const cols of groupsInSheet.values()) {
      const firstCol = cols[0]
      const colCount = cols.length

      // Consolidar itens somando quantidades de produtos correspondentes
      // Chave do produto: productId se matched, ou productNameRaw normalizado
      const itemMap = new Map<string, ParsedOrderItem>()
      for (const col of cols) {
        for (const item of col.items) {
          const prodKey = item.productId
            ? `id:${item.productId}`
            : `raw:${normalizeName(item.productNameRaw)}`
          const existingItem = itemMap.get(prodKey)
          if (existingItem) {
            existingItem.quantity =
              Math.round((existingItem.quantity + item.quantity) * 1000) / 1000
          } else {
            itemMap.set(prodKey, { ...item })
          }
        }
      }

      const consolidatedItems = Array.from(itemMap.values())

      // Calcular total
      let totalCalculated = 0
      for (const item of consolidatedItems) {
        totalCalculated += item.quantity * item.price
      }

      // Juntar issues sem duplicatas
      const issueSet = new Set<string>()
      for (const col of cols) {
        for (const iss of col.baseIssues) {
          issueSet.add(iss)
        }
      }

      // Se ocorreu em mais de uma coluna nesta mesma aba, registrar observação informativa (não anomalia/não erro)
      if (colCount > 1) {
        const schDisplayName = firstCol.matchedSchool?.name || firstCol.schoolNameRaw
        issueSet.add(
          `Quantidades somadas de ${colCount} lançamentos na aba ${sheetName} para "${schDisplayName}".`,
        )
      }

      parsedOrders.push({
        schoolNameRaw: firstCol.schoolNameRaw,
        schoolId: firstCol.matchedSchool?.id,
        schoolNameMatched: firstCol.matchedSchool?.name,
        routeRaw: sheetName,
        sheetMatchedContractRota: firstCol.matchedContractRota,
        isSheetUnmatchedInContract: firstCol.isSheetUnmatched,
        rotaNomeMatched: firstCol.matchedContractRota,
        isLinkedToContract: firstCol.isLinked,
        matchStatus: firstCol.matchStatus,
        prefilledLink: firstCol.prefilledLink,
        items: consolidatedItems,
        totalCalculated: Math.round(totalCalculated * 100) / 100,
        issues: Array.from(issueSet),
        mergedColumnsCount: colCount > 1 ? colCount : undefined,
      })
    }
  }

  // Verificar anomalias de duplicidade:
  // APENAS quando a mesma escola aparece em ABAS DISTINTAS (ex.: ROTA A e ROTA B).
  // Múltiplas colunas na MESMA aba já foram unificadas acima e NÃO geram mais anomalia nem isDuplicateInOtherSheets.
  // Mapear escolas das ordens geradas por aba para identificar abas distintas
  const schoolDistinctSheets = new Map<string, Set<string>>()
  for (const po of parsedOrders) {
    const key = po.schoolId ? `id:${po.schoolId}` : `raw:${normalizeName(po.schoolNameRaw)}`
    let set = schoolDistinctSheets.get(key)
    if (!set) {
      set = new Set<string>()
      schoolDistinctSheets.set(key, set)
    }
    set.add(po.routeRaw)
  }

  for (const [key, sheetsSet] of schoolDistinctSheets.entries()) {
    if (sheetsSet.size > 1) {
      const distinctSheets = Array.from(sheetsSet)
      const matchingOrders = parsedOrders.filter((po) => {
        const orderKey = po.schoolId
          ? `id:${po.schoolId}`
          : `raw:${normalizeName(po.schoolNameRaw)}`
        return orderKey === key
      })
      const schDisplayName =
        matchingOrders[0]?.schoolNameMatched || matchingOrders[0]?.schoolNameRaw || key

      const msg = `Anomalia de duplicidade: A escola "${schDisplayName}" foi encontrada em múltiplas abas (${distinctSheets.join(', ')}).`
      anomalies.push(msg)

      for (const po of matchingOrders) {
        po.isDuplicateInOtherSheets = true
        po.issues.push(
          `Atenção: Esta escola apareceu em mais de uma rota da planilha (${distinctSheets.join(', ')}).`,
        )
      }
    }
  }

  let totalItemsCount = 0
  let totalWeight = 0
  let pendingIssuesCount = 0

  for (const po of parsedOrders) {
    const hasBlockingIssues =
      po.matchStatus !== 'ok' ||
      !po.isLinkedToContract ||
      po.isDuplicateInOtherSheets ||
      po.isSheetUnmatchedInContract ||
      po.items.some((it) => !it.productId)

    if (hasBlockingIssues) {
      pendingIssuesCount++
    }
    for (const it of po.items) {
      totalItemsCount++
      totalWeight += it.quantity
    }
  }

  return {
    routesFound: routesToImport,
    unmatchedSheets: ignoredUnmatchedSheets.length > 0 ? ignoredUnmatchedSheets : undefined,
    ignoredUnmatchedSheets: ignoredUnmatchedSheets.length > 0 ? ignoredUnmatchedSheets : undefined,
    orders: parsedOrders,
    totalItemsCount,
    totalWeight: Math.round(totalWeight * 100) / 100,
    anomalies,
    pendingIssuesCount,
  }
}
