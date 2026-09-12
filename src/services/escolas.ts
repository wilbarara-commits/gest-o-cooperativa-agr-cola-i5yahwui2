import pb from '@/lib/pocketbase/client'
import type { EscolaRecord } from '@/lib/types'

export const escolasService = {
  async getAll(): Promise<EscolaRecord[]> {
    return await pb.collection('escolas').getFullList<EscolaRecord>({
      sort: 'nome',
    })
  },

  async getById(id: string): Promise<EscolaRecord> {
    return await pb.collection('escolas').getOne<EscolaRecord>(id)
  },

  async create(data: Omit<EscolaRecord, 'id' | 'created' | 'updated'>): Promise<EscolaRecord> {
    return await pb.collection('escolas').create<EscolaRecord>(data)
  },

  async createBatch(
    items: Array<Omit<EscolaRecord, 'id' | 'created' | 'updated'>>,
    onProgress?: (processed: number, total: number) => void,
  ): Promise<{ created: number; errors: Array<{ index: number; nome: string; error: string }> }> {
    let created = 0
    const errors: Array<{ index: number; nome: string; error: string }> = []

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      try {
        await pb.collection('escolas').create<EscolaRecord>(item)
        created++
      } catch (err: any) {
        console.error(`Erro ao salvar escola [${item.nome}]:`, err)
        const msg = err?.response?.message || err?.message || 'Falha ao salvar'
        errors.push({ index: i, nome: item.nome, error: msg })
      }
      onProgress?.(i + 1, items.length)
    }

    return { created, errors }
  },

  async importBatch(
    items: Array<{
      action: 'create' | 'update'
      id?: string
      nome: string
      tipo?: string
      rota?: string
      alunos?: number
      endereco?: string
      telefone?: string
      email?: string
      // Colunas que estavam presentes no arquivo
      presentColumns?: {
        tipo: boolean
        rota: boolean
        alunos: boolean
        endereco: boolean
        telefone: boolean
        email: boolean
      }
    }>,
    mode: 'merge' | 'overwrite', // 'merge' = atualiza apenas preenchidos, 'overwrite' = sobrescreve
    onProgress?: (processed: number, total: number) => void,
  ): Promise<{
    created: number
    updated: number
    errors: Array<{ index: number; nome: string; error: string }>
  }> {
    let created = 0
    let updated = 0
    const errors: Array<{ index: number; nome: string; error: string }> = []

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      try {
        if (item.action === 'create') {
          const payload: any = {
            nome: item.nome,
            tipo: item.tipo || '',
            rota: item.rota || 'Sem Rota',
            endereco: item.endereco || '',
            telefone: item.telefone || '',
            email: item.email || '',
          }
          if (item.alunos !== undefined) {
            payload.alunos = item.alunos
          }
          await pb.collection('escolas').create<EscolaRecord>(payload)
          created++
        } else if (item.action === 'update' && item.id) {
          const payload: any = {}

          if (mode === 'overwrite') {
            // Sobrescreve campos existentes com os valores do arquivo caso a coluna exista
            if (item.presentColumns?.tipo) payload.tipo = item.tipo || ''
            if (item.presentColumns?.rota) payload.rota = item.rota || 'Sem Rota'
            if (item.presentColumns?.alunos)
              payload.alunos = item.alunos !== undefined ? item.alunos : null
            if (item.presentColumns?.endereco) payload.endereco = item.endereco || ''
            if (item.presentColumns?.telefone) payload.telefone = item.telefone || ''
            if (item.presentColumns?.email) payload.email = item.email || ''
          } else {
            // 'merge': grava o campo apenas quando a coluna existir no CSV e tiver valor não vazio
            if (item.presentColumns?.tipo && item.tipo) {
              payload.tipo = item.tipo
            }
            if (item.presentColumns?.rota && item.rota && item.rota !== 'Sem Rota') {
              payload.rota = item.rota
            }
            if (item.presentColumns?.alunos && item.alunos !== undefined) {
              payload.alunos = item.alunos
            }
            if (item.presentColumns?.endereco && item.endereco && item.endereco.trim()) {
              payload.endereco = item.endereco.trim()
            }
            if (item.presentColumns?.telefone && item.telefone && item.telefone.trim()) {
              payload.telefone = item.telefone.trim()
            }
            if (item.presentColumns?.email && item.email && item.email.trim()) {
              payload.email = item.email.trim()
            }
          }

          // Se tiver pelo menos um campo para alterar, faz o update
          if (Object.keys(payload).length > 0) {
            await pb.collection('escolas').update<EscolaRecord>(item.id, payload)
          }
          updated++
        }
      } catch (err: any) {
        console.error(`Erro ao processar escola [${item.nome}]:`, err)
        const msg = err?.response?.message || err?.message || 'Falha ao processar'
        errors.push({ index: i, nome: item.nome, error: msg })
      }
      onProgress?.(i + 1, items.length)
    }

    return { created, updated, errors }
  },

  async update(id: string, data: Partial<EscolaRecord>): Promise<EscolaRecord> {
    return await pb.collection('escolas').update<EscolaRecord>(id, data)
  },

  async findByNameNormalized(nome: string): Promise<EscolaRecord | null> {
    const all = await this.getAll()
    const norm = (str: string) =>
      str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^\w\s]/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim()

    const target = norm(nome)
    if (!target) return null
    return all.find((e) => norm(e.nome) === target) || null
  },

  async delete(id: string): Promise<boolean> {
    return await pb.collection('escolas').delete(id)
  },

  async checkDependencies(id: string): Promise<{ contractsCount: number; ordersCount: number }> {
    const [contractEscolas, orders] = await Promise.all([
      pb.collection('contrato_escolas').getList(1, 1, { filter: `escola_id = "${id}"` }),
      pb.collection('pedidos').getList(1, 1, { filter: `escola_id = "${id}"` }),
    ])
    return {
      contractsCount: contractEscolas.totalItems,
      ordersCount: orders.totalItems,
    }
  },
}
