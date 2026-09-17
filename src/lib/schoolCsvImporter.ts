import type { EscolaTipo } from '@/lib/types'
import { normalizeName } from '@/lib/excelImporter'
import { parsePtBrNumber } from '@/lib/numberParser'
import * as XLSX from 'xlsx'

export interface SchoolFieldChange {
  field: 'tipo' | 'rota' | 'alunos' | 'endereco' | 'telefone' | 'email'
  label: string
  oldValue: string
  newValue: string
}

export interface ParsedCsvSchoolRow {
  index: number
  rawNome: string
  rawTipo: string
  rawRota: string
  rawAlunos: string
  rawEndereco: string
  rawTelefone: string
  rawEmail: string
  // Mapeados
  nome: string
  tipo: EscolaTipo | ''
  rota: string
  alunos?: number
  endereco?: string
  telefone?: string
  email?: string
  // Dados do registro existente quando status for 'update'
  existingSchoolId?: string
  existingSchoolName?: string
  fieldChanges?: SchoolFieldChange[]
  // Indicação de quais colunas estavam presentes no arquivo
  presentColumns: {
    tipo: boolean
    rota: boolean
    alunos: boolean
    endereco: boolean
    telefone: boolean
    email: boolean
  }
  // Validações
  status: 'valid' | 'update' | 'duplicate_master' | 'duplicate_file' | 'error'
  statusReason?: string
  warnings: string[]
}

export interface CsvParseResult {
  fileName: string
  totalRows: number
  validRows: ParsedCsvSchoolRow[]
  updateRows: ParsedCsvSchoolRow[]
  duplicateMasterCount: number
  duplicateFileCount: number
  errorCount: number
  allRows: ParsedCsvSchoolRow[]
}

/**
 * Normaliza o tipo vindo do CSV para os 4 tipos exatos da planilha da secretaria:
 * 'CMEI' | 'CRECHE' | 'INTEGRAL' | 'FUNDAMENTAL' (ou '' se vazio/não informado)
 *
 * O valor da coluna "tipo" do arquivo deve ser gravado exatamente como vem, sem agrupar categorias.
 */
export function normalizeEscolaTipo(rawTipo: string): EscolaTipo | '' {
  if (!rawTipo) return ''
  const trimmed = rawTipo.trim().toUpperCase()

  if (trimmed === 'CMEI') return 'CMEI'
  if (trimmed === 'CRECHE') return 'CRECHE'
  if (trimmed === 'INTEGRAL') return 'INTEGRAL'
  if (trimmed === 'FUNDAMENTAL') return 'FUNDAMENTAL'

  const norm = normalizeName(rawTipo).toUpperCase()
  if (!norm) return ''

  if (norm === 'CMEI' || norm.includes('CMEI')) {
    return 'CMEI'
  }
  if (norm === 'CRECHE' || norm.includes('CRECHE')) {
    return 'CRECHE'
  }
  if (norm === 'INTEGRAL' || norm.includes('INTEGRAL')) {
    return 'INTEGRAL'
  }
  if (norm === 'FUNDAMENTAL' || norm.includes('FUNDAMENTAL')) {
    return 'FUNDAMENTAL'
  }

  return ''
}

/**
 * Parser de texto CSV com suporte a:
 * - Aspas duplas com vírgula ou newline dentro
 * - Vírgula ou ponto-e-vírgula como separador
 * - UTF-8 com BOM
 */
export function parseCsvTextToMatrix(text: string): string[][] {
  // Remover UTF-8 BOM se presente
  let clean = text
  if (clean.charCodeAt(0) === 0xfeff) {
    clean = clean.slice(1)
  }

  const lines = clean.split(/\r?\n/)
  if (lines.length === 0) return []

  // Detectar separador olhando a primeira linha não vazia
  const firstNonEmpty = lines.find((l) => l.trim().length > 0) || ''
  const semicolonCount = (firstNonEmpty.match(/;/g) || []).length
  const commaCount = (firstNonEmpty.match(/,/g) || []).length
  const delimiter = semicolonCount > commaCount ? ';' : ','

  const rows: string[][] = []
  let currentRow: string[] = []
  let currentField = ''
  let insideQuotes = false

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i]
    const nextChar = clean[i + 1]

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"'
        i++ // pula aspas escapadas
      } else {
        insideQuotes = !insideQuotes
      }
    } else if (char === delimiter && !insideQuotes) {
      currentRow.push(currentField.trim())
      currentField = ''
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++
      }
      currentRow.push(currentField.trim())
      // Só adiciona se houver algum conteúdo na linha
      if (currentRow.some((f) => f.length > 0)) {
        rows.push(currentRow)
      }
      currentRow = []
      currentField = ''
    } else {
      currentField += char
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim())
    if (currentRow.some((f) => f.length > 0)) {
      rows.push(currentRow)
    }
  }

  return rows
}

