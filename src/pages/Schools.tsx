import { useApp } from '@/context/app-context'
import { useAuth } from '@/context/auth-context'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  Search,
  Map as MapIcon,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  AlertTriangle,
  Globe,
  FileCheck,
  FileSpreadsheet,
  Users,
  Eye,
  FilterX,
  ChevronLeft,
  ChevronRight,
  Route as RouteIcon,
  Briefcase,
  Info,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useState, useMemo } from 'react'
import { toast } from 'sonner'
import { escolasService } from '@/services/escolas'
import { SchoolImportDialog } from '@/components/SchoolImportDialog'
import type { School, EscolaTipo } from '@/lib/types'

const PRESET_ROUTES = [
  'Rota Norte',
  'Rota Sul',
  'Rota Leste',
  'Rota Oeste',
  'Rota Central',
  'Outra',
]

const ESCOLA_TIPOS: EscolaTipo[] = ['CMEI', 'CRECHE', 'INTEGRAL', 'FUNDAMENTAL']

export default function Schools() {
  const { schools, contracts, contractSchools, rotas, isLoading, refreshData } = useApp()
  const { isAdmin } = useAuth()
  const [search, setSearch] = useState('')
  const [filterTipo, setFilterTipo] = useState<string>('todos')
  const [filterContrato, setFilterContrato] = useState<string>('todos')
  const [filterRota, setFilterRota] = useState<string>('todas')

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(25)

  // Details dialog state
  const [detailsSchool, setDetailsSchool] = useState<School | null>(null)
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false)

  // Form dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [editingSchool, setEditingSchool] = useState<School | null>(null)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [contact, setContact] = useState('')
  const [email, setEmail] = useState('')
  const [tipo, setTipo] = useState<string>('')
  const [alunos, setAlunos] = useState<string>('')
  const [routeType, setRouteType] = useState('Rota Norte')
  const [customRoute, setCustomRoute] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [schoolToDelete, setSchoolToDelete] = useState<School | null>(null)
  const [dependencyWarning, setDependencyWarning] = useState<{
    contractsCount: number
    ordersCount: number
  } | null>(null)
  const [isCheckingDeps, setIsCheckingDeps] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Map of schoolId -> links with contracts and route names
  const schoolContractLinksMap = useMemo(() => {
    const map = new Map<
      string,
      Array<{
        contratoId: string
        contratoNumero: string
        contratoTipo?: string
        rotaId?: string
        rotaNome: string
      }>
    >()

    for (const c of contracts) {
      for (const link of c.escolas) {
        const list = map.get(link.escolaId) || []
        list.push({
          contratoId: c.id,
          contratoNumero: c.numero,
          contratoTipo: c.tipo,
          rotaId: link.rotaId,
          rotaNome: link.rotaNome || 'Sem Rota',
        })
        map.set(link.escolaId, list)
      }
    }
    return map
  }, [contracts])

  // Distinct routes derived from contract_escolas, rotas collection, and preset master routes
  const availableRotas = useMemo(() => {
    const routeSet = new Set<string>()

    // 1. Routes in rotas collection
    for (const r of rotas) {
      if (r.nome && r.nome.trim()) routeSet.add(r.nome.trim())
    }

    // 2. Routes bound in contract schools links
    for (const c of contracts) {
      for (const e of c.escolas) {
        if (e.rotaNome && e.rotaNome.trim() && e.rotaNome !== 'Sem Rota') {
          routeSet.add(e.rotaNome.trim())
        }
      }
    }

    // 3. Fallback master routes on schools
    for (const s of schools) {
      if (s.route && s.route.trim() && s.route !== 'Sem Rota') {
        routeSet.add(s.route.trim())
      }
    }

    return Array.from(routeSet).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [rotas, contracts, schools])

  // Filtered schools
  const filteredSchools = useMemo(() => {
    return schools.filter((s) => {
      const searchLower = search.trim().toLowerCase()
      const links = schoolContractLinksMap.get(s.id) || []

      // Textual search: matches name, default route, address, email, tipo, or linked contract numbers/routes
      const matchesSearch =
        !searchLower ||
        s.name.toLowerCase().includes(searchLower) ||
        (s.route && s.route.toLowerCase().includes(searchLower)) ||
        (s.address && s.address.toLowerCase().includes(searchLower)) ||
        (s.email && s.email.toLowerCase().includes(searchLower)) ||
        (s.tipo && s.tipo.toLowerCase().includes(searchLower)) ||
        links.some(
          (l) =>
            l.contratoNumero.toLowerCase().includes(searchLower) ||
            l.rotaNome.toLowerCase().includes(searchLower),
        )

      // Filter by tipo
      const matchesTipo =
        filterTipo === 'todos' ? true : filterTipo === 'sem_tipo' ? !s.tipo : s.tipo === filterTipo

      // Filter by contract
      const matchesContrato =
        filterContrato === 'todos'
          ? true
          : filterContrato === 'sem_contrato'
            ? links.length === 0
            : links.some((l) => l.contratoId === filterContrato)

      // Filter by route: matches either a contract-school link with that route OR the school's default route
      const matchesRota =
        filterRota === 'todas'
          ? true
          : links.some(
              (l) =>
                l.rotaNome.trim().toLowerCase() === filterRota.trim().toLowerCase() ||
                l.rotaId === filterRota,
            ) ||
            (s.route && s.route.trim().toLowerCase() === filterRota.trim().toLowerCase())

      return matchesSearch && matchesTipo && matchesContrato && matchesRota
    })
  }, [schools, search, filterTipo, filterContrato, filterRota, schoolContractLinksMap])

  // Reset page when filters change
  const totalPages = Math.max(1, Math.ceil(filteredSchools.length / pageSize))
  const safeCurrentPage = Math.min(currentPage, totalPages)

  const paginatedSchools = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize
    return filteredSchools.slice(start, start + pageSize)
  }, [filteredSchools, safeCurrentPage, pageSize])

  const hasActiveFilters =
    search.trim() !== '' ||
    filterTipo !== 'todos' ||
    filterContrato !== 'todos' ||
    filterRota !== 'todas'

  const handleClearFilters = () => {
    setSearch('')
    setFilterTipo('todos')
    setFilterContrato('todos')
    setFilterRota('todas')
    setCurrentPage(1)
  }

  const handleOpenDetails = (school: School) => {
    setDetailsSchool(school)
    setDetailsDialogOpen(true)
  }

  const handleOpenCreate = () => {
    setEditingSchool(null)
    setName('')
    setAddress('')
    setContact('')
    setEmail('')
    setTipo('')
    setAlunos('')
    setRouteType('Rota Norte')
    setCustomRoute('')
    setDialogOpen(true)
  }

  const handleOpenEdit = (school: School) => {
    setEditingSchool(school)
    setName(school.name)
    setAddress(school.address)
    setContact(school.contact)
    setEmail(school.email || '')
    setTipo(school.tipo || '')
    setAlunos(school.alunos !== undefined ? String(school.alunos) : '')
    if (PRESET_ROUTES.slice(0, 5).includes(school.route)) {
      setRouteType(school.route)
      setCustomRoute('')
    } else {
      setRouteType('Outra')
      setCustomRoute(school.route || '')
    }
    setDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const trimmedName = name.trim()
    if (!trimmedName) {
      toast.error('Informe o nome da instituição escolar.')
      return
    }

    const finalRoute = routeType === 'Outra' ? customRoute.trim() || 'Sem Rota' : routeType
    const parsedAlunos = alunos.trim() ? parseInt(alunos.trim(), 10) : undefined

    setIsSubmitting(true)
    try {
      if (editingSchool) {
        // Checar duplicidade ao editar (caso mude o nome para outro existente)
        const existing = await escolasService.findByNameNormalized(trimmedName)
        if (existing && existing.id !== editingSchool.id) {
          toast.warning(
            `Já existe outra escola cadastrada com o nome similar "${existing.nome}". Use o registro existente.`,
          )
          setIsSubmitting(false)
          return
        }

        await escolasService.update(editingSchool.id, {
          nome: trimmedName,
          endereco: address.trim(),
          telefone: contact.trim(),
          email: email.trim() || undefined,
          tipo: tipo || undefined,
          rota: finalRoute,
          alunos: parsedAlunos,
        })
        toast.success(`Escola "${trimmedName}" atualizada com sucesso!`)
      } else {
        // Checar duplicidade antes de criar no cadastro mestre
        const existing = await escolasService.findByNameNormalized(trimmedName)
        if (existing) {
          toast.warning(
            `A escola "${existing.nome}" já existe no cadastro mestre. Escolas devem ser criadas apenas uma vez e reutilizadas.`,
          )
          setIsSubmitting(false)
          return
        }

        await escolasService.create({
          nome: trimmedName,
          endereco: address.trim(),
          telefone: contact.trim(),
          email: email.trim() || undefined,
          tipo: tipo || undefined,
          rota: finalRoute,
          alunos: parsedAlunos,
        })
        toast.success(`Escola "${trimmedName}" cadastrada no cadastro mestre global!`)
      }
      setDialogOpen(false)
      await refreshData()
    } catch (err: any) {
      console.error('Erro ao salvar escola:', err)
      const message =
        err?.response?.message || err?.message || 'Falha ao salvar escola no banco de dados.'
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOpenDelete = async (school: School) => {
    setSchoolToDelete(school)
    setDependencyWarning(null)
    setDeleteDialogOpen(true)
    setIsCheckingDeps(true)
    try {
      const deps = await escolasService.checkDependencies(school.id)
      setDependencyWarning(deps)
    } catch (err) {
      console.error('Erro ao verificar dependências da escola:', err)
    } finally {
      setIsCheckingDeps(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!schoolToDelete) return
    setIsDeleting(true)
    try {
      await escolasService.delete(schoolToDelete.id)
      toast.success(`Escola "${schoolToDelete.name}" removida com sucesso!`)
      setDeleteDialogOpen(false)
      setSchoolToDelete(null)
      await refreshData()
    } catch (err: any) {
      console.error('Erro ao excluir escola:', err)
      const message =
        err?.response?.message ||
        err?.message ||
        'Não foi possível excluir a escola. Verifique se há pedidos ou contratos vinculados.'
      toast.error(message)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header com título e ações principais */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Cadastro Mestre de Escolas</h1>
            <Badge variant="outline" className="gap-1 text-xs border-primary/40 text-primary">
              <Globe className="h-3 w-3" /> Global & Independente
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">
            Diretório global único: cada escola é cadastrada <strong>uma única vez</strong> e
            reutilizada em múltiplos contratos PNAE/PAA.
          </p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" onClick={() => setImportDialogOpen(true)} className="gap-1.5">
              <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Importar CSV
            </Button>
            <Button onClick={handleOpenCreate}>
              <Plus className="mr-2 h-4 w-4" /> Nova Escola Mestre
            </Button>
          </div>
        )}
      </div>

      {/* Barra de Filtros: Busca textual, Tipo, Contrato e Rota */}
      <Card className="border-border/60">
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* 1. Busca textual */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Busca Textual</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Nome, endereço, e-mail..."
                  className="pl-9 h-9 text-xs bg-background"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value)
                    setCurrentPage(1)
                  }}
                />
              </div>
            </div>

            {/* 2. Filtro por Tipo */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Tipo de Instituição</Label>
              <Select
                value={filterTipo}
                onValueChange={(val) => {
                  setFilterTipo(val)
                  setCurrentPage(1)
                }}
              >
                <SelectTrigger className="h-9 bg-background text-xs">
                  <SelectValue placeholder="Todos os Tipos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Tipos</SelectItem>
                  {ESCOLA_TIPOS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                  <SelectItem value="sem_tipo">Sem Tipo (Não classificado)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 3. Filtro por Contrato */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Vínculo de Contrato</Label>
              <Select
                value={filterContrato}
                onValueChange={(val) => {
                  setFilterContrato(val)
                  setCurrentPage(1)
                }}
              >
                <SelectTrigger className="h-9 bg-background text-xs">
                  <SelectValue placeholder="Todos os Contratos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Contratos</SelectItem>
                  <SelectItem value="sem_contrato">Sem vínculo contratual</SelectItem>
                  {contracts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.numero} {c.tipo ? `(${c.tipo})` : ''} — {c.escolas.length} escola(s)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 4. Filtro por Rota */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Rota Logística</Label>
              <Select
                value={filterRota}
                onValueChange={(val) => {
                  setFilterRota(val)
                  setCurrentPage(1)
                }}
              >
                <SelectTrigger className="h-9 bg-background text-xs">
                  <SelectValue placeholder="Todas as Rotas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as Rotas</SelectItem>
                  {availableRotas.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Barra inferior de status dos filtros e contagem */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/40 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span>
                Exibindo <strong>{filteredSchools.length}</strong> de{' '}
                <strong>{schools.length}</strong> escola(s)
              </span>
              {hasActiveFilters && (
                <Badge variant="secondary" className="text-[11px] font-normal">
                  Filtros ativos
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-3">
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearFilters}
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
                >
                  <FilterX className="h-3.5 w-3.5" /> Limpar Filtros
                </Button>
              )}
              <div className="flex items-center gap-1.5">
                <span>Linhas:</span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(val) => {
                    setPageSize(Number(val))
                    setCurrentPage(1)
                  }}
                >
                  <SelectTrigger className="h-7 w-[70px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Conteúdo: Tabela de Escolas em Linhas */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" /> Carregando escolas do banco...
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-[280px] font-semibold text-foreground">
                    Escola / Instituição
                  </TableHead>
                  <TableHead className="w-[140px] font-semibold text-foreground">Tipo</TableHead>
                  <TableHead className="w-[170px] font-semibold text-foreground">Rota(s)</TableHead>
                  <TableHead className="w-[100px] text-right font-semibold text-foreground">
                    Alunos
                  </TableHead>
                  <TableHead className="w-[150px] font-semibold text-foreground">
                    Telefone
                  </TableHead>
                  <TableHead className="min-w-[180px] font-semibold text-foreground">
                    Contratos Vinculados
                  </TableHead>
                  <TableHead className="w-[140px] text-right font-semibold text-foreground">
                    Ações
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedSchools.map((school) => {
                  const links = schoolContractLinksMap.get(school.id) || []
                  // Coleta rotas distintas ligadas aos contratos desta escola
                  const contractRouteNames = Array.from(
                    new Set(links.map((l) => l.rotaNome).filter((r) => r && r !== 'Sem Rota')),
                  )

                  return (
                    <TableRow
                      key={school.id}
                      className="cursor-pointer hover:bg-muted/60 transition-colors"
                      onClick={() => handleOpenDetails(school)}
                    >
                      {/* Nome e Endereço resumido */}
                      <TableCell className="font-medium align-middle">
                        <div className="flex items-start gap-2.5 py-0.5">
                          <div className="p-2 bg-primary/10 text-primary rounded-md shrink-0 mt-0.5">
                            <Building2 className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <span
                              className="font-semibold text-foreground block truncate"
                              title={school.name}
                            >
                              {school.name}
                            </span>
                            <span
                              className="text-xs text-muted-foreground block truncate max-w-[240px]"
                              title={school.address || 'Endereço não informado'}
                            >
                              {school.address || (
                                <span className="italic text-muted-foreground/60">
                                  Sem endereço
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      {/* Tipo de Escola */}
                      <TableCell className="align-middle">
                        {school.tipo ? (
                          <Badge
                            variant="secondary"
                            className="text-[11px] font-normal whitespace-nowrap"
                          >
                            {school.tipo}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">-</span>
                        )}
                      </TableCell>

                      {/* Rota(s) vinculada(s) ou rota mestre */}
                      <TableCell className="align-middle">
                        <div className="flex flex-col gap-1">
                          {contractRouteNames.length > 0 ? (
                            <div className="flex flex-wrap items-center gap-1">
                              {contractRouteNames.map((r, idx) => (
                                <Badge
                                  key={idx}
                                  variant="outline"
                                  className="text-[10px] font-normal gap-1 bg-background text-foreground/90 border-border"
                                >
                                  <RouteIcon className="h-2.5 w-2.5 text-primary shrink-0" />
                                  {r}
                                </Badge>
                              ))}
                            </div>
                          ) : school.route && school.route !== 'Sem Rota' ? (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <MapIcon className="h-3 w-3 text-muted-foreground shrink-0" />
                              {school.route}
                              <span className="text-[10px] text-muted-foreground/70">(padrão)</span>
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground/60 italic">
                              Sem rota
                            </span>
                          )}
                        </div>
                      </TableCell>

                      {/* Nº de Alunos */}
                      <TableCell className="text-right align-middle">
                        {school.alunos !== undefined && school.alunos !== null ? (
                          <span className="font-mono text-xs text-foreground/90 font-medium">
                            {school.alunos}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground/50">-</span>
                        )}
                      </TableCell>

                      {/* Telefone */}
                      <TableCell className="align-middle text-xs text-muted-foreground whitespace-nowrap">
                        {school.contact ? (
                          <span className="flex items-center gap-1.5 text-foreground/80">
                            <Phone className="h-3 w-3 text-muted-foreground shrink-0" />
                            {school.contact}
                          </span>
                        ) : (
                          <span className="italic text-muted-foreground/50">Não informado</span>
                        )}
                      </TableCell>

                      {/* Contratos Vinculados (Badges) */}
                      <TableCell className="align-middle">
                        {links.length > 0 ? (
                          <div className="flex flex-wrap items-center gap-1 max-w-[260px]">
                            {links.map((link, idx) => (
                              <Badge
                                key={idx}
                                variant="outline"
                                className="text-[10px] font-medium border-primary/30 text-primary bg-primary/5 gap-1"
                                title={`Contrato: ${link.contratoNumero} • Rota: ${link.rotaNome}`}
                              >
                                <FileCheck className="h-2.5 w-2.5" />
                                {link.contratoNumero}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground/60 italic">
                            Nenhum contrato
                          </span>
                        )}
                      </TableCell>

                      {/* Ações */}
                      <TableCell
                        className="text-right align-middle"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            title="Ver detalhes da escola"
                            onClick={() => handleOpenDetails(school)}
                          >
                            <Eye className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                          </Button>

                          {isAdmin && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                title="Editar dados cadastrais"
                                onClick={() => handleOpenEdit(school)}
                              >
                                <Pencil className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-destructive/80 hover:text-destructive hover:bg-destructive/10"
                                title="Excluir escola"
                                onClick={() => handleOpenDelete(school)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}

                {filteredSchools.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                      <div className="space-y-2">
                        <p className="text-sm">
                          {hasActiveFilters
                            ? 'Nenhuma escola encontrada com os filtros informados.'
                            : 'Nenhuma escola cadastrada no sistema.'}
                        </p>
                        {hasActiveFilters && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleClearFilters}
                            className="text-xs"
                          >
                            Limpar filtros
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Paginação */}
          {filteredSchools.length > pageSize && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground px-1">
              <div>
                Página <strong>{safeCurrentPage}</strong> de <strong>{totalPages}</strong> (
                {filteredSchools.length} escolas no total)
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  disabled={safeCurrentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  title="Página anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="px-2 font-medium text-foreground">
                  {safeCurrentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  disabled={safeCurrentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  title="Próxima página"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Diálogo de Visão Detalhada da Escola Selecionada */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="sm:max-w-[620px] max-h-[90vh] overflow-y-auto">
          {detailsSchool && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between gap-3 pr-6">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <DialogTitle className="text-xl font-bold leading-tight">
                        {detailsSchool.name}
                      </DialogTitle>
                    </div>
                    <DialogDescription className="text-xs">
                      Ficha detalhada do cadastro mestre e histórico de vínculos contratuais.
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-5 pt-2">
                {/* Badges de Destaque */}
                <div className="flex flex-wrap items-center gap-2">
                  {detailsSchool.tipo && (
                    <Badge variant="secondary" className="text-xs">
                      {detailsSchool.tipo}
                    </Badge>
                  )}
                  {detailsSchool.alunos !== undefined && detailsSchool.alunos !== null && (
                    <Badge variant="outline" className="text-xs gap-1">
                      <Users className="h-3 w-3 text-primary" />
                      {detailsSchool.alunos} alunos matriculados
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs gap-1 border-muted-foreground/30">
                    <MapIcon className="h-3 w-3 text-muted-foreground" />
                    Rota padrão: {detailsSchool.route || 'Sem rota padrão'}
                  </Badge>
                </div>

                {/* Bloco de Informações Cadastrais */}
                <div className="rounded-lg border border-border p-4 bg-muted/20 space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Info className="h-3.5 w-3.5 text-primary" /> Dados do Cadastro Mestre
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground block">Endereço</span>
                      <p className="flex items-start gap-1.5 text-foreground/90">
                        <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                        <span>{detailsSchool.address || 'Endereço não informado'}</span>
                      </p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground block">
                        Telefone / Contato
                      </span>
                      <p className="flex items-center gap-1.5 text-foreground/90">
                        <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span>{detailsSchool.contact || 'Telefone não informado'}</span>
                      </p>
                    </div>

                    <div className="space-y-1 sm:col-span-2">
                      <span className="text-xs text-muted-foreground block">
                        E-mail Institucional
                      </span>
                      <p className="flex items-center gap-1.5 text-foreground/90 truncate">
                        <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span>{detailsSchool.email || 'E-mail não informado'}</span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Bloco de Contratos Vinculados e Rotas de Entrega */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Briefcase className="h-3.5 w-3.5 text-primary" /> Contratos Vinculados
                    </h4>
                    <span className="text-xs text-muted-foreground">
                      {(schoolContractLinksMap.get(detailsSchool.id) || []).length} vínculo(s)
                      ativo(s)
                    </span>
                  </div>

                  {(() => {
                    const links = schoolContractLinksMap.get(detailsSchool.id) || []
                    if (links.length === 0) {
                      return (
                        <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                          Esta escola ainda não está vinculada a nenhum contrato vigente.
                          {isAdmin && (
                            <p className="mt-1 text-muted-foreground/80">
                              Para vincular, acesse a tela de <strong>Contratos</strong> e adicione
                              esta escola na aba de escolas participantes.
                            </p>
                          )}
                        </div>
                      )
                    }

                    return (
                      <div className="divide-y divide-border/60 rounded-lg border border-border overflow-hidden bg-card">
                        {links.map((link, idx) => (
                          <div
                            key={idx}
                            className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm hover:bg-muted/30"
                          >
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-foreground">
                                  Contrato {link.contratoNumero}
                                </span>
                                {link.contratoTipo && (
                                  <Badge variant="outline" className="text-[10px] font-normal">
                                    {link.contratoTipo}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Vínculo via collection <code>contrato_escolas</code>
                              </p>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <Badge
                                variant="secondary"
                                className="text-xs font-normal gap-1 bg-primary/10 text-primary border border-primary/20"
                              >
                                <RouteIcon className="h-3 w-3" />
                                Rota: <strong>{link.rotaNome}</strong>
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  })()}
                </div>
              </div>

              <DialogFooter className="pt-3 border-t border-border flex flex-col sm:flex-row gap-2">
                {isAdmin && (
                  <Button
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => {
                      setDetailsDialogOpen(false)
                      handleOpenEdit(detailsSchool)
                    }}
                  >
                    <Pencil className="h-4 w-4" /> Editar Cadastro Mestre
                  </Button>
                )}
                <Button variant="default" onClick={() => setDetailsDialogOpen(false)}>
                  Fechar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Criar / Editar Escola */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingSchool ? 'Editar Escola' : 'Cadastrar Nova Escola'}</DialogTitle>
            <DialogDescription>
              {editingSchool
                ? 'Atualize as informações cadastrais e rota de entrega da instituição.'
                : 'Preencha os dados da nova escola parceira atendida pela cooperativa.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="school-name">
                Nome da Instituição Escolar <span className="text-destructive">*</span>
              </Label>
              <Input
                id="school-name"
                placeholder="Ex: E.M. Darcy Ribeiro"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <p className="text-[11px] text-muted-foreground">
                O nome é normalizado para evitar duplicidades no cadastro mestre global.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-2 sm:col-span-1">
                <Label htmlFor="school-tipo">Tipo</Label>
                <Select
                  value={tipo || 'none'}
                  onValueChange={(val) => setTipo(val === 'none' ? '' : val)}
                >
                  <SelectTrigger id="school-tipo">
                    <SelectValue placeholder="Selecione o tipo (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum (Vazio)</SelectItem>
                    {ESCOLA_TIPOS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 sm:col-span-1">
                <Label htmlFor="school-alunos">Nº de Alunos</Label>
                <Input
                  id="school-alunos"
                  type="number"
                  min="0"
                  placeholder="Ex: 250"
                  value={alunos}
                  onChange={(e) => setAlunos(e.target.value)}
                />
              </div>

              <div className="space-y-2 sm:col-span-1">
                <Label htmlFor="school-contact">Telefone / WhatsApp</Label>
                <Input
                  id="school-contact"
                  placeholder="Ex: (11) 98765-4321"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="school-email">E-mail Institucional</Label>
              <Input
                id="school-email"
                type="email"
                placeholder="Ex: escola.darcy@educacao.gov.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="school-address">Endereço Completo</Label>
              <Input
                id="school-address"
                placeholder="Ex: Rua das Palmeiras, 100 - Bairro Centro"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="school-route">Rota Logística Padrão</Label>
              <Select value={routeType} onValueChange={setRouteType}>
                <SelectTrigger id="school-route">
                  <SelectValue placeholder="Selecione a rota" />
                </SelectTrigger>
                <SelectContent>
                  {PRESET_ROUTES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {routeType === 'Outra' && (
              <div className="space-y-2">
                <Label htmlFor="custom-route">Nome da Nova Rota</Label>
                <Input
                  id="custom-route"
                  placeholder="Ex: Rota Rural 3, Linha 2..."
                  value={customRoute}
                  onChange={(e) => setCustomRoute(e.target.value)}
                  required
                />
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...
                  </>
                ) : editingSchool ? (
                  'Salvar Alterações'
                ) : (
                  'Cadastrar Escola'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* AlertDialog Excluir Escola */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirmar Exclusão de Escola
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Tem certeza de que deseja excluir a escola{' '}
                <strong className="text-foreground">{schoolToDelete?.name}</strong>?
              </p>

              {isCheckingDeps ? (
                <span className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Verificando vínculos com contratos e
                  pedidos...
                </span>
              ) : dependencyWarning &&
                (dependencyWarning.contractsCount > 0 || dependencyWarning.ordersCount > 0) ? (
                <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-xs space-y-1 mt-2">
                  <p className="font-semibold">Atenção aos dados vinculados:</p>
                  {dependencyWarning.contractsCount > 0 && (
                    <p>
                      • {dependencyWarning.contractsCount} contrato(s) registrado(s) para esta
                      escola.
                    </p>
                  )}
                  {dependencyWarning.ordersCount > 0 && (
                    <p>
                      • {dependencyWarning.ordersCount} pedido(s) registrado(s) para esta escola.
                    </p>
                  )}
                  <p className="text-foreground/80 mt-1">
                    A exclusão pode falhar ou afetar a integridade relacional desses registros.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Esta escola não possui contratos ou pedidos vinculados.
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleConfirmDelete()
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Excluindo...
                </>
              ) : (
                'Excluir Escola'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de Importação CSV / Planilha */}
      <SchoolImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        schools={schools}
        onSuccess={async () => {
          await refreshData()
        }}
      />
    </div>
  )
}
