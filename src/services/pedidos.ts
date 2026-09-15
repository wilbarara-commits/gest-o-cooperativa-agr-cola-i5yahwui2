import pb from '@/lib/pocketbase/client'
import type { PedidoRecord, PedidoItemRecord, PedidoValidacao } from '@/lib/types'

export const pedidosService = {
  async getAll(): Promise<PedidoRecord[]> {
    return await pb.collection('pedidos').getFullList<PedidoRecord>({
      expand: 'escola_id,ciclo_id,rota_id,rota_logistica_id,entregue_por',
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
    rota_logistica_id?: string
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
      rota_logistica_id: data.rota_logistica_id || '',
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

  async updateStatus(
    id: string,
    status: PedidoRecord['status'],
    options?: {
      entregue_em?: string
      entregue_por?: string
      cancelamento_motivo?: string
      motivo_cancelamento?: string
      cancelado_em?: string
      rota_logistica_id?: string
    },
  ): Promise<PedidoRecord> {
    const payload: Partial<PedidoRecord> = { status }
    if (options?.entregue_em !== undefined) {
      payload.entregue_em = options.entregue_em
    }
    if (options?.entregue_por !== undefined) {
      payload.entregue_por = options.entregue_por
    }
    if (options?.cancelamento_motivo !== undefined) {
      payload.cancelamento_motivo = options.cancelamento_motivo
      payload.motivo_cancelamento = options.cancelamento_motivo
    }
    if (options?.motivo_cancelamento !== undefined) {
      payload.motivo_cancelamento = options.motivo_cancelamento
      payload.cancelamento_motivo = options.motivo_cancelamento
    }
    if (options?.cancelado_em !== undefined) {
      payload.cancelado_em = options.cancelado_em
    }
    if (options?.rota_logistica_id !== undefined) {
      payload.rota_logistica_id = options.rota_logistica_id
    }
    return await pb.collection('pedidos').update<PedidoRecord>(id, payload)
  },

  async atribuirRotaLogistica(pedidoId: string, rotaLogisticaId: string): Promise<PedidoRecord> {
    return await pb.collection('pedidos').update<PedidoRecord>(pedidoId, {
      rota_logistica_id: rotaLogisticaId,
    })
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