/**
 * Mapeia cabeçalhos para os campos esperados:
 * 'nome', 'tipo', 'rota', 'alunos', 'endereco', 'telefone', 'email'
 */
function findColumnIndexes(headerRow: string[]): {
  nomeIdx: number
  tipoIdx: number
  rotaIdx: number
  alunosIdx: number
  enderecoIdx: number
  telefoneIdx: number
  emailIdx: number
} {
  let nomeIdx = -1
  let tipoIdx = -1
  let rotaIdx = -1
  let alunosIdx = -1
  let enderecoIdx = -1
  let telefoneIdx = -1
  let emailIdx = -1

  headerRow.forEach((col, idx) => {
    const norm = normalizeName(col)
    if (
      nomeIdx === -1 &&
      (norm === 'nome' ||
        norm === 'escola' ||
        norm.includes('escola') ||
        norm.includes('instituic') ||
        norm.includes('unidade'))
    ) {
      nomeIdx = idx
    } else if (
      tipoIdx === -1 &&
      (norm === 'tipo' ||
        norm.includes('categoria') ||
        norm.includes('etapa') ||
        norm.includes('modalidade'))
    ) {
      tipoIdx = idx
    } else if (
      rotaIdx === -1 &&
      (norm === 'rota' || norm.includes('roteiro') || norm.includes('linha'))
    ) {
      rotaIdx = idx
    } else if (
      alunosIdx === -1 &&
      (norm === 'alunos' ||
        norm.includes('aluno') ||
        norm.includes('estudant') ||
        norm.includes('matricul') ||
        norm.includes('qtd'))
    ) {
      alunosIdx = idx
    } else if (
      enderecoIdx === -1 &&
      (norm === 'endereco' ||
        norm.includes('logradouro') ||
        norm.includes('rua') ||
        norm.includes('localizac'))
    ) {
      enderecoIdx = idx
    } else if (
      telefoneIdx === -1 &&
      (norm === 'telefone' ||
        norm.includes('contato') ||
        norm.includes('fone') ||
        norm.includes('celular') ||
        norm.includes('whatsapp'))
    ) {
      telefoneIdx = idx
    } else if (emailIdx === -1 && (norm === 'email' || norm.includes('correio'))) {
      emailIdx = idx
    }
  })

  // Se não achou por nome flexível, tentar posicionais caso tenha colunas padrão (pelo menos nome na 0)
  if (nomeIdx === -1 && headerRow.length >= 1) nomeIdx = 0
  if (tipoIdx === -1 && headerRow.length >= 2) tipoIdx = 1
  if (rotaIdx === -1 && headerRow.length >= 3) rotaIdx = 2
  if (alunosIdx === -1 && headerRow.length >= 4) alunosIdx = 3

  return { nomeIdx, tipoIdx, rotaIdx, alunosIdx, enderecoIdx, telefoneIdx, emailIdx }
}

export interface ExistingSchoolData {
  id: string
  nome: string
  tipo?: string
  rota?: string
  alunos?: number
  endereco?: string
  telefone?: string
  email?: string
}

/**
 * Executa o parsing e validação de um arquivo CSV ou XLSX enviado pelo usuário.
 * Identifica escolas existentes para atualização (upsert) em vez de ignorá-las.
 */
