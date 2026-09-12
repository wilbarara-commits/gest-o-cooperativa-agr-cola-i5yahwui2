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
