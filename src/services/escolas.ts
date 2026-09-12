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
