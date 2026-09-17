import type { EscolaTipo, School, Contract } from '@/lib/types'
import { normalizeName } from '@/lib/excelImporter'
import { normalizeEscolaTipo, parseCsvTextToMatrix } from '@/lib/schoolCsvImporter'
import { parsePtBrNumber } from '@/lib/numberParser'
import * as XLSX from 'xlsx'

export interface ContractSchoolFieldChange {
  field: 'tipo' | 'alunos' | 'endereco' | 'telefone' | 'email'
  label: string
  oldValue: string
  newValue: string
}

export interface ParsedContractSchoolRow {
  index: number
  rawNome: string
  rawTipo: string
  rawRota: string
  rawAlunos: string
  rawEndereco: string
  rawTelefone: string
  rawEmail: string

  // Dados mapeados / normalizados
  nome: string
  tipo: EscolaTipo | ''
  alunos?: number
  endereco?: string
  telefone?: string
  email?: string

  // Rota da planilha atribuída pelo importador para o vínculo
  assignedRota: string

  // Informações de casamento no cadastro mestre global
  existingSchoolId?: string
  existingSchoolName?: string
  fieldChanges: ContractSchoolFieldChange[]

  // Vínculos com contratos
  linkedToCurrentContract: boolean
  linkedToOtherContract: boolean
  otherContractNumber?: string
  otherContractId?: string

  // Present columns
  presentColumns: {
    tipo: boolean
    alunos: boolean
    endereco: boolean
    telefone: boolean
    email: boolean
  }

  /**
   * Status da linha:
   * - 'create_and_link': Escola nova no mestre global -> cria escola e vincula a este contrato com a rota
   * - 'update_and_link': Escola já existe no mestre global e ainda não tem vínculo com nenhum contrato -> atualiza dados e vincula a este contrato com a rota
   * - 'update_current_link': Escola já existe e já está vinculada a ESTE contrato -> atualiza dados da escola e rota do vínculo
   * - 'conflict_other_contract': Escola já está vinculada a OUTRO contrato -> FALHA para essa escola, exige desvínculo prévio
   * - 'duplicate_file': Escola repetida no mesmo arquivo CSV/planilha
   * - 'error': Nome inválido ou em branco
   */
  status:
    | 'create_and_link'
    | 'update_and_link'
    | 'update_current_link'
    | 'conflict_other_contract'
    | 'duplicate_file'
    | 'error'

  statusReason?: string
  warnings: string[]
}

export interface ContractSchoolParseResult {
  fileName: string
  totalRows: number
  selectedRota: string

  createAndLinkRows: ParsedContractSchoolRow[]
  updateAndLinkRows: ParsedContractSchoolRow[]
  updateCurrentLinkRows: ParsedContractSchoolRow[]
  conflictOtherContractRows: ParsedContractSchoolRow[]
  duplicateFileRows: ParsedContractSchoolRow[]
  errorRows: ParsedContractSchoolRow[]

  // Processáveis (tudo que pode ser aplicado com sucesso)
  processableRows: ParsedContractSchoolRow[]

  allRows: ParsedContractSchoolRow[]
}

/**
 * Localiza índices de colunas com tolerância a cabeçalhos
 */
function findContractSchoolColumnIndexes(headerRow: string[]): {
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

  // Se não achou por nome flexível, tentar posicionais básicas se houver ao menos 1 coluna
  if (nomeIdx === -1 && headerRow.length >= 1) nomeIdx = 0
  if (tipoIdx === -1 && headerRow.length >= 2) tipoIdx = 1
  if (rotaIdx === -1 && headerRow.length >= 3) rotaIdx = 2
  if (alunosIdx === -1 && headerRow.length >= 4) alunosIdx = 3

  return { nomeIdx, tipoIdx, rotaIdx, alunosIdx, enderecoIdx, telefoneIdx, emailIdx }
}

export interface ParseContractSchoolsOptions {
  /**
   * Arquivo enviado (.csv ou .xlsx) ou string colada
   */
  fileOrText: File | string
  fileName?: string
  /**
   * Rota da Planilha deste contrato selecionada pelo usuário
   */
  selectedRota: string
  /**
   * ID do contrato atual (pode ser undefined se estiver criando contrato novo ainda não salvo)
   */
  currentContractId?: string
  /**
   * Lista de escolas vinculadas atualmente no form do contrato atual
   */
  currentContractSchoolIds?: Set<string>
  /**
   * Todas as escolas do cadastro mestre global
   */
  masterSchools: School[]
  /**
   * Todos os contratos vigentes do sistema com seus vínculos
   */
  allContracts: Contract[]
}

