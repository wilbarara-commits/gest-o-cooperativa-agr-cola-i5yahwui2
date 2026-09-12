import { normalizeName } from '@/lib/excelImporter'
import { parseCsvTextToMatrix } from '@/lib/schoolCsvImporter'
import * as XLSX from 'xlsx'

export type ProdutoCategoria = 'Hortaliças' | 'Frutas' | 'Grãos' | 'Legumes' | 'Outros'
export type ProdutoDisponibilidade = 'normal' | 'escassez' | 'abundancia'

export interface ParsedCsvProductRow {
  index: number // 1-based, considerando cabeçalho na linha 1
  rawNome: string
  rawCategoria: string
  rawUnidade: string
  rawEstoque: string
  rawPreco: string
  rawEssencial: string
  rawDisponibilidade: string

  // Campos mapeados e normalizados
  nome: string
  categoria: ProdutoCategoria | ''
  unidade: string
  estoque: number
  preco_unitario: number
  essencial: boolean
  disponibilidade: ProdutoDisponibilidade

  // Status de validação
  status: 'valid' | 'duplicate_master' | 'duplicate_file' | 'error'
  statusReason?: string
  warnings: string[]
}

export interface ProductCsvParseResult {
  fileName: string
  totalRows: number
  validRows: ParsedCsvProductRow[]
  duplicateMasterCount: number
  duplicateFileCount: number
  errorCount: number
  allRows: ParsedCsvProductRow[]
}

/**
 * Normaliza a categoria informada para uma das opções aceitas pela collection:
 * 'Hortaliças' | 'Frutas' | 'Grãos' | 'Legumes' | 'Outros'
 * Tolerante a acentuação e variações como "Hortifrúti", "Hortaliça", "Fruta", "Grão", "Legume".
 */
export function normalizeProdutoCategoria(rawCategoria: string): {
  categoria: ProdutoCategoria | ''
  isExactOrMapped: boolean
} {
  const trimmed = rawCategoria.trim()
  if (!trimmed) {
    return { categoria: '', isExactOrMapped: false }
  }

  const norm = normalizeName(trimmed)

  if (norm === 'hortalicas' || norm === 'hortalica' || norm === 'verduras' || norm === 'verdura') {
    return { categoria: 'Hortaliças', isExactOrMapped: true }
  }
  if (norm === 'frutas' || norm === 'fruta') {
    return { categoria: 'Frutas', isExactOrMapped: true }
  }
  if (norm === 'graos' || norm === 'grao' || norm === 'cereais' || norm === 'cereal') {
    return { categoria: 'Grãos', isExactOrMapped: true }
  }
  if (norm === 'legumes' || norm === 'legume' || norm === 'tuberculos' || norm === 'tuberculo') {
    return { categoria: 'Legumes', isExactOrMapped: true }
  }
  if (norm === 'outros' || norm === 'outro') {
    return { categoria: 'Outros', isExactOrMapped: true }
  }

  // Se vier "hortifruti", enquadra em Hortaliças como padrão do grupo hortícola
  if (norm.includes('hortifruti') || norm.includes('hortifrutigranjeiro')) {
    return { categoria: 'Hortaliças', isExactOrMapped: true }
  }

  // Casar diretamente se já for idêntico a um valor válido
  if (trimmed === 'Hortaliças') return { categoria: 'Hortaliças', isExactOrMapped: true }
  if (trimmed === 'Frutas') return { categoria: 'Frutas', isExactOrMapped: true }
  if (trimmed === 'Grãos') return { categoria: 'Grãos', isExactOrMapped: true }
  if (trimmed === 'Legumes') return { categoria: 'Legumes', isExactOrMapped: true }
  if (trimmed === 'Outros') return { categoria: 'Outros', isExactOrMapped: true }

  // Valor não reconhecido: não inventa categoria, deixa 'Outros' com aviso ou mantém vazio
  return { categoria: 'Outros', isExactOrMapped: false }
}

/**
 * Normaliza o campo essencial (booleano):
 * true/false, "sim"/"não", 1/0, "s"/"n", "verdadeiro"/"falso"
 */
