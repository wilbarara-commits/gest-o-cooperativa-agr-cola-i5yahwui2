import { useRef } from 'react'
import { Download, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

/* ----------------------------------------------------------------------------
 * DRS content
 * Centralized so the on-screen document and the generated PDF stay in sync.
 * The PDF is generated from the same data via a function that builds a plain
 * text / HTML representation, written to a Blob and opened for download.
 * ------------------------------------------------------------------------- */

interface ModuleSpec {
  id: string
  title: string
  route: string
  goal: string
  details: string[]
}

const MODULES: ModuleSpec[] = [
  {
    id: '3.1',
    title: 'Dashboard',
    route: '/ (Página Inicial)',
    goal: 'Fornecer uma visão executiva das operações.',
    details: [
      'Métricas em cards (2×4 grid responsivo): Pedidos Pendentes (ShoppingCart, laranja/amber), Contratos Ativos (FileText, verde), Entregas Hoje (Truck, azul), Receita Total do Mês (DollarSign, verde) — valor dos contratos ÷ 12',
      'Lista de Entregas Recentes com badges de status',
      'Feed de Atividade (timeline de eventos recentes)',
      'Ações rápidas: "Novo Pedido" e "Emitir Atesto"',
    ],
  },
  {
    id: '3.2',
    title: 'Produtos & Preços',
    route: '/produtos',
    goal: 'Cadastro e manutenção do catálogo de produtos agrícolas e tabela de preços.',
    details: [
      'Campos (Product): id, name, category (Hortaliças/Frutas/Grãos), stock, unit (Maço/Kg/Unidade), price (R$)',
      'Funcionalidades: busca textual, destaque estoque baixo (<100 em vermelho), Ajuste em Massa (reajuste percentual), Novo Produto',
    ],
  },
  {
    id: '3.3',
    title: 'Escolas Parceiras',
    route: '/escolas',
    goal: 'Diretório das instituições de ensino atendidas.',
    details: [
      'Campos (School): id, name, address, contact, route',
      'Funcionalidades: Cards em grid com busca por nome, placeholder "Ver Detalhes"',
    ],
  },
  {
    id: '3.4',
    title: 'Contratos Institucionais',
    route: '/contratos',
    goal: 'Acompanhamento de contratos PNAE/PAA com controle de saldo.',
    details: [
      'Campos (Contract): id, schoolId, schoolName, totalValue, balance, status (Ativo/Encerrado)',
      'Funcionalidades: tabela com barra de progresso (% utilizado = (totalValue - balance) / totalValue × 100), Badge de status, botão "Novo Contrato"',
    ],
  },
  {
    id: '3.5',
    title: 'Pedidos',
    route: '/pedidos',
    goal: 'Lançamento e acompanhamento do ciclo de vida dos pedidos.',
    details: [
      'Campos (Order): id, schoolId, schoolName, date, status (Pendente/Em Rota/Entregue/Cancelado), total, items (OrderItem[])',
      'OrderItem: productId, name, quantity',
      'Funcionalidades: tabela com Badge colorido de status, Dialog modal "Lançar Novo Pedido" com select de escola, data, área de produtos, botão Salvar Pedido com toast.',
      'Status: Entregue (verde), Pendente (laranja), Em Rota (azul), Cancelado (vermelho)',
    ],
  },
  {
    id: '3.6',
    title: 'Planejamento de Rotas',
    route: '/rotas',
    goal: 'Organizar entregas por região geográfica e confirmar recebimento.',
    details: [
      'Funcionalidades: agrupamento por rota, cards com título + badge de paradas, lista numerada de entregas, botão "Entregue" com toast "Entrega confirmada! Pronto para gerar atesto.", estado vazio com ilustração.',
    ],
  },
  {
    id: '3.7',
    title: 'Emissão de Atestos',
    route: '/atestos',
    goal: 'Gerar certificados de recebimento para faturamento.',
    details: [
      'Campos (Atesto): id, orderId, schoolName, date, status (Pendente Assinatura/Confirmado/Arquivado)',
      'Funcionalidades: alerta de pedidos prontos para atesto (fundo âmbar), tabela de histórico, Dialog modal com visualização formal (papel timbrado, cabeçalho CoopGestão, declaração de recebimento, linha de assinatura), botão "Imprimir PDF", geração condicional (só pedidos Entregue sem atesto)',
    ],
  },
]

const PROFILES = [
  [
    'Administrador',
    'Acesso total. Gerencia produtos, preços, contratos, rotas, escolas e visualiza todos os dados.',
  ],
  ['Secretária', 'Acesso operacional. Focado em lançar pedidos, consultar rotas e emitir atestos.'],
]

const VISUAL = [
  ['Nome do sistema', 'CoopGestão'],
  ['Ícone primário', 'Sprout (broto/folha) — Lucide Icons'],
  ['Paleta', 'Verde (primária), laranja/âmbar (secundária), tons neutros slate/gray'],
  ['Tipografia', 'Inter (padrão shadcn/ui), tracking-tight para títulos'],
  ['Componentes UI', 'shadcn/ui com Tailwind CSS'],
  ['Layout', 'Sidebar fixa (desktop) + drawer mobile, header com busca e menu de usuário'],
]

const STACK = [
  'React 18 + Vite',
  'TypeScript',
  'React Router DOM v6',
  'Tailwind CSS + shadcn/ui',
  'Lucide React',
  'Sonner (toasts)',
  'Backend previsto: Skip Cloud (PocketBase)',
]

const PENDING = [
  'Banco de dados real — migrar dados mock para PocketBase/Supabase com persistência',
  'Autenticação — login separado para Administrador e Secretária com permissões distintas',
  'CRUD completo — formulários reais de cadastro/edição/exclusão para produtos, escolas e contratos',
  'Formulário de pedidos completo — seleção múltipla de produtos com quantidades dinâmicas e cálculo automático do total',
  'Exportação real de PDF — geração de documento para impressão ou download',
  'Integração de mapas — visualização georreferenciada das rotas',
  'Feed de atividade dinâmico — registro real de eventos com timestamps',
]

const DATA_MODEL = [
  'Product → OrderItem.productId',
  'Order → Atesto.orderId',
  'School → Contract.schoolId e Order.schoolId',
]

/* ----------------------------------------------------------------------------
 * PDF generation
 * A self-contained printable HTML document. We open it in a new window and
 * trigger the browser's print-to-PDF, which gives the cleanest typography
 * without shipping a heavy runtime dependency.
 * ------------------------------------------------------------------------- */

function buildPrintHtml(): string {
  const rows = (cells: string[], tag: 'th' | 'td' = 'td') =>
    `<tr>${cells.map((c) => `<${tag}>${c}</${tag}>`).join('')}</tr>`

  const profileTable = `
    <table>
      <thead>${rows(['Perfil', 'Descrição'], 'th')}</thead>
      <tbody>
        ${PROFILES.map((p) => rows(p)).join('')}
      </tbody>
    </table>`

  const modulesHtml = MODULES.map(
    (m) => `
      <h3>${m.id} ${m.title} <span class="route">(${m.route})</span></h3>
      <p class="goal"><strong>Objetivo:</strong> ${m.goal}</p>
      <ul>${m.details.map((d) => `<li>${d}</li>`).join('')}</ul>`,
  ).join('')

  const visualTable = `
    <table>
      <tbody>
        ${VISUAL.map((v) => rows(v)).join('')}
      </tbody>
    </table>`

  const stackList = `<ul>${STACK.map((s) => `<li>${s}</li>`).join('')}</ul>`
  const dataModelList = `<ul>${DATA_MODEL.map((d) => `<li>${d}</li>`).join('')}</ul>`
  const pendingList = `<ol>${PENDING.map((p, i) => `<li>${i + 1}. ${p}</li>`).join('')}</ol>`

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Documento de Requisitos do Sistema (DRS) — CoopGestão</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  * { box-sizing: border-box; }
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    color: #1a1a1a;
    line-height: 1.6;
    margin: 0 auto;
    max-width: 820px;
    padding: 56px 48px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  h1 { font-size: 28px; font-weight: 700; letter-spacing: -0.02em; margin: 0 0 4px; }
  .subtitle { font-size: 16px; color: #4a6b3a; font-weight: 500; margin: 0 0 32px; }
  h2 {
    font-size: 20px; font-weight: 600; letter-spacing: -0.01em;
    margin: 40px 0 12px; padding-bottom: 8px; border-bottom: 2px solid #e6ece3;
    color: #1f4d1c;
  }
  h3 { font-size: 16px; font-weight: 600; margin: 24px 0 6px; }
  p { margin: 0 0 12px; }
  .goal { color: #555; font-size: 14px; margin-bottom: 8px; }
  .route { color: #6b7280; font-weight: 400; font-size: 13px; }
  ul, ol { margin: 0 0 12px; padding-left: 22px; }
  li { margin-bottom: 4px; font-size: 14px; }
  table { width: 100%; border-collapse: collapse; margin: 0 0 16px; font-size: 14px; }
  th, td { text-align: left; padding: 10px 14px; border: 1px solid #e2e8f0; vertical-align: top; }
  th { background: #f1f5f0; font-weight: 600; color: #1f4d1c; }
  tr:nth-child(even) td { background: #fafbfa; }
  .footer { margin-top: 56px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #9ca3af; text-align: center; }
  @media print {
    body { padding: 24px; }
    @page { margin: 1.5cm; }
  }
</style>
</head>
<body>
  <h1>Documento de Requisitos do Sistema (DRS)</h1>
  <p class="subtitle">CooperGestão — Gestão para Cooperativa Agrícola Familiar</p>

  <h2>1. Visão Geral do Produto</h2>
  <p>O CooperGestão é um sistema web voltado para cooperativas agrícolas de pequeno porte que participam de programas institucionais como o PNAE (Programa Nacional de Alimentação Escolar) e o PAA (Programa de Aquisição de Alimentos). A plataforma centraliza a gestão operacional com dois focos principais: Coleta de pedidos das escolas parceiras e Emissão de atestos de entrega para comprovação de recebimento e posterior faturamento. O público-alvo inclui administradores da cooperativa (coordenação, finanças) e secretárias (operacional, lançamento de pedidos e emissão de documentos).</p>

  <h2>2. Perfis de Acesso</h2>
  ${profileTable}
  <p class="goal"><strong>Nota:</strong> O sistema está em fase de protótipo (dados mock). A implementação de autenticação e controle de permissões depende da conexão de um banco de dados real.</p>

  <h2>3. Módulos do Sistema</h2>
  ${modulesHtml}

  <h2>4. Modelo de Dados (Resumo)</h2>
  ${dataModelList}

  <h2>5. Identidade Visual</h2>
  ${visualTable}

  <h2>6. Stack Técnica</h2>
  ${stackList}

  <h2>7. Requisitos Pendentes de Implementação</h2>
  ${pendingList}

  <div class="footer">Documento de Requisitos do Sistema — CoopGestão • Gerado em ${new Date().toLocaleDateString('pt-BR')}</div>

  <script>
    window.onload = function () { window.print(); }
  </script>
</body>
</html>`
}

function handleDownloadPdf() {
  const html = buildPrintHtml()
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const win = window.open(url, '_blank')
  // Fallback: if popup blocked, offer direct download of the HTML doc.
  if (!win) {
    const a = document.createElement('a')
    a.href = url
    a.download = 'DRS-CoopGestao.html'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }
  // Revoke after a delay to allow the print dialog to load.
  setTimeout(() => URL.revokeObjectURL(url), 30000)
}

/* ----------------------------------------------------------------------------
 * Presentational helpers
 * ------------------------------------------------------------------------- */

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-2xl font-semibold tracking-tight text-primary mt-12 mb-4 pb-2 border-b-2 border-primary/10 scroll-mt-20">
      {children}
    </h2>
  )
}

function Table({ headers, rows }: { headers?: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border my-4">
      <table className="w-full text-sm">
        {headers && (
          <thead className="bg-primary/5">
            <tr>
              {headers.map((h) => (
                <th
                  key={h}
                  className="text-left font-semibold text-primary px-4 py-3 border-b border-border"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="even:bg-muted/30">
              {row.map((cell, j) => (
                <td
                  key={j}
                  className="px-4 py-3 border-b border-border/60 align-top text-foreground/90"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ----------------------------------------------------------------------------
 * Page
 * ------------------------------------------------------------------------- */

export default function Requirements() {
  const topRef = useRef<HTMLDivElement>(null)

  return (
    <div ref={topRef} className="mx-auto max-w-4xl">
      {/* Document header */}
      <Card className="mb-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <div className="flex items-center gap-2 text-primary mb-2">
              <FileText className="h-5 w-5" />
              <span className="text-sm font-medium uppercase tracking-wider">
                Documento de Requisitos
              </span>
            </div>
            <CardTitle className="text-3xl font-bold tracking-tight text-foreground">
              Documento de Requisitos do Sistema (DRS)
            </CardTitle>
            <p className="text-muted-foreground mt-2 font-medium">
              CooperGestão — Gestão para Cooperativa Agrícola Familiar
            </p>
          </div>
          <Button onClick={handleDownloadPdf} className="shrink-0">
            <Download className="h-4 w-4" />
            Baixar PDF
          </Button>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">Versão Protótipo</Badge>
            <span>•</span>
            <span>Gerado em {new Date().toLocaleDateString('pt-BR')}</span>
          </div>
        </CardContent>
      </Card>

      {/* 1. Visão Geral */}
      <SectionTitle>1. Visão Geral do Produto</SectionTitle>
      <p className="text-foreground/90 leading-relaxed">
        O CooperGestão é um sistema web voltado para cooperativas agrícolas de pequeno porte que
        participam de programas institucionais como o PNAE (Programa Nacional de Alimentação
        Escolar) e o PAA (Programa de Aquisição de Alimentos). A plataforma centraliza a gestão
        operacional com dois focos principais: Coleta de pedidos das escolas parceiras e Emissão de
        atestos de entrega para comprovação de recebimento e posterior faturamento. O público-alvo
        inclui administradores da cooperativa (coordenação, finanças) e secretárias (operacional,
        lançamento de pedidos e emissão de documentos).
      </p>

      {/* 2. Perfis de Acesso */}
      <SectionTitle>2. Perfis de Acesso</SectionTitle>
      <Table headers={['Perfil', 'Descrição']} rows={PROFILES} />
      <p className="text-sm text-muted-foreground italic">
        <strong className="not-italic">Nota:</strong> O sistema está em fase de protótipo (dados
        mock). A implementação de autenticação e controle de permissões depende da conexão de um
        banco de dados real.
      </p>

      {/* 3. Módulos */}
      <SectionTitle>3. Módulos do Sistema</SectionTitle>
      <div className="space-y-6">
        {MODULES.map((m) => (
          <div key={m.id} className="rounded-lg border border-border bg-card p-5 scroll-mt-20">
            <h3 className="text-lg font-semibold tracking-tight text-foreground flex flex-wrap items-baseline gap-2">
              <span className="text-primary">{m.id}</span>
              {m.title}
              <Badge variant="secondary" className="font-normal">
                {m.route}
              </Badge>
            </h3>
            <p className="text-sm text-muted-foreground mt-1 mb-3">
              <strong className="text-foreground/80">Objetivo:</strong> {m.goal}
            </p>
            <ul className="space-y-2">
              {m.details.map((d, i) => (
                <li key={i} className="text-sm text-foreground/90 flex gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* 4. Modelo de Dados */}
      <SectionTitle>4. Modelo de Dados (Resumo)</SectionTitle>
      <ul className="space-y-2">
        {DATA_MODEL.map((d, i) => (
          <li key={i} className="text-foreground/90 flex gap-2">
            <span className="text-primary mt-0.5">→</span>
            <code className="font-mono text-sm bg-muted px-2 py-0.5 rounded">{d}</code>
          </li>
        ))}
      </ul>

      {/* 5. Identidade Visual */}
      <SectionTitle>5. Identidade Visual</SectionTitle>
      <Table rows={VISUAL} />

      {/* 6. Stack Técnica */}
      <SectionTitle>6. Stack Técnica</SectionTitle>
      <ul className="grid sm:grid-cols-2 gap-2">
        {STACK.map((s, i) => (
          <li
            key={i}
            className="text-sm text-foreground/90 flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            {s}
          </li>
        ))}
      </ul>

      {/* 7. Requisitos Pendentes */}
      <SectionTitle>7. Requisitos Pendentes de Implementação</SectionTitle>
      <ol className="space-y-3">
        {PENDING.map((p, i) => (
          <li key={i} className="flex gap-3 rounded-lg border border-border bg-card p-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {i + 1}
            </span>
            <span className="text-sm text-foreground/90 pt-0.5">{p}</span>
          </li>
        ))}
      </ol>

      <div className="mt-12 pt-6 border-t border-border text-center text-xs text-muted-foreground">
        Documento de Requisitos do Sistema — CoopGestão • Versão Protótipo
      </div>
    </div>
  )
}
