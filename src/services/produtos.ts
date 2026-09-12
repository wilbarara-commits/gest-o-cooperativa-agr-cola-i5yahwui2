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

  async createBatch(
    items: Array<Partial<ProdutoRecord>>,
    onProgress?: (processed: number, total: number) => void,
  ): Promise<{ created: number; errors: Array<{ index: number; nome: string; error: string }> }> {
    let created = 0
    const errors: Array<{ index: number; nome: string; error: string }> = []

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const nomeStr = item.nome || `Item ${i + 1}`
      try {
        await pb.collection('produtos').create<ProdutoRecord>({
          ...item,
          essencial: item.essencial ?? false,
          disponibilidade: item.disponibilidade || 'normal',
        })
        created++
      } catch (err: any) {
        console.error(`Erro ao salvar produto [${nomeStr}]:`, err)
        const msg = err?.response?.message || err?.message || 'Falha ao salvar produto'
        errors.push({ index: i, nome: nomeStr, error: msg })
      }
      onProgress?.(i + 1, items.length)
    }

    return { created, errors }
  },

  async findByNameNormalized(nome: string): Promise<ProdutoRecord | null> {
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
    return all.find((p) => norm(p.nome) === target) || null
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