export function parseEssencialField(val: string): boolean {
  if (!val) return false
  const s = normalizeName(val)
  return s === 'true' || s === 'sim' || s === 's' || s === '1' || s === 'verdadeiro' || s === 'v'
}

/**
 * Normaliza a disponibilidade:
 * 'normal' | 'escassez' | 'abundancia'
 * Tolerante a acentuação e maiúsculas. Valores desconhecidos → 'normal'.
 */
export function normalizeDisponibilidade(val: string): ProdutoDisponibilidade {
  if (!val) return 'normal'
  const norm = normalizeName(val)
  if (norm.includes('escassez') || norm.includes('falta') || norm.includes('baixo')) {
    return 'escassez'
  }
  if (
    norm.includes('abundancia') ||
    norm.includes('alta') ||
    norm.includes('excesso') ||
    norm.includes('safra')
  ) {
    return 'abundancia'
  }
  if (norm.includes('normal') || norm.includes('regular') || norm.includes('medio')) {
    return 'normal'
  }
  return 'normal'
}

/**
 * Converte string de preço (ex: "12,50", "R$ 12.50", "12.50") em float numérico.
 */
export function parseNumberField(val: string): { value: number; isValid: boolean } {
  if (val === undefined || val === null || val.trim() === '') {
    return { value: 0, isValid: true }
  }

  const clean = val
    .replace(/[R$\s]/gi, '')
    .replace(/\./g, '') // remove separadores de milhar pontilhados
    .replace(',', '.') // converte vírgula decimal em ponto

  // Caso especial: se não havia vírgula mas havia apenas ponto como decimal (ex: "0.00" ou "12.50")
  let parsed = parseFloat(clean)
  if (isNaN(parsed)) {
    // Tentar parse direto caso tenha sobrado apenas números e ponto
    const fallback = parseFloat(val.replace(/[^\d.-]/g, ''))
    if (isNaN(fallback)) {
      return { value: 0, isValid: false }
    }
    return { value: fallback, isValid: true }
  }

  return { value: parsed, isValid: true }
}

/**
 * Mapeia cabeçalhos para os índices correspondentes das colunas:
 * nome, categoria, unidade, estoque, preco_unitario, essencial, disponibilidade
 */
function findColumnIndexes(headerRow: string[]): {
  nomeIdx: number
  categoriaIdx: number
  unidadeIdx: number
  estoqueIdx: number
  precoIdx: number
  essencialIdx: number
  disponibilidadeIdx: number
} {
  let nomeIdx = -1
  let categoriaIdx = -1
  let unidadeIdx = -1
  let estoqueIdx = -1
  let precoIdx = -1
  let essencialIdx = -1
  let disponibilidadeIdx = -1

  headerRow.forEach((col, idx) => {
    const norm = normalizeName(col)

    if (
      nomeIdx === -1 &&
      (norm === 'nome' ||
        norm.includes('produto') ||
        norm.includes('item') ||
        norm.includes('descricao'))
    ) {
      nomeIdx = idx
    } else if (
      categoriaIdx === -1 &&
      (norm === 'categoria' ||
        norm.includes('cat') ||
        norm.includes('grupo') ||
        norm.includes('tipo'))
    ) {
      categoriaIdx = idx
    } else if (
      unidadeIdx === -1 &&
      (norm === 'unidade' || norm === 'un' || norm.includes('medida') || norm === 'und')
    ) {
      unidadeIdx = idx
    } else if (
      estoqueIdx === -1 &&
      (norm === 'estoque' ||
        norm.includes('qtd') ||
        norm.includes('quantidade') ||
        norm === 'saldo')
    ) {
      estoqueIdx = idx
    } else if (
      precoIdx === -1 &&
      (norm === 'preco' ||
        norm === 'preco unitario' ||
        norm.includes('preco') ||
        norm.includes('valor') ||
        norm.includes('custo'))
    ) {
      precoIdx = idx
    } else if (essencialIdx === -1 && (norm === 'essencial' || norm.includes('obrigatorio'))) {
      essencialIdx = idx
    } else if (
      disponibilidadeIdx === -1 &&
      (norm === 'disponibilidade' ||
        norm.includes('disp') ||
        norm.includes('safra') ||
        norm.includes('status'))
    ) {
      disponibilidadeIdx = idx
    }
  })

  // Se não achou por nome flexível e tiver posições padrão
  // [nome, categoria, unidade, estoque, preco_unitario, essencial, disponibilidade]
  if (nomeIdx === -1 && headerRow.length >= 1) nomeIdx = 0
  if (categoriaIdx === -1 && headerRow.length >= 2) categoriaIdx = 1
  if (unidadeIdx === -1 && headerRow.length >= 3) unidadeIdx = 2
  if (estoqueIdx === -1 && headerRow.length >= 4) estoqueIdx = 3
  if (precoIdx === -1 && headerRow.length >= 5) precoIdx = 4
  if (essencialIdx === -1 && headerRow.length >= 6) essencialIdx = 5
  if (disponibilidadeIdx === -1 && headerRow.length >= 7) disponibilidadeIdx = 6

  return {
    nomeIdx,
    categoriaIdx,
    unidadeIdx,
    estoqueIdx,
    precoIdx,
    essencialIdx,
    disponibilidadeIdx,
  }
}