/**
 * Analisa e valida uma matriz de dados de escolas para importação dentro do contrato,
 * aplicando com rigor as 6 regras solicitadas:
 * 1. Atribuir a Rota da Planilha escolhida no vínculo.
 * 2. Casar tolerante por nome normalizado contra o cadastro mestre e atualizar dados.
 * 3. A rota da planilha é gravada no VÍNCULO (contrato_escolas.rota), não na tabela escolas.
 * 4. Se a escola não existir no cadastro global: criá-la e vinculá-la ao contrato com a rota.
 * 5. Se já estiver vinculada a OUTRO contrato: FALHAR para essa escola com mensagem clara, mantendo as demais válidas no preview de pendências.
 * 6. Se já estiver vinculada a ESTE contrato: atualizar dados e rota da planilha do vínculo (sem duplicar vínculo).
 */
export async function parseContractSchoolsMatrix(
  options: ParseContractSchoolsOptions,
): Promise<ContractSchoolParseResult> {
  const {
    fileOrText,
    fileName = 'dados_colados.csv',
    selectedRota,
    currentContractId,
    currentContractSchoolIds = new Set<string>(),
    masterSchools,
    allContracts,
  } = options

  let rawMatrix: string[][] = []

  if (typeof fileOrText === 'string') {
    rawMatrix = parseCsvTextToMatrix(fileOrText)
  } else {
    const isExcel =
      fileOrText.name.endsWith('.xlsx') ||
      fileOrText.name.endsWith('.xls') ||
      fileOrText.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      fileOrText.type === 'application/vnd.ms-excel'

    if (isExcel) {
      const buffer = await fileOrText.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const firstSheetName = workbook.SheetNames[0]
      if (!firstSheetName) {
        throw new Error('Arquivo de planilha não contém nenhuma aba.')
      }
      const worksheet = workbook.Sheets[firstSheetName]
      const sheetData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' })
      rawMatrix = sheetData.map((row) => row.map((cell) => String(cell ?? '').trim()))
    } else {
      const text = await fileOrText.text()
      rawMatrix = parseCsvTextToMatrix(text)
    }
  }

  if (rawMatrix.length === 0) {
    throw new Error('Nenhum dado encontrado para importar.')
  }

  // Detectar cabeçalho
  const header = rawMatrix[0]
  const { nomeIdx, tipoIdx, alunosIdx, enderecoIdx, telefoneIdx, emailIdx } =
    findContractSchoolColumnIndexes(header)

  const dataRows = rawMatrix.slice(1)
  if (dataRows.length === 0) {
    throw new Error('O arquivo contém apenas a linha de cabeçalho, sem dados de escolas.')
  }

  const presentColumns = {
    tipo: tipoIdx !== -1,
    alunos: alunosIdx !== -1,
    endereco: enderecoIdx !== -1,
    telefone: telefoneIdx !== -1,
    email: emailIdx !== -1,
  }

  // Mapa de escolas mestre por nome normalizado
  const masterByNorm = new Map<string, School>()
  for (const s of masterSchools) {
    const norm = normalizeName(s.name)
    if (norm) {
      masterByNorm.set(norm, s)
    }
  }

  // Mapa de qual escola está vinculada a qual contrato
  // escolaId -> { contratoId: string; contratoNumero: string }
  const schoolContractMap = new Map<string, { contratoId: string; contratoNumero: string }>()
  for (const c of allContracts) {
    for (const esc of c.escolas) {
      if (esc.escolaId) {
        schoolContractMap.set(esc.escolaId, {
          contratoId: c.id,
          contratoNumero: c.numero,
        })
      }
    }
  }

  // Rastrear duplicidade dentro do arquivo
  const seenInFile = new Map<string, number>()

  const allRows: ParsedContractSchoolRow[] = []

  dataRows.forEach((row, rowIdx) => {
    // Ignorar linhas em branco
    if (row.every((c) => !c || c.trim() === '')) return

    const rawNome = nomeIdx !== -1 && row[nomeIdx] !== undefined ? String(row[nomeIdx]).trim() : ''
    const rawTipo = tipoIdx !== -1 && row[tipoIdx] !== undefined ? String(row[tipoIdx]).trim() : ''
    const rawRota = '' // Rota vem da opção selectedRota do importador
    const rawAlunos =
      alunosIdx !== -1 && row[alunosIdx] !== undefined ? String(row[alunosIdx]).trim() : ''
    const rawEndereco =
      enderecoIdx !== -1 && row[enderecoIdx] !== undefined ? String(row[enderecoIdx]).trim() : ''
    const rawTelefone =
      telefoneIdx !== -1 && row[telefoneIdx] !== undefined ? String(row[telefoneIdx]).trim() : ''
    const rawEmail =
      emailIdx !== -1 && row[emailIdx] !== undefined ? String(row[emailIdx]).trim() : ''

    const warnings: string[] = []
    let status: ParsedContractSchoolRow['status'] = 'create_and_link'
    let statusReason: string | undefined

    // 1. Validação do Nome
    if (!rawNome) {
      allRows.push({
        index: rowIdx + 2,
        rawNome,
        rawTipo,
        rawRota,
        rawAlunos,
        rawEndereco,
        rawTelefone,
        rawEmail,
        nome: '',
        tipo: '',
        assignedRota: selectedRota || '',
        fieldChanges: [],
        linkedToCurrentContract: false,
        linkedToOtherContract: false,
        presentColumns,
        status: 'error',
        statusReason: 'Nome da instituição em branco ou inválido na linha.',
        warnings,
      })
      return
    }

    const normNome = normalizeName(rawNome)

    // 2. Duplicidade no arquivo
    if (seenInFile.has(normNome)) {
      status = 'duplicate_file'
      statusReason = `Duplicada no próprio arquivo (já apareceu na linha ${seenInFile.get(normNome)}).`
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
        tipo: normalizeEscolaTipo(rawTipo),
        assignedRota: selectedRota || '',
        fieldChanges: [],
        linkedToCurrentContract: false,
        linkedToOtherContract: false,
        presentColumns,
        status,
        statusReason,
        warnings,
      })
      return
    } else {
      seenInFile.set(normNome, rowIdx + 2)
    }

    // 3. Normalização de campos
    const mappedTipo = normalizeEscolaTipo(rawTipo)
    if (rawTipo && !mappedTipo) {
      warnings.push(
        `Tipo "${rawTipo}" não reconhecido (esperado CMEI, CRECHE, INTEGRAL ou FUNDAMENTAL).`,
      )
    }

    let mappedAlunos: number | undefined
    if (rawAlunos) {
      // Suporte a números no padrão pt-BR (ex.: "1.250", "350")
      const parsedAlunos = parsePtBrNumber(rawAlunos)
      if (!parsedAlunos.isValid || parsedAlunos.value < 0) {
        warnings.push(`Número de alunos "${rawAlunos}" inválido.`)
      } else {
        mappedAlunos = Math.round(parsedAlunos.value)
      }
    }

    const mappedEndereco = rawEndereco || undefined
    const mappedTelefone = rawTelefone || undefined
    const mappedEmail = rawEmail || undefined

    // 4. Casamento com o cadastro mestre global
    const existingMaster = masterByNorm.get(normNome)
    let existingSchoolId = existingMaster?.id
    let existingSchoolName = existingMaster?.name
    const fieldChanges: ContractSchoolFieldChange[] = []

    let linkedToCurrentContract = false
    let linkedToOtherContract = false
    let otherContractNumber: string | undefined
    let otherContractId: string | undefined

    if (existingMaster) {
      // Comparar alterações em relação ao cadastro existente
      if (presentColumns.tipo && mappedTipo && mappedTipo !== existingMaster.tipo) {
        fieldChanges.push({
          field: 'tipo',
          label: 'Tipo',
          oldValue: existingMaster.tipo || '(vazio)',
          newValue: mappedTipo,
        })
      }
      if (
        presentColumns.alunos &&
        mappedAlunos !== undefined &&
        mappedAlunos !== existingMaster.alunos
      ) {
        fieldChanges.push({
          field: 'alunos',
          label: 'Alunos',
          oldValue: existingMaster.alunos !== undefined ? String(existingMaster.alunos) : '(vazio)',
          newValue: String(mappedAlunos),
        })
      }
      if (presentColumns.endereco && mappedEndereco && mappedEndereco !== existingMaster.address) {
        fieldChanges.push({
          field: 'endereco',
          label: 'Endereço',
          oldValue: existingMaster.address || '(vazio)',
          newValue: mappedEndereco,
        })
      }
      if (presentColumns.telefone && mappedTelefone && mappedTelefone !== existingMaster.contact) {
        fieldChanges.push({
          field: 'telefone',
          label: 'Telefone',
          oldValue: existingMaster.contact || '(vazio)',
          newValue: mappedTelefone,
        })
      }
      if (presentColumns.email && mappedEmail && mappedEmail !== existingMaster.email) {
        fieldChanges.push({
          field: 'email',
          label: 'E-mail',
          oldValue: existingMaster.email || '(vazio)',
          newValue: mappedEmail,
        })
      }

      // Checar vínculos da escola existente
      // A) Já está vinculada a ESTE contrato (seja pelo ID salvo ou pelo formulário em edição)?
      const isLinkedToCurrent =
        (currentContractId &&
          schoolContractMap.get(existingMaster.id)?.contratoId === currentContractId) ||
        currentContractSchoolIds.has(existingMaster.id)

      if (isLinkedToCurrent) {
        linkedToCurrentContract = true
        status = 'update_current_link'
        statusReason = `Já vinculada a este contrato. Os dados cadastrais da escola e a rota da planilha no vínculo serão atualizados.`
      } else {
        // B) Checar se está vinculada a OUTRO contrato
        const otherLink = schoolContractMap.get(existingMaster.id)
        if (otherLink && (!currentContractId || otherLink.contratoId !== currentContractId)) {
          linkedToOtherContract = true
          otherContractNumber = otherLink.contratoNumero
          otherContractId = otherLink.contratoId
          status = 'conflict_other_contract'
          statusReason = `Escola vinculada ao Contrato "${otherLink.contratoNumero}". É necessário desvinculá-la do contrato anterior antes de vincular a este contrato.`
        } else {
          // C) Existe no mestre mas está livre (sem contrato ou vinculando agora)
          status = 'update_and_link'
          statusReason = `Escola encontrada no cadastro mestre global. Os dados serão atualizados e a escola será vinculada a este contrato com a rota "${selectedRota || 'Sem Rota'}".`
        }
      }
    } else {
      // Escola não existe no mestre global
      status = 'create_and_link'
      statusReason = `Escola nova. Será criada no cadastro mestre global e vinculada a este contrato com a rota "${selectedRota || 'Sem Rota'}".`
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
      alunos: mappedAlunos,
      endereco: mappedEndereco,
      telefone: mappedTelefone,
      email: mappedEmail,
      assignedRota: selectedRota || '',
      existingSchoolId,
      existingSchoolName,
      fieldChanges,
      linkedToCurrentContract,
      linkedToOtherContract,
      otherContractNumber,
      otherContractId,
      presentColumns,
      status,
      statusReason,
      warnings,
    })
  })

  const createAndLinkRows = allRows.filter((r) => r.status === 'create_and_link')
  const updateAndLinkRows = allRows.filter((r) => r.status === 'update_and_link')
  const updateCurrentLinkRows = allRows.filter((r) => r.status === 'update_current_link')
  const conflictOtherContractRows = allRows.filter((r) => r.status === 'conflict_other_contract')
  const duplicateFileRows = allRows.filter((r) => r.status === 'duplicate_file')
  const errorRows = allRows.filter((r) => r.status === 'error')

  // Linhas processáveis (que serão efetivamente gravadas / vinculadas)
  const processableRows = allRows.filter(
    (r) =>
      r.status === 'create_and_link' ||
      r.status === 'update_and_link' ||
      r.status === 'update_current_link',
  )

  const finalName = typeof fileOrText === 'string' ? 'dados_colados' : fileOrText.name

  return {
    fileName: finalName,
    totalRows: allRows.length,
    selectedRota,
    createAndLinkRows,
    updateAndLinkRows,
    updateCurrentLinkRows,
    conflictOtherContractRows,
    duplicateFileRows,
    errorRows,
    processableRows,
    allRows,
  }
}
