import pb from '@/lib/pocketbase/client'
import type { ProdutoRecord } from '@/lib/types'

export const produtosService = {
  async getAll(): Promise<ProdutoRecord[]> {
    return await pb.collection('produtos').getFullList<ProdutoRecord>({
      sort: 'nome',
    })
  },

  async getById(id: string): Promise<ProdutoRecord> {
    return await pb.collection('produtos').getOne<ProdutoRecord>(id)
  },

  async create(data: Partial<ProdutoRecord>): Promise<ProdutoRecord> {
    return await pb.collection('produtos').create<ProdutoRecord>({
      ...data,
      essencial: data.essencial || false,
      disponibilidade: data.disponibilidade || 'normal',
    })
  },

  async update(id: string, data: Partial<ProdutoRecord>): Promise<ProdutoRecord> {
    return await pb.collection('produtos').update<ProdutoRecord>(id, data)
  },

  async delete(id: string): Promise<boolean> {
    return await pb.collection('produtos').delete(id)
  },

  async bulkAdjustPrices(percentage: number): Promise<void> {
    const prods = await this.getAll()
    const factor = 1 + percentage / 100
    for (const p of prods) {
      const newPrice = Math.round(p.preco_unitario * factor * 100) / 100
      await pb.collection('produtos').update(p.id, {
        preco_unitario: Math.max(0, newPrice),
      })
    }
  },
}
