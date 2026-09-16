import pb from '@/lib/pocketbase/client'
import type { ContratoRecord, ContratoItemRecord, ContratoEscolaRecord } from '@/lib/types'

export const contratosService = {
  async getAll(): Promise<ContratoRecord[]> {
    return await pb.collection('contratos').getFullList<ContratoRecord>({
      sort: '-created',
    })
  },

  async getById(id: string): Promise<ContratoRecord> {
    return await pb.collection('contratos').getOne<ContratoRecord>(id)
  },

  async getItems(contratoId: string): Promise<ContratoItemRecord[]> {
    return await pb.collection('contrato_itens').getFullList<ContratoItemRecord>({
      filter: `contrato_id = "${contratoId}"`,
      expand: 'produto_id',
    })
  },

  async getAllItems(): Promise<ContratoItemRecord[]> {
    return await pb.collection('contrato_itens').getFullList<ContratoItemRecord>({
      expand: 'produto_id',
    })
  },

  async getEscolas(contratoId?: string): Promise<ContratoEscolaRecord[]> {
    const filter = contratoId ? `contrato_id = "${contratoId}"` : ''
    return await pb.collection('contrato_escolas').getFullList<ContratoEscolaRecord>({
      filter,
      expand: 'escola_id,rota_id,rota_logistica_id,contrato_id',
    })
  },

  async create(data: {
    numero: string
    numero_chamada?: string
    tipo?: string
    modalidade_pedido?: 'individualizado' | 'centralizado'
    num_rotas_logisticas?: number
    valor_total: number
    status?: 'Ativo' | 'Encerrado' | 'Pendente'
  }): Promise<ContratoRecord> {
    return await pb.collection('contratos').create<ContratoRecord>({
      ...data,
      status: data.status || 'Ativo',
    })
  },

  async update(id: string, data: Partial<ContratoRecord>): Promise<ContratoRecord> {
    return await pb.collection('contratos').update<ContratoRecord>(id, data)
  },
  async delete(id: string): Promise<boolean> {
    // Delete associated contract items
    const items = await pb.collection('contrato_itens').getFullList<ContratoItemRecord>({
      filter: `contrato_id = "${id}"`,
    })
    for (const item of items) {
      await pb.collection('contrato_itens').delete(item.id)
    }

    // Delete associated contract schools
    const ceList = await pb.collection('contrato_escolas').getFullList<ContratoEscolaRecord>({
      filter: `contrato_id = "${id}"`,
    })
    for (const ce of ceList) {
      await pb.collection('contrato_escolas').delete(ce.id)
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

    for (const item of existingItems) {
      if (!keptItemIds.has(item.id)) {
        await pb.collection('contrato_itens').delete(item.id)
      }
    }
  },

  async linkEscola(data: {
    contrato_id: string
    escola_id: string
    rota_id?: string
    rota?: string
    rota_logistica_id?: string
  }): Promise<ContratoEscolaRecord> {
    // Check if link already exists
    const existing = await pb.collection('contrato_escolas').getFullList<ContratoEscolaRecord>({
      filter: `contrato_id = "${data.contrato_id}" && escola_id = "${data.escola_id}"`,
    })
    if (existing.length > 0) {
      const updateData: Partial<ContratoEscolaRecord> = {}
      if (data.rota_id !== undefined && existing[0].rota_id !== data.rota_id) {
        updateData.rota_id = data.rota_id
      }
      if (data.rota !== undefined && existing[0].rota !== data.rota) {
        updateData.rota = data.rota
      }
      if (
        data.rota_logistica_id !== undefined &&
        existing[0].rota_logistica_id !== data.rota_logistica_id
      ) {
        updateData.rota_logistica_id = data.rota_logistica_id
      }
      if (Object.keys(updateData).length > 0) {
        return await pb.collection('contrato_escolas').update(existing[0].id, updateData)
      }
      return existing[0]
    }
    return await pb.collection('contrato_escolas').create<ContratoEscolaRecord>(data)
  },

  async unlinkEscola(contratoEscolaId: string): Promise<boolean> {
    return await pb.collection('contrato_escolas').delete(contratoEscolaId)
  },

  async updateEscolaRota(
    contratoEscolaId: string,
    data: { rotaId?: string; rotaPlanilha?: string },
  ): Promise<ContratoEscolaRecord> {
    const payload: Record<string, any> = {}
    if (data.rotaId !== undefined) payload.rota_id = data.rotaId
    if (data.rotaPlanilha !== undefined) payload.rota = data.rotaPlanilha
    return await pb
      .collection('contrato_escolas')
      .update<ContratoEscolaRecord>(contratoEscolaId, payload)
  },

  async updateEscolaRotaLogistica(
    contratoEscolaId: string,
    rotaLogisticaId: string,
  ): Promise<ContratoEscolaRecord> {
    return await pb.collection('contrato_escolas').update<ContratoEscolaRecord>(contratoEscolaId, {
      rota_logistica_id: rotaLogisticaId || '',
    })
  },

  async updateEscolaRotaByContratoEscola(
    contratoId: string,
    escolaId: string,
    rotaId: string,
    rotaPlanilha?: string,
  ): Promise<ContratoEscolaRecord | null> {
    const existing = await pb.collection('contrato_escolas').getFullList<ContratoEscolaRecord>({
      filter: `contrato_id = "${contratoId}" && escola_id = "${escolaId}"`,
    })
    const payload: Record<string, any> = { rota_id: rotaId }
    if (rotaPlanilha !== undefined) payload.rota = rotaPlanilha

    if (existing.length > 0) {
      return await pb
        .collection('contrato_escolas')
        .update<ContratoEscolaRecord>(existing[0].id, payload)
    } else {
      return await pb.collection('contrato_escolas').create<ContratoEscolaRecord>({
        contrato_id: contratoId,
        escola_id: escolaId,
        ...payload,
      })
    }
  },

  async updateEscolaRotaLogisticaByContratoEscola(
    contratoId: string,
    escolaId: string,
    rotaLogisticaId: string,
  ): Promise<ContratoEscolaRecord | null> {
    const existing = await pb.collection('contrato_escolas').getFullList<ContratoEscolaRecord>({
      filter: `contrato_id = "${contratoId}" && escola_id = "${escolaId}"`,
    })
    if (existing.length > 0) {
      return await pb.collection('contrato_escolas').update<ContratoEscolaRecord>(existing[0].id, {
        rota_logistica_id: rotaLogisticaId || '',
      })
    } else {
      return await pb.collection('contrato_escolas').create<ContratoEscolaRecord>({
        contrato_id: contratoId,
        escola_id: escolaId,
        rota_logistica_id: rotaLogisticaId || '',
      })
    }
  },
}
