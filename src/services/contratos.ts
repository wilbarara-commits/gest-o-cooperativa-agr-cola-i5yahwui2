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
}
