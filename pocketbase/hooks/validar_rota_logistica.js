// Hook de validação de unicidade de nome para rotas_logisticas dentro do mesmo contrato
// Disparado antes de criar ou atualizar registros em rotas_logisticas.
// A comparação é case-insensitive e ignora espaços extras nas pontas e internos múltiplos.

onRecordCreate((e) => {
  const record = e.record
  const col = record.collection()
  if (col.name !== 'rotas_logisticas') {
    return e.next()
  }

  const rawNome = record.getString('nome') || ''
  const cleanNome = rawNome.trim().replace(/\s+/g, ' ')
  const contratoId = record.getString('contrato_id') || ''

  if (!cleanNome) {
    throw new BadRequestError('O nome da rota logística é obrigatório.')
  }

  if (!contratoId) {
    throw new BadRequestError('O contrato da rota logística é obrigatório.')
  }

  // Normalizar para gravação limpa
  record.set('nome', cleanNome)

  // Buscar todas as rotas do mesmo contrato para comparar case-insensitive e trim
  const existingRotas = $app.findRecordsByFilter(
    'rotas_logisticas',
    'contrato_id = {:contratoId}',
    'ordem',
    0,
    0,
    { contratoId: contratoId },
  )

  const lowerTarget = cleanNome.toLowerCase()
  for (let i = 0; i < existingRotas.length; i++) {
    const existing = existingRotas[i]
    if (existing.id === record.id) continue

    const existingNomeNorm = (existing.getString('nome') || '').trim().replace(/\s+/g, ' ').toLowerCase()
    if (existingNomeNorm === lowerTarget) {
      throw new BadRequestError('Já existe uma rota logística com este nome neste contrato.')
    }
  }

  return e.next()
}, 'rotas_logisticas')

onRecordUpdate((e) => {
  const record = e.record
  const col = record.collection()
  if (col.name !== 'rotas_logisticas') {
    return e.next()
  }

  const rawNome = record.getString('nome') || ''
  const cleanNome = rawNome.trim().replace(/\s+/g, ' ')
  const contratoId = record.getString('contrato_id') || ''

  if (!cleanNome) {
    throw new BadRequestError('O nome da rota logística é obrigatório.')
  }

  if (!contratoId) {
    throw new BadRequestError('O contrato da rota logística é obrigatório.')
  }

  // Normalizar para gravação limpa
  record.set('nome', cleanNome)

  // Buscar todas as rotas do mesmo contrato para comparar case-insensitive e trim
  const existingRotas = $app.findRecordsByFilter(
    'rotas_logisticas',
    'contrato_id = {:contratoId}',
    'ordem',
    0,
    0,
    { contratoId: contratoId },
  )

  const lowerTarget = cleanNome.toLowerCase()
  for (let i = 0; i < existingRotas.length; i++) {
    const existing = existingRotas[i]
    if (existing.id === record.id) continue

    const existingNomeNorm = (existing.getString('nome') || '').trim().replace(/\s+/g, ' ').toLowerCase()
    if (existingNomeNorm === lowerTarget) {
      throw new BadRequestError('Já existe uma rota logística com este nome neste contrato.')
    }
  }

  return e.next()
}, 'rotas_logisticas')
