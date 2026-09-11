import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Sprout, Lock, Mail, Loader2, AlertCircle, ShieldCheck, UserCheck } from 'lucide-react'
import { useAuth } from '@/context/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, isAuthenticated } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Se já autenticado, redireciona
  React.useEffect(() => {
    if (isAuthenticated) {
      const from = (location.state as any)?.from?.pathname || '/'
      navigate(from, { replace: true })
    }
  }, [isAuthenticated, navigate, location])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!email.trim() || !password) {
      setErrorMessage('Por favor, informe seu e-mail e sua senha.')
      return
    }

    setIsLoading(true)

    try {
      const user = await login(email.trim(), password)
      toast.success(`Bem-vindo(a), ${user.nome || user.name || 'usuário'}!`)
      const from = (location.state as any)?.from?.pathname || '/'
      navigate(from, { replace: true })
    } catch (err: any) {
      console.error('Erro de autenticação:', err)
      const rawMsg = err?.data?.message || err?.message || ''
      if (rawMsg.toLowerCase().includes('failed to authenticate') || err?.status === 400) {
        setErrorMessage('Credenciais inválidas. Verifique seu e-mail e senha e tente novamente.')
      } else {
        setErrorMessage(
          'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.',
        )
      }
    } finally {
      setIsLoading(false)
    }
  }

  // Preencher credenciais de teste para facilidade de demonstração
  const fillCredentials = (type: 'admin' | 'secretaria') => {
    if (type === 'admin') {
      setEmail('admin@coop.local')
      setPassword('admin123')
    } else {
      setEmail('secretaria@coop.local')
      setPassword('secretaria123')
    }
    setErrorMessage(null)
  }

  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center bg-gradient-to-b from-primary/10 via-background to-background p-4 sm:p-6">
      <div className="w-full max-w-md space-y-6">
        {/* Marca / Logotipo CoopGestão */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-sm">
            <Sprout className="h-9 w-9 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <span>CoopGestão</span>
          </h1>
          <p className="text-sm text-muted-foreground max-w-xs">
            Sistema de Gestão para Cooperativas Agrícolas e Programas Institucionais (PNAE / PAA)
          </p>
        </div>

        {/* Card de Login */}
        <Card className="border-border shadow-md backdrop-blur-sm bg-card/95">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl font-semibold tracking-tight text-center">
              Acesse sua conta
            </CardTitle>
            <CardDescription className="text-center text-sm">
              Entre com suas credenciais para acessar os módulos do sistema
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {errorMessage && (
              <Alert variant="destructive" className="py-2.5">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm ml-2">{errorMessage}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail corporativo</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu.email@coop.local"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9"
                    autoComplete="username"
                    disabled={isLoading}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Senha</Label>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9"
                    autoComplete="current-password"
                    disabled={isLoading}
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full font-medium h-10 mt-2" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  'Entrar no Sistema'
                )}
              </Button>
            </form>
          </CardContent>

          <CardFooter className="flex flex-col border-t pt-4 bg-muted/20 space-y-3">
            <p className="text-xs text-muted-foreground text-center font-medium">
              Contas de demonstração com permissões distintas:
            </p>
            <div className="grid grid-cols-2 gap-2 w-full">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fillCredentials('admin')}
                className="text-xs h-auto py-2 px-2.5 flex flex-col items-start border-primary/30 hover:bg-primary/5 hover:border-primary"
              >
                <div className="flex items-center gap-1.5 w-full font-medium text-foreground">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                  <span>Administrador</span>
                </div>
                <span className="text-[10px] text-muted-foreground">Acesso Total</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fillCredentials('secretaria')}
                className="text-xs h-auto py-2 px-2.5 flex flex-col items-start border-blue-400/40 hover:bg-blue-50/50 hover:border-blue-500 dark:hover:bg-blue-950/20"
              >
                <div className="flex items-center gap-1.5 w-full font-medium text-foreground">
                  <UserCheck className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Secretária</span>
                </div>
                <span className="text-[10px] text-muted-foreground">Operacional</span>
              </Button>
            </div>
          </CardFooter>
        </Card>

        {/* Rodapé institucional */}
        <div className="text-center text-xs text-muted-foreground space-y-1">
          <p>© {new Date().getFullYear()} CoopGestão • Gestão Integrada de Cooperativas</p>
          <div className="flex justify-center items-center gap-2 pt-1">
            <Badge
              variant="outline"
              className="text-[11px] font-normal text-muted-foreground border-border"
            >
              Autenticação Segura Skip Cloud
            </Badge>
          </div>
        </div>
      </div>
    </div>
  )
}
