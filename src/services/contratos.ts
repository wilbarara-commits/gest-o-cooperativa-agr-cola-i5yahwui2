import pb from '@/lib/pocketbase/client'
import type { ContratoRecord, ContratoItemRecord } from '@/lib/types'

export const contratosService = {
  async getAll(): Promise<ContratoRecord[]> {
    return await pb.collection('contratos').getFullList<ContratoRecord>({
      expand: 'instituicao_id',
      sort: '-created',
    })
  },

  async getItems(contratoId: string): Promise<ContratoItemRecord[]> {
    return await pb.collection('contrato_itens').getFullList<ContratoItemRecord>({
      filter: `contrato_id = "${contratoId}"`,
      expand: 'produto_id',
    })
  },

  async create(data: {
    numero: string
    tipo?: string
    instituicao_id: string
    valor_total: number
    status: 'Ativo' | 'Encerrado' | 'Pendente'
  }): Promise<ContratoRecord> {
    return await pb.collection('contratos').create<ContratoRecord>(data)
  },

  async update(id: string, data: Partial<ContratoRecord>): Promise<ContratoRecord> {
    return await pb.collection('contratos').update<ContratoRecord>(id, data)
  },

  async delete(id: string): Promise<boolean> {
    // Delete associated contract items first
    const items = await pb.collection('contrato_itens').getFullList<ContratoItemRecord>({
      filter: `contrato_id = "${id}"`,
    })
    for (const item of items) {
      await pb.collection('contrato_itens').delete(item.id)
    }
    return await pb.collection('contratos').delete(id)
  },

  async syncItems(
    contratoId: string,
    items: Array<{ id?: string; produto_id: string; preco: number }>,
  ): Promise<void> {
    const existingItems = await pb.collection('contrato_itens').getFullList<ContratoItemRecord>({
      filter: `contrato_id = "${contratoId}"`,
    })

    const existingMap = new Map(existingItems.map((item) => [item.id, item]))
    const keptItemIds = new Set<string>()

    for (const item of items) {
      if (item.id && existingMap.has(item.id)) {
        keptItemIds.add(item.id)
        const current = existingMap.get(item.id)!
        if (current.produto_id !== item.produto_id || current.preco !== item.preco) {
          await pb.collection('contrato_itens').update(item.id, {
            produto_id: item.produto_id,
            preco: item.preco,
          })
        }
      } else {
        const created = await pb.collection('contrato_itens').create<ContratoItemRecord>({
          contrato_id: contratoId,
          produto_id: item.produto_id,
          preco: item.preco,
        })
        keptItemIds.add(created.id)
      }
    }

    // Delete items that were removed
    for (const item of existingItems) {
      if (!keptItemIds.has(item.id)) {
        await pb.collection('contrato_itens').delete(item.id)
      }
    }
  },
}
