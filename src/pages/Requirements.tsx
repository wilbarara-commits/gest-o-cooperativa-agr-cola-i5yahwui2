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
      'Métricas em cards: Pedidos Pendentes, Contratos Ativos, Entregas Hoje, Receita Total do Mês.',
      'Lista de Entregas Recentes com badges de status.',
      'Ações rápidas: "Novo Pedido", "Emitir Atesto" e "Consolidação".',
    ],
  },
  {
    id: '3.2',
    title: 'Produtos & Preços',
    route: '/produtos',
    goal: 'Cadastro e manutenção do catálogo de produtos agrícolas e tabela de preços com diretrizes de safra.',
    details: [
      'Campos: id, nome, categoria, estoque, unidade, preco_unitario, essencial (boolean), disponibilidade (normal / escassez / abundancia).',
      'Classificação de Itens Essenciais: obrigatoriedade na validação dos pedidos semanais.',
      'Disponibilidade de Safra: produtos em abundância (incentivo de colheita) e escassez (restrição e compensação na fase de correção).',
      'Ajuste em Massa percentual de preços.',
    ],
  },
  {
    id: '3.3',
    title: 'Cadastro Mestre Global de Escolas',
    route: '/escolas',
    goal: 'Cadastro mestre único, global e independente de contratos para todas as instituições parceiras atendidas, com listagem compacta em linhas, visão detalhada e filtros operacionais por contrato e rota.',
    details: [
      'Campos: id, nome, endereco, telefone, email, tipo (Municipal, Estadual, Creche / CMEI, Filantrópica / Conveniada, Outro), rota (padrão) e alunos (nº de alunos matriculados).',
      'Listagem Compacta em Linhas (Tabela): Apresentação em linhas via componente Table do shadcn/ui para visualização de mais escolas por página (com paginação configurável: 10, 25, 50, 100 linhas), contendo colunas: Escola/Instituição, Tipo, Rota(s), Nº de Alunos, Telefone, Contratos Vinculados (badges) e Ações.',
      'Visão Detalhada da Escola Selecionada: Ao clicar em uma linha da tabela ou no botão "Ver detalhes", é aberto um painel/diálogo modal exibindo todos os dados mestres (endereço completo, telefone, e-mail institucional, tipo, alunos, rota padrão), lista de contratos aos quais a escola está vinculada com a rota específica definida em cada vínculo (collection contrato_escolas), e atalho direto para edição cadastral.',
      'Filtros Combinados por Contrato e Rota: Selects dedicados para filtrar por Contrato (todos os contratos existentes ou escolas sem vínculo contratual) e por Rota (rotas derivadas dos vínculos contrato_escolas, rotas cadastradas e rotas padrão), combináveis simultaneamente com a busca textual e com o filtro por Tipo de instituição.',
      'Princípio de Unicidade & Integridade: Uma escola é criada uma única vez no cadastro mestre global e depois vinculada a múltiplos contratos PNAE/PAA. Prevenção de duplicidade por normalização estrita de nomes e exclusão protegida com verificação prévia de dependências contratuais e pedidos.',
    ],
  },
  {
    id: '3.4',
    title: 'Contratos, Vínculo N:N de Escolas & Rotas',
    route: '/contratos',
    goal: 'Gestão institucional dos contratos PNAE/PAA, vínculo de N escolas participantes, rotas logísticas e tabela de produtos com preços acordados sem cota por produto.',
    details: [
      'Vínculo de Escolas via Cadastro Mestre: Na aba de escolas do contrato, o usuário realiza busca e autocomplete sobre a collection escolas do cadastro mestre.',
      'Definição de Parâmetros Operacionais: Ao vincular cada escola mestre, define-se a rota logística atribuída.',
      'Cadastro Rápido sem Duplicação: Permite cadastrar uma nova escola diretamente dentro do contrato; o sistema normaliza o nome e reutiliza o registro existente no cadastro mestre caso já haja escola correspondente.',
      'Modalidade de Pedido: individualizado (cada escola faz seu pedido via WhatsApp/manual) ou centralizado (pedidos consolidados via importação de planilha Excel da secretaria).',
      'Rotas por Contrato: subconjuntos de escolas participantes geridas pela logística (ex.: ROTA A, ROTA B).',
      'Produtos Acordados sem Cota: No contrato anual não há cota por produto; a collection contrato_itens lista os produtos acordados com seus respectivos preços unitários fixados.',
      'Relatório de Execução do Contrato: cards globais de Total Contratado, Total Realizado e % Execução, com detalhamento de entregas por escola participante (quantidades realizadas, preços unitários e valores realizados).',
    ],
  },
  {
    id: '3.5',
    title: 'Pedidos & Validação de Regras',
    route: '/pedidos',
    goal: 'Lançamento e acompanhamento do ciclo de vida dos pedidos com auditoria de regras de negócio.',
    details: [
      'Campos: id, numero, escola_id, ciclo_id (FK ciclos), origem (excel / whatsapp / manual), rota_id (FK rotas), validacao (json: status, motivo, detalhes).',
      'Validação Automática do Pedido: inválido se vazio, se faltar item essencial, ou se na fase de correção não compensar item em escassez com itens em abundância.',
      'Lançamento de Pedidos via WhatsApp: suporte para contratos individualizados com pré-preenchimento e atribuição ao ciclo ativo.',
      'Filtros avançados por origem, status de entrega e validação.',
    ],
  },
  {
    id: '3.6',
    title: 'Importação de Pedidos (Excel Centralizado)',
    route: '/importacao',
    goal: 'Carga de pedidos em contratos centralizados via planilha .xlsx da Secretaria de Educação.',
    details: [
      'Matching contra o Cadastro Mestre Global: A identificação das colunas é feita contra o diretório global de escolas (e não somente contra os vínculos prévios do contrato).',
      'Fluxo de Pendências Inteligente: Se a escola existe no cadastro mestre mas não está vinculada ao contrato atual, exibe a pendência "Vincular ao contrato" com rota e vínculo pré-preenchidos para confirmação com 1 clique. Se não existe no cadastro mestre, exibe a pendência "Cadastrar escola" (o importador continua sem criar registros automaticamente na surdina).',
      'Regras Estritas de Matching: Mantém regras de tolerância a acentos, maiúsculas, pontuação e apelidos entre parênteses (CEDAL, CEROM, CMEI Várzea), com tratamento comprovado dos casos "EM PAULINO CUSTÓDUIO REZENDE" ≡ "EM PAULINO CUSTÓDIO DE REZENDE" e distinção mandatória "CM LAR DE ISABEL" ≠ "EM LAR DE ISABEL".',
      'Suporte a 5 abas: ROTA A, ROTA B, ROTA C (a importar), TOTAL e TODAS UNIDADES (a ignorar).',
      'Mapeamento Escola-por-Coluna (transposto): linha 7 (nome das escolas), linhas 10-34 (25 produtos na coluna C e quantidades nas colunas das escolas), linha 35 (totais). Ignora seção FIXOS.',
      'Detecção de anomalias de duplicidade (escola presente em mais de uma rota) e auditoria na collection importacoes.',
    ],
  },
  {
    id: '3.7',
    title: 'Consolidação de Demanda Agrícola',
    route: '/consolidacao',
    goal: 'Matriz cruzada Produto × Escola para planejamento de colheita dos produtores cooperados.',
    details: [
      'Matriz dinâmica de quantidades por produto para cada escola no ciclo.',
      'Abas "Por Produto (Matriz Geral)" e "Por Escola (Resumo)".',
      'Filtro de Ocultar Vazios (sem demanda) e busca rápida.',
      'Exportação para Planilha Excel (.xlsx) via SheetJS com totalizadores.',
    ],
  },
  {
    id: '3.8',
    title: 'Planejamento de Rotas por Contrato',
    route: '/rotas',
    goal: 'Organização logística de paradas e monitoramento de entregas pendentes por rota.',
    details: [
      'Listagem de rotas por contrato contratual com paradas escolares ordenadas.',
      'Controle em tempo real de pedidos pendentes e carga total em trânsito por rota.',
    ],
  },
  {
    id: '3.9',
    title: 'Monitoramento & Simulador de Ciclo',
    route: '/monitoramento',
    goal: 'Controle das fases do ciclo operacional e painel de alertas para contato direto.',
    details: [
      'Ciclos operacionais: coletando → correcao → fechado.',
      'Simulador de transição de fase com regras de validação aplicadas.',
      'Painel de alertas de pendências: escolas sem pedidos ou pedidos com inconsistências.',
      'Botão de contato direto via WhatsApp (wa.me) com mensagem contextualizada.',
    ],
  },
  {
    id: '3.10',
    title: 'Comunicação Semanal (WhatsApp)',
    route: '/comunicacao',
    goal: 'Disparo de comunicados semanais de safra, links e controle de envio por escola.',
    details: [
      'Template de mensagem semanal com produtos em abundância, escassez, itens essenciais e link do formulário.',
      'Ações "Enviar Manual" (abre o WhatsApp Web/App com texto pronto) e "Enviar para Todos".',
      'Histórico e auditoria de disparos na collection envios_whatsapp (ciclo_id, escola_id, status, enviado_em).',
    ],
  },
  {
    id: '3.11',
    title: 'Histórico de Ciclos & Comparação de Consumo',
    route: '/historico-ciclos',
    goal: 'Auditoria de fechamentos semanais e análise comparativa de volume entre períodos.',
    details: [
      'Relação cronológica dos ciclos com total de escolas atendidas, volume consolidado e valor faturado.',
      'Modal de comparação direta entre dois ciclos (base vs comparado) com cálculo de variação absoluta e percentual por produto.',
    ],
  },
  {
    id: '3.12',
    title: 'Emissão de Atestos',
    route: '/atestos',
    goal: 'Gerar certificados formais de recebimento para comprovação e faturamento.',
    details: [
      'Campos (Atesto): id, numero, pedido_id, data_emissao, status.',
      'Validação formal em papel timbrado CoopGestão e confirmação direta no sistema.',
    ],
  },
  {
    id: '3.13',
    title: 'Relatórios Contábeis & Fechamento Mensal',
    route: '/relatorios',
    goal: 'Geração e exportação avançada de demonstrativos para fechamento mensal e prestação de contas.',
    details: [
      'Demonstrativos por contrato, entregas por período e produtos faturados.',
      'Exportação Excel (.xlsx) e PDF timbrado com jsPDF.',
    ],
  },
]

