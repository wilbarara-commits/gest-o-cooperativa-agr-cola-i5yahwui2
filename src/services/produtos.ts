import pb from '@/lib/pocketbase/client'
import type { ProdutoRecord } from '@/lib/types'

export const produtosService = {
  async getAll(): Promise<ProdutoRecord[]> {
    return await pb.collection('produtos').getFullList<ProdutoRecord>({
      sort: 'nome',
    })
  },

  async create(data: Omit<ProdutoRecord, 'id' | 'created' | 'updated'>): Promise<ProdutoRecord> {
    return await pb.collection('produtos').create<ProdutoRecord>(data)
  },

  async update(id: string, data: Partial<ProdutoRecord>): Promise<ProdutoRecord> {
    return await pb.collection('produtos').update<ProdutoRecord>(id, data)
  },

  async delete(id: string): Promise<boolean> {
    return await pb.collection('produtos').delete(id)
  },

  async bulkAdjustPrices(percentage: number): Promise<void> {
    const list = await this.getAll()
    for (const item of list) {
      const currentPrice = Number(item.preco_unitario) || 0
      const newPrice = Math.round(currentPrice * (1 + percentage / 100) * 100) / 100
      await pb.collection('produtos').update(item.id, { preco_unitario: newPrice })
    }
  },
}
