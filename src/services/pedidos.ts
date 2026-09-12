import pb from '@/lib/pocketbase/client'
import type { PedidoRecord, PedidoItemRecord, PedidoValidacao } from '@/lib/types'

export const pedidosService = {
  async getAll(): Promise<PedidoRecord[]> {
    return await pb.collection('pedidos').getFullList<PedidoRecord>({
      expand: 'escola_id,ciclo_id,rota_id',
      sort: '-data_prevista',
    })
  },

  async getAllItems(): Promise<PedidoItemRecord[]> {
    return await pb.collection('pedido_itens').getFullList<PedidoItemRecord>({
      expand: 'produto_id',
    })
  },

  async getItemsByPedidoId(pedidoId: string): Promise<PedidoItemRecord[]> {
    return await pb.collection('pedido_itens').getFullList<PedidoItemRecord>({
      filter: `pedido_id = "${pedidoId}"`,
      expand: 'produto_id',
    })
  },

  async create(data: {
    numero: string
    escola_id: string
    ciclo_id?: string
    origem?: 'excel' | 'whatsapp' | 'manual'
    rota_id?: string
    validacao?: PedidoValidacao
    data_prevista: string
    status: 'Pendente' | 'Em Rota' | 'Entregue' | 'Cancelado'
    itens: Array<{
      produto_id: string
      quantidade: number
      preco_unitario: number
    }>
  }): Promise<PedidoRecord> {
    const pedido = await pb.collection('pedidos').create<PedidoRecord>({
      numero: data.numero,
      escola_id: data.escola_id,
      ciclo_id: data.ciclo_id || '',
      origem: data.origem || 'manual',
      rota_id: data.rota_id || '',
      validacao: data.validacao || { status: 'validado', motivo: 'Lançamento manual' },
      data_prevista: data.data_prevista,
      status: data.status,
    })

    for (const item of data.itens) {
      await pb.collection('pedido_itens').create({
        pedido_id: pedido.id,
        produto_id: item.produto_id,
        quantidade: item.quantidade,
        preco_unitario: item.preco_unitario,
      })
    }

    return pedido
  },

  async updateStatus(id: string, status: PedidoRecord['status']): Promise<PedidoRecord> {
    return await pb.collection('pedidos').update<PedidoRecord>(id, { status })
  },

  async updateValidacao(id: string, validacao: PedidoValidacao): Promise<PedidoRecord> {
    return await pb.collection('pedidos').update<PedidoRecord>(id, { validacao })
  },

  async delete(id: string): Promise<boolean> {
    const items = await pb.collection('pedido_itens').getFullList<PedidoItemRecord>({
      filter: `pedido_id = "${id}"`,
    })
    for (const item of items) {
      await pb.collection('pedido_itens').delete(item.id)
    }
    return await pb.collection('pedidos').delete(id)
  },
}