const PROFILES = [
  [
    'Administrador',
    'Acesso total. Gerencia produtos, preços, contratos, rotas, escolas, relatórios, documento de requisitos e visualiza todos os dados.',
  ],
  [
    'Secretária',
    'Acesso operacional e contábil. Focado em lançar pedidos, consultar rotas, emitir atestos e gerar relatórios contábeis de faturamento/entregas (sem acesso a Produtos, Contratos, Escolas e Requisitos).',
  ],
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
  'Backend conectado: Skip Cloud (PocketBase v0.36) com coleções persistidas em tempo real',
]

const DATA_MODEL = [
  'ciclos (id, nome, data_inicio, data_fim, status [coletando/correcao/fechado], snapshot [json])',
  'produtos (id, nome, categoria, unidade, estoque, preco_unitario, essencial [bool], disponibilidade [normal/escassez/abundancia])',
  'escolas (id, nome, endereco, telefone, email, tipo [Municipal/Estadual/Creche...], rota) [Cadastro Mestre Global]',
  'contratos (id, numero, tipo, modalidade_pedido [individualizado/centralizado], valor_total, status)',
  'contrato_escolas (id, contrato_id → contratos, escola_id → escolas, rota_id → rotas) [Vínculos N:N]',
  'rotas (id, contrato_id → contratos, nome, ordem)',
  'contrato_itens (id, contrato_id → contratos, produto_id → produtos, preco)',
  'pedidos (id, numero, escola_id → escolas, ciclo_id → ciclos, origem [excel/whatsapp/manual], rota_id → rotas, validacao [json], data_prevista, status)',
  'pedido_itens (id, pedido_id → pedidos, produto_id → produtos, quantidade, preco_unitario)',
  'envios_whatsapp (id, ciclo_id → ciclos, escola_id → escolas, status [pendente/enviado/falha], enviado_em)',
  'importacoes (id, ciclo_id → ciclos, contrato_id → contratos, arquivo, data, usuario_id, linhas_total, linhas_ok, linhas_erro, erros [json])',
  'atestos (id, numero, pedido_id → pedidos, data_emissao, status)',
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
      <thead>${rows(['Perfil', 'Descrição', 'Módulos Permitidos'], 'th')}</thead>
      <tbody>
        ${rows([
          'Administrador',
          'Acesso total ao sistema, configuração e reajustes.',
          'Dashboard, Produtos, Escolas, Contratos, Pedidos, Rotas, Atestos, Relatórios, Requisitos',
        ])}
        ${rows([
          'Secretária',
          'Acesso operacional e contábil.',
          'Dashboard, Pedidos, Rotas, Atestos, Relatórios',
        ])}
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

  <h2>2. Perfis de Acesso e Segurança</h2>
  ${profileTable}
  <p class="goal"><strong>Status:</strong> Implementado e ativo. O sistema conta com autenticação real via PocketBase, persistência de sessão, controle de permissões por perfil (Administrador com acesso integral e Secretária com acesso operacional) e recurso de alteração de senha segura diretamente no menu do usuário.</p>
  <h2>3. Módulos do Sistema</h2>
  ${modulesHtml}

  <h2>4. Modelo de Dados (Resumo)</h2>
  ${dataModelList}

  <h2>5. Identidade Visual</h2>
  ${visualTable}

  <h2>6. Stack Técnica</h2>
  ${stackList}

  <div class="footer">Documento de Requisitos do Sistema — CoopGestão • Gerado em ${new Date().toLocaleDateString('pt-BR')}</div>
</body>
</html>`
}

/* Download the standalone HTML document as a last-resort fallback. */
function downloadHtmlFallback(html: string) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'DRS-CoopGestao.html'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Robust print-to-PDF that does NOT depend on popups.
 *
 * The previous implementation opened a new window with a blob URL, which is
 * fragile: popup blockers silently kill `window.open`, and `window.onload`
 * inside the popup does not always fire for blob URLs. Instead we render the
 * document into a hidden iframe (via `srcdoc`, which is not subject to popup
 * blocking and needs no URL to revoke) and call `.print()` on its
 * `contentWindow` once it has loaded. If anything throws, we fall back to a
 * plain HTML download.
 */
function handleDownloadPdf() {
  const html = buildPrintHtml()

  try {
    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    iframe.setAttribute('aria-hidden', 'true')
    iframe.title = 'Impressão do DRS'

    let printed = false

    const cleanup = () => {
      // Give the print dialog a moment to hold the document before removal.
      setTimeout(() => iframe.remove(), 1000)
    }

    iframe.onload = () => {
      try {
        const win = iframe.contentWindow
        if (win) {
          win.focus()
          win.print()
          printed = true
        }
      } catch {
        // contentWindow.print() can throw in sandboxed contexts.
      }
      cleanup()
    }

    // If the iframe never reports load (rare), fall back to HTML download so
    // the user is never left with a dead button.
    const fallbackTimer = window.setTimeout(() => {
      if (!printed) downloadHtmlFallback(html)
    }, 3000)

    iframe.addEventListener('load', () => window.clearTimeout(fallbackTimer), { once: true })

    iframe.srcdoc = html
    document.body.appendChild(iframe)
  } catch {
    // iframe unsupported or blocked entirely — offer the HTML download.
    downloadHtmlFallback(html)
  }
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
            <Badge variant="outline" className="text-primary border-primary/30">
              Banco de Dados Ativo
            </Badge>
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
      <Table
        headers={['Perfil', 'Descrição', 'Permissões']}
        rows={[
          [
            'Administrador',
            'Acesso total e gestão completa do sistema.',
            'Dashboard, Produtos, Escolas, Contratos, Pedidos, Rotas, Atestos, Relatórios, Requisitos + Ajuste em Massa',
          ],
          [
            'Secretária',
            'Acesso restrito à operação diária e relatórios.',
            'Dashboard, Pedidos, Rotas, Atestos, Relatórios (sem acesso a Produtos, Contratos, Escolas e Requisitos)',
          ],
        ]}
      />
      <p className="text-sm text-muted-foreground italic">
        <strong className="not-italic text-primary font-medium">Status:</strong> Autenticação real
        ativa e integrada ao PocketBase no Skip Cloud. Sessão persistida, route guards aplicados e
        perfis com permissões separadas.
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

      <div className="mt-12 pt-6 border-t border-border text-center text-xs text-muted-foreground">
        Documento de Requisitos do Sistema — CoopGestão • Conectado ao Skip Cloud (PocketBase)
      </div>
    </div>
  )
}
