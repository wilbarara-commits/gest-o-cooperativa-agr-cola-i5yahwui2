import pb from '@/lib/pocketbase/client'
import type { AtestoRecord } from '@/lib/types'

export const atestosService = {
  async getAll(): Promise<AtestoRecord[]> {
    return await pb.collection('atestos').getFullList<AtestoRecord>({
      expand: 'pedido_id,pedido_id.escola_id',
      sort: '-data_emissao',
    })
  },

  async create(data: {
    numero: string
    pedido_id: string
    data_emissao: string
    status: 'Pendente Assinatura' | 'Confirmado' | 'Arquivado'
  }): Promise<AtestoRecord> {
    return await pb.collection('atestos').create<AtestoRecord>(data)
  },

  async updateStatus(id: string, status: AtestoRecord['status']): Promise<AtestoRecord> {
    return await pb.collection('atestos').update<AtestoRecord>(id, { status })
  },

  async confirm(id: string): Promise<AtestoRecord> {
    return await pb.collection('atestos').update<AtestoRecord>(id, { status: 'Confirmado' })
  },
}
