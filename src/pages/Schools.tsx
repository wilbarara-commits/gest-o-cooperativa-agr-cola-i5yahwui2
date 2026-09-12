import { useApp } from '@/context/app-context'
import { useAuth } from '@/context/auth-context'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
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
  Building2,
  MapPin,
  Phone,
  Mail,
  Search,
  Map,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  AlertTriangle,
  Globe,
  FileCheck,
  FileSpreadsheet,
  Users,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useState } from 'react'
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

const ESCOLA_TIPOS: EscolaTipo[] = [
  'Municipal',
  'Estadual',
  'Creche / CMEI',
  'Filantrópica / Conveniada',
  'Outro',
]

export default function Schools() {
  const { schools, contracts, isLoading, refreshData } = useApp()
  const { isAdmin } = useAuth()
  const [search, setSearch] = useState('')
  const [filterTipo, setFilterTipo] = useState<string>('todos')

  // Form dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [editingSchool, setEditingSchool] = useState<School | null>(null)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [contact, setContact] = useState('')
  const [email, setEmail] = useState('')
  const [tipo, setTipo] = useState<EscolaTipo>('Municipal')
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

  const filteredSchools = schools.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.route.toLowerCase().includes(search.toLowerCase()) ||
      s.address.toLowerCase().includes(search.toLowerCase()) ||
      (s.email && s.email.toLowerCase().includes(search.toLowerCase())) ||
      (s.tipo && s.tipo.toLowerCase().includes(search.toLowerCase()))

    const matchesTipo = filterTipo === 'todos' || s.tipo === filterTipo
    return matchesSearch && matchesTipo
  })

  const handleOpenCreate = () => {
    setEditingSchool(null)
    setName('')
    setAddress('')
    setContact('')
    setEmail('')
    setTipo('Municipal')
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
    setTipo((school.tipo as EscolaTipo) || 'Municipal')
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
          tipo: tipo,
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
          tipo: tipo,
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
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-56">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, e-mail, rota..."
              className="pl-9 bg-card"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={filterTipo} onValueChange={setFilterTipo}>
            <SelectTrigger className="w-[150px] bg-card text-xs">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Tipos</SelectItem>
              {ESCOLA_TIPOS.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isAdmin && (
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                onClick={() => setImportDialogOpen(true)}
                className="gap-1.5"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                Importar CSV
              </Button>
              <Button onClick={handleOpenCreate}>
                <Plus className="mr-2 h-4 w-4" /> Nova Escola Mestre
              </Button>
            </div>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" /> Carregando escolas do banco...
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filteredSchools.map((school) => (
            <Card
              key={school.id}
              className="flex flex-col hover:border-primary/50 transition-colors"
            >
              <CardHeader className="flex flex-row gap-4 items-start pb-4">
                <div className="p-3 bg-primary/10 text-primary rounded-lg shrink-0">
                  <Building2 className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <CardTitle className="text-lg leading-tight truncate" title={school.name}>
                      {school.name}
                    </CardTitle>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    {school.tipo && (
                      <Badge variant="secondary" className="text-[10px] font-normal">
                        {school.tipo}
                      </Badge>
                    )}
                    {school.alunos !== undefined && (
                      <Badge variant="outline" className="text-[10px] font-normal gap-1">
                        <Users className="h-2.5 w-2.5" />
                        {school.alunos} alunos
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground flex items-center">
                      <Map className="h-3 w-3 mr-1 shrink-0" />
                      {school.route || 'Sem rota padrão'}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-2.5 text-sm">
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <span className="text-muted-foreground line-clamp-2">
                    {school.address || 'Endereço não informado'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">
                    {school.contact || 'Telefone não informado'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground truncate">
                    {school.email || 'E-mail não informado'}
                  </span>
                </div>

                {/* Vínculos com contratos */}
                {(() => {
                  const linkedContracts = contracts.filter((c) =>
                    c.escolas.some((e) => e.escolaId === school.id),
                  )
                  return (
                    <div className="pt-2 border-t border-border/40 text-xs">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <FileCheck className="h-3.5 w-3.5 text-primary" />
                        {linkedContracts.length > 0
                          ? `Vinculada a ${linkedContracts.length} contrato(s): ${linkedContracts
                              .map((c) => c.numero)
                              .join(', ')}`
                          : 'Ainda não vinculada a contratos'}
                      </span>
                    </div>
                  )
                })()}
              </CardContent>
              <CardFooter className="pt-4 border-t border-border/50 flex gap-2">
                {isAdmin ? (
                  <>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => handleOpenEdit(school)}
                    >
                      <Pencil className="h-4 w-4 mr-1.5" /> Editar
                    </Button>
                    <Button
                      variant="outline"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => handleOpenDelete(school)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <Button variant="outline" className="w-full" disabled>
                    Visualização
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))}
          {filteredSchools.length === 0 && (
            <div className="col-span-full py-12 text-center text-muted-foreground">
              {search ? 'Nenhuma escola corresponde à busca.' : 'Nenhuma escola cadastrada.'}
            </div>
          )}
        </div>
      )}

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
                <Select value={tipo} onValueChange={(val) => setTipo(val as EscolaTipo)}>
                  <SelectTrigger id="school-tipo">
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
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