export async function parseSchoolsFile(
  file: File,
  existingMasterSchools: ExistingSchoolData[],
): Promise<CsvParseResult> {
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

  // Detectar se a primeira linha é cabeçalho
  const header = rawMatrix[0]
  const { nomeIdx, tipoIdx, rotaIdx, alunosIdx, enderecoIdx, telefoneIdx, emailIdx } =
    findColumnIndexes(header)

  const dataRows = rawMatrix.slice(1)
  if (dataRows.length === 0) {
    throw new Error('O arquivo contém apenas a linha de cabeçalho, sem dados.')
  }

  // Identificar quais colunas existem no cabeçalho
  const presentColumns = {
    tipo: tipoIdx !== -1,
    rota: rotaIdx !== -1,
    alunos: alunosIdx !== -1,
    endereco: enderecoIdx !== -1,
    telefone: telefoneIdx !== -1,
    email: emailIdx !== -1,
  }

  // Mapear escolas mestre existentes para normalização
  const masterSchoolsByNorm = new Map<string, ExistingSchoolData>()
  for (const s of existingMasterSchools) {
    const n = normalizeName(s.nome)
    if (n) {
      masterSchoolsByNorm.set(n, s)
    }
  }

  // Rastrear duplicidades dentro do próprio arquivo
  const seenInFile = new Map<string, number>() // normName -> firstRowIndex

  const allRows: ParsedCsvSchoolRow[] = []
  let duplicateMasterCount = 0
  let duplicateFileCount = 0
  let errorCount = 0

  dataRows.forEach((row, rowIdx) => {
    // Ignorar linhas totalmente vazias
    if (row.every((c) => !c || c.trim() === '')) return

    const rawNome = nomeIdx !== -1 && row[nomeIdx] !== undefined ? String(row[nomeIdx]).trim() : ''
    const rawTipo = tipoIdx !== -1 && row[tipoIdx] !== undefined ? String(row[tipoIdx]).trim() : ''
    const rawRota = rotaIdx !== -1 && row[rotaIdx] !== undefined ? String(row[rotaIdx]).trim() : ''
    const rawAlunos =
      alunosIdx !== -1 && row[alunosIdx] !== undefined ? String(row[alunosIdx]).trim() : ''
    const rawEndereco =
      enderecoIdx !== -1 && row[enderecoIdx] !== undefined ? String(row[enderecoIdx]).trim() : ''
    const rawTelefone =
      telefoneIdx !== -1 && row[telefoneIdx] !== undefined ? String(row[telefoneIdx]).trim() : ''
    const rawEmail =
      emailIdx !== -1 && row[emailIdx] !== undefined ? String(row[emailIdx]).trim() : ''

    const warnings: string[] = []
    let status: ParsedCsvSchoolRow['status'] = 'valid'
    let statusReason: string | undefined

    // 1. Validação de nome
    if (!rawNome) {
      status = 'error'
      statusReason = 'Nome da escola em branco ou inválido'
      errorCount++
      allRows.push({
        index: rowIdx + 2, // 1-based considerando cabeçalho na linha 1
        rawNome,
        rawTipo,
        rawRota,
        rawAlunos,
        rawEndereco,
        rawTelefone,
        rawEmail,
        nome: '',
        tipo: '',
        rota: rawRota || 'Sem Rota',
        presentColumns,
        status,
        statusReason,
        warnings,
      })
      return
    }

    const normNome = normalizeName(rawNome)

    // 2. Validação de duplicidade contra o arquivo
    if (seenInFile.has(normNome)) {
      status = 'duplicate_file'
      statusReason = `Duplicada no próprio arquivo (já apareceu na linha ${seenInFile.get(normNome)})`
      duplicateFileCount++
    } else {
      seenInFile.set(normNome, rowIdx + 2)
    }

    // 3. Mapeamento de tipo
    const mappedTipo = normalizeEscolaTipo(rawTipo)
    if (rawTipo && !mappedTipo) {
      warnings.push(
        `Tipo "${rawTipo}" não reconhecido como CMEI, CRECHE, INTEGRAL ou FUNDAMENTAL. Campo ficará vazio.`,
      )
    }

    // 4. Mapeamento de alunos
    let mappedAlunos: number | undefined
    if (rawAlunos) {
      const parsedAlunos = parsePtBrNumber(rawAlunos)
      if (!parsedAlunos.isValid || parsedAlunos.value < 0) {
        warnings.push(`Número de alunos "${rawAlunos}" não numérico.`)
      } else {
        mappedAlunos = Math.round(parsedAlunos.value)
      }
    }

    // 5. Rota padrão
    const mappedRota = rawRota || 'Sem Rota'

    // 6. Endereço, telefone e e-mail
    const mappedEndereco = rawEndereco || undefined
    const mappedTelefone = rawTelefone || undefined
    const mappedEmail = rawEmail || undefined

    // 7. Verificação contra o banco mestre: se já existe, vira 'update' (upsert)
    let existingSchoolId: string | undefined
    let existingSchoolName: string | undefined
    const fieldChanges: SchoolFieldChange[] = []

    if (status === 'valid') {
      const existing = masterSchoolsByNorm.get(normNome)
      if (existing) {
        status = 'update'
        existingSchoolId = existing.id
        existingSchoolName = existing.nome
        statusReason = `Escola existente no cadastro mestre ("${existing.nome}"). Os dados serão atualizados.`

        // Detectar o que mudará
        if (presentColumns.tipo) {
          const oldT = existing.tipo || ''
          const newT = mappedTipo || ''
          if (oldT !== newT) {
            fieldChanges.push({
              field: 'tipo',
              label: 'Tipo',
              oldValue: oldT || '(vazio)',
              newValue: newT || '(vazio)',
            })
          }
        }

        if (presentColumns.rota && rawRota) {
          const oldR = existing.rota || ''
          const newR = mappedRota
          if (oldR !== newR) {
            fieldChanges.push({
              field: 'rota',
              label: 'Rota',
              oldValue: oldR || '(sem rota)',
              newValue: newR,
            })
          }
        }

        if (presentColumns.alunos && mappedAlunos !== undefined) {
          const oldA =
            existing.alunos !== undefined && existing.alunos !== null ? String(existing.alunos) : ''
          const newA = String(mappedAlunos)
          if (oldA !== newA) {
            fieldChanges.push({
              field: 'alunos',
              label: 'Alunos',
              oldValue: oldA || '(vazio)',
              newValue: newA,
            })
          }
        }

        if (presentColumns.endereco && mappedEndereco) {
          const oldEnd = existing.endereco || ''
          const newEnd = mappedEndereco
          if (oldEnd !== newEnd) {
            fieldChanges.push({
              field: 'endereco',
              label: 'Endereço',
              oldValue: oldEnd || '(vazio)',
              newValue: newEnd,
            })
          }
        }

        if (presentColumns.telefone && mappedTelefone) {
          const oldTel = existing.telefone || ''
          const newTel = mappedTelefone
          if (oldTel !== newTel) {
            fieldChanges.push({
              field: 'telefone',
              label: 'Telefone',
              oldValue: oldTel || '(vazio)',
              newValue: newTel,
            })
          }
        }

        if (presentColumns.email && mappedEmail) {
          const oldMail = existing.email || ''
          const newMail = mappedEmail
          if (oldMail !== newMail) {
            fieldChanges.push({
              field: 'email',
              label: 'E-mail',
              oldValue: oldMail || '(vazio)',
              newValue: newMail,
            })
          }
        }
      }
    }

    allRows.push({
      index: rowIdx + 2,
      rawNome,
      rawTipo,
      rawRota,
      rawAlunos,
      rawEndereco,
      rawTelefone,
      rawEmail,
      nome: rawNome,
      tipo: mappedTipo,
      rota: mappedRota,
      alunos: mappedAlunos,
      endereco: mappedEndereco,
      telefone: mappedTelefone,
      email: mappedEmail,
      existingSchoolId,
      existingSchoolName,
      fieldChanges,
      presentColumns,
      status,
      statusReason,
      warnings,
    })
  })

  const validRows = allRows.filter((r) => r.status === 'valid')
  const updateRows = allRows.filter((r) => r.status === 'update')

  return {
    fileName: file.name,
    totalRows: allRows.length,
    validRows,
    updateRows,
    duplicateMasterCount,
    duplicateFileCount,
    errorCount,
    allRows,
  }
}
