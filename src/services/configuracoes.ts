import pb from '@/lib/pocketbase/client'
import type { ConfiguracoesRecord } from '@/lib/types'

export const configuracoesService = {
  async get(): Promise<ConfiguracoesRecord | null> {
    try {
      const records = await pb.collection('configuracoes').getList(1, 1, {
        sort: '-created',
      })
      if (records.items.length === 0) return null
      const item = records.items[0]
      return {
        id: item.id,
        nome_cooperativa: item.nome_cooperativa || 'CooperGestão',
        sigla: item.sigla || '',
        cnpj: item.cnpj || '',
        telefone: item.telefone || '',
        email: item.email || '',
        cidade_uf: item.cidade_uf || '',
        exibir_atalhos_demo: item.exibir_atalhos_demo !== false,
        logotipo: item.logotipo || '',
        created: item.created,
        updated: item.updated,
      }
    } catch (err) {
      console.error('Erro ao buscar configurações:', err)
      return null
    }
  },

  getLogoUrl(config: ConfiguracoesRecord | null): string {
    if (!config || !config.logotipo) return ''
    return pb.files.getURL(config as any, config.logotipo)
  },

  async save(
    data: Partial<Omit<ConfiguracoesRecord, 'id' | 'created' | 'updated'>> | FormData,
    existingId?: string,
  ): Promise<ConfiguracoesRecord> {
    if (existingId) {
      const updated = await pb.collection('configuracoes').update(existingId, data)
      return {
        id: updated.id,
        nome_cooperativa: updated.nome_cooperativa,
        sigla: updated.sigla || '',
        cnpj: updated.cnpj || '',
        telefone: updated.telefone || '',
        email: updated.email || '',
        cidade_uf: updated.cidade_uf || '',
        exibir_atalhos_demo: updated.exibir_atalhos_demo !== false,
        logotipo: updated.logotipo || '',
        created: updated.created,
        updated: updated.updated,
      }
    }

    // Criar caso não exista
    const created = await pb.collection('configuracoes').create(data)
    return {
      id: created.id,
      nome_cooperativa: created.nome_cooperativa,
      sigla: created.sigla || '',
      cnpj: created.cnpj || '',
      telefone: created.telefone || '',
      email: created.email || '',
      cidade_uf: created.cidade_uf || '',
      exibir_atalhos_demo: created.exibir_atalhos_demo !== false,
      logotipo: created.logotipo || '',
      created: created.created,
      updated: created.updated,
    }
  },
}