/**
 * Executa o parsing e validação de um arquivo CSV ou XLSX enviado pelo usuário para produtos
 */
export async function parseProductsFile(
  file: File,
  existingMasterProducts: Array<{ id: string; name: string }>,
): Promise<ProductCsvParseResult> {
  let rawMatrix: string[][] = []

  const isExcel =
    file.name.endsWith('.xlsx') ||
    file.name.endsWith('.xls') ||
    file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    file.type === 'application/vnd.ms-excel'

  if (isExcel) {
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const firstSheetName = workbook.SheetNames[0]
    if (!firstSheetName) {
      throw new Error('Arquivo de planilha não contém nenhuma aba.')
    }
    const worksheet = workbook.Sheets[firstSheetName]
    const sheetData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' })
    rawMatrix = sheetData.map((row) => row.map((cell) => String(cell ?? '').trim()))
  } else {
    const text = await file.text()
    rawMatrix = parseCsvTextToMatrix(text)
  }

  if (rawMatrix.length === 0) {
    throw new Error('O arquivo selecionado está vazio.')
  }

  const header = rawMatrix[0]
  const {
    nomeIdx,
    categoriaIdx,
    unidadeIdx,
    estoqueIdx,
    precoIdx,
    essencialIdx,
    disponibilidadeIdx,
  } = findColumnIndexes(header)

  const dataRows = rawMatrix.slice(1)
  if (dataRows.length === 0) {
    throw new Error('O arquivo contém apenas a linha de cabeçalho, sem dados.')
  }

  // Mapear produtos cadastrados existentes no banco para normalização
  const masterNamesNormalized = new Map<string, string>()
  for (const p of existingMasterProducts) {
    const n = normalizeName(p.name)
    if (n) {
      masterNamesNormalized.set(n, p.name)
    }
  }

  // Rastrear duplicidades dentro do próprio arquivo
  const seenInFile = new Map<string, number>() // normName -> firstRowIndex

  const allRows: ParsedCsvProductRow[] = []
  let duplicateMasterCount = 0
  let duplicateFileCount = 0
  let errorCount = 0

  dataRows.forEach((row, rowIdx) => {
    // Ignorar linhas totalmente vazias
    if (row.every((c) => !c || c.trim() === '')) return

    const rawNome = row[nomeIdx] !== undefined ? String(row[nomeIdx]).trim() : ''
    const rawCategoria = row[categoriaIdx] !== undefined ? String(row[categoriaIdx]).trim() : ''
    const rawUnidade = row[unidadeIdx] !== undefined ? String(row[unidadeIdx]).trim() : ''
    const rawEstoque = row[estoqueIdx] !== undefined ? String(row[estoqueIdx]).trim() : ''
    const rawPreco = row[precoIdx] !== undefined ? String(row[precoIdx]).trim() : ''
    const rawEssencial = row[essencialIdx] !== undefined ? String(row[essencialIdx]).trim() : ''
    const rawDisponibilidade =
      row[disponibilidadeIdx] !== undefined ? String(row[disponibilidadeIdx]).trim() : ''

    const warnings: string[] = []
    let status: ParsedCsvProductRow['status'] = 'valid'
    let statusReason: string | undefined

    // 1. Validação de nome
    if (!rawNome) {
      status = 'error'
      statusReason = 'Nome do produto em branco ou inválido'
      errorCount++
      allRows.push({
        index: rowIdx + 2,
        rawNome,
        rawCategoria,
        rawUnidade,
        rawEstoque,
        rawPreco,
        rawEssencial,
        rawDisponibilidade,
        nome: '',
        categoria: '',
        unidade: rawUnidade || 'Kg',
        estoque: 0,
        preco_unitario: 0,
        essencial: false,
        disponibilidade: 'normal',
        status,
        statusReason,
        warnings,
      })
      return
    }

    const normNome = normalizeName(rawNome)

    // 2. Validação de duplicidade contra o próprio arquivo
    if (seenInFile.has(normNome)) {
      status = 'duplicate_file'
      statusReason = `Duplicado no próprio arquivo (já apareceu na linha ${seenInFile.get(normNome)})`
      duplicateFileCount++
    } else {
      seenInFile.set(normNome, rowIdx + 2)
    }

    // 3. Validação de duplicidade contra o banco existente
    if (status === 'valid') {
      const existingName = masterNamesNormalized.get(normNome)
      if (existingName) {
        status = 'duplicate_master'
        statusReason = `Já cadastrado no banco como "${existingName}" (será ignorado)`
        duplicateMasterCount++
      }
    }

    // 4. Mapeamento de categoria
    const { categoria: mappedCategoria, isExactOrMapped } = normalizeProdutoCategoria(rawCategoria)
    let finalCategoria: ProdutoCategoria = (mappedCategoria || 'Outros') as ProdutoCategoria
    if (!rawCategoria) {
      // Requisito 4: categoria vazia não inventa "Hortifrúti"; avisar e usar 'Outros'
      warnings.push('Categoria em branco no arquivo; definida como "Outros".')
      finalCategoria = 'Outros'
    } else if (!isExactOrMapped) {
      warnings.push(`Categoria "${rawCategoria}" não reconhecida; normalizada para "Outros".`)
      finalCategoria = 'Outros'
    }

    // 5. Unidade de medida
    const mappedUnidade = rawUnidade || 'Kg'

    // 6. Estoque numérico
    let mappedEstoque = 0
    if (rawEstoque) {
      const parsed = parseNumberField(rawEstoque)
      if (!parsed.isValid) {
        warnings.push(`Estoque "${rawEstoque}" não numérico (usado 0).`)
        mappedEstoque = 0
      } else {
        mappedEstoque = parsed.value
      }
    }

    // 7. Preço unitário numérico
    let mappedPreco = 0
    if (rawPreco) {
      const parsed = parseNumberField(rawPreco)
      if (!parsed.isValid) {
        warnings.push(`Preço unitário "${rawPreco}" não numérico (usado R$ 0,00).`)
        mappedPreco = 0
      } else {
        mappedPreco = parsed.value
      }
    }

    // 8. Essencial
    const mappedEssencial = parseEssencialField(rawEssencial)

    // 9. Disponibilidade
    const mappedDisponibilidade = normalizeDisponibilidade(rawDisponibilidade)

    allRows.push({
      index: rowIdx + 2,
      rawNome,
      rawCategoria,
      rawUnidade,
      rawEstoque,
      rawPreco,
      rawEssencial,
      rawDisponibilidade,
      nome: rawNome,
      categoria: finalCategoria,
      unidade: mappedUnidade,
      estoque: mappedEstoque,
      preco_unitario: mappedPreco,
      essencial: mappedEssencial,
      disponibilidade: mappedDisponibilidade,
      status,
      statusReason,
      warnings,
    })
  })

  const validRows = allRows.filter((r) => r.status === 'valid')

  return {
    fileName: file.name,
    totalRows: allRows.length,
    validRows,
    duplicateMasterCount,
    duplicateFileCount,
    errorCount,
    allRows,
  }
}
