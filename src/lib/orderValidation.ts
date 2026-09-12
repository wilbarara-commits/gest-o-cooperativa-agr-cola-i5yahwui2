import type { Product, OrderItem, PedidoValidacao } from '@/lib/types'

export interface OrderValidationInput {
  items: OrderItem[]
  allProducts: Product[]
  cicloStatus: 'coletando' | 'correcao' | 'fechado'
  itensEmFaltaOriginal?: string[] // IDs de produtos com escassez no ciclo
}

/**
 * Valida o pedido conforme a regra de negócio:
 * - Inválido se vazio
 * - Inválido se faltar item essencial (produto com essencial = true não incluído ou com qtd 0)
 * - Inválido se na fase 'correcao' não compensar item em falta (se havia item em escassez, precisa ter substituto abundante ou não zerar)
 */
export function validateOrder(params: OrderValidationInput): PedidoValidacao {
  const { items, allProducts, cicloStatus } = params

  const validItems = items.filter((it) => it.quantity > 0)

  if (validItems.length === 0) {
    return {
      status: 'invalido',
      motivo: 'Pedido inválido: nenhum item com quantidade maior que zero foi informado.',
      detalhes: ['O pedido está completamente vazio.'],
    }
  }

  const detalhes: string[] = []

  // 1. Verificar itens essenciais
  const essenciais = allProducts.filter((p) => p.essencial)
  const itensProdutosIds = new Set(validItems.map((i) => i.productId))

  const faltantesEssenciais = essenciais.filter((p) => !itensProdutosIds.has(p.id))

  if (faltantesEssenciais.length > 0) {
    const nomes = faltantesEssenciais.map((p) => p.name).join(', ')
    return {
      status: 'invalido',
      motivo: `Falta de item essencial obrigatório: ${nomes}`,
      detalhes: faltantesEssenciais.map((p) => `Item essencial ausente: ${p.name}`),
    }
  }

  // 2. Se fase correcao: verificar se itens em escassez foram compensados por itens em abundância
  if (cicloStatus === 'correcao') {
    const produtosEscassez = allProducts.filter((p) => p.disponibilidade === 'escassez')
    const produtosAbundancia = allProducts.filter((p) => p.disponibilidade === 'abundancia')

    // Se o pedido pede itens em escassez mas não inclui nenhum item em abundância para compensar
    const pedeEscassez = validItems.filter((i) =>
      produtosEscassez.some((pe) => pe.id === i.productId),
    )
    const pedeAbundancia = validItems.filter((i) =>
      produtosAbundancia.some((pa) => pa.id === i.productId),
    )

    if (pedeEscassez.length > 0 && pedeAbundancia.length === 0 && produtosAbundancia.length > 0) {
      detalhes.push(
        'Fase de correção: foram solicitados produtos em escassez sem incluir itens compensatórios em abundância.',
      )
      return {
        status: 'invalido',
        motivo:
          'Na fase de correção, pedidos com itens em escassez devem compensar com itens em abundância.',
        detalhes,
      }
    }
  }

  return {
    status: 'validado',
    motivo: 'Pedido atende a todos os critérios de validação e essenciais.',
    detalhes: ['Validação aprovada com sucesso.'],
  }
}
