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

  async delete(id: string): Promise<boolean> {
    return await pb.collection('escolas').delete(id)
  },
}
