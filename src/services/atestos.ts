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
    arquivo?: File | Blob
  }): Promise<AtestoRecord> {
    if (data.arquivo) {
      const formData = new FormData()
      formData.append('numero', data.numero)
      formData.append('pedido_id', data.pedido_id)
      formData.append('data_emissao', data.data_emissao)
      formData.append('status', data.status)
      formData.append('arquivo', data.arquivo, `Atesto_${data.numero}.pdf`)
      return await pb.collection('atestos').create<AtestoRecord>(formData)
    }
    return await pb.collection('atestos').create<AtestoRecord>(data)
  },

  async updatePdf(id: string, pdfBlob: Blob, filename?: string): Promise<AtestoRecord> {
    const formData = new FormData()
    formData.append('arquivo', pdfBlob, filename || `Atesto_${id}.pdf`)
    return await pb.collection('atestos').update<AtestoRecord>(id, formData)
  },

  getFileUrl(
    record: { id: string; collectionId?: string; collectionName?: string; arquivo?: string },
    filename?: string,
  ): string {
    const fn = filename || record.arquivo
    if (!fn) return ''
    return pb.files.getURL(record as any, fn)
  },

  async updateStatus(id: string, status: AtestoRecord['status']): Promise<AtestoRecord> {
    return await pb.collection('atestos').update<AtestoRecord>(id, { status })
  },

  async confirm(id: string): Promise<AtestoRecord> {
    return await pb.collection('atestos').update<AtestoRecord>(id, { status: 'Confirmado' })
  },
}
