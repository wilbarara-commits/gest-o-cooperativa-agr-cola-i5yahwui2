import React, { useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/auth-context'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface ProtectedRouteProps {
  children: React.ReactElement
  requiredPerfil?: 'administrador'
}

export default function ProtectedRoute({ children, requiredPerfil }: ProtectedRouteProps) {
  const { user, isAuthenticated, isLoading, hasAccessToRoute } = useAuth()
  const location = useLocation()

  useEffect(() => {
    if (!isLoading && isAuthenticated && requiredPerfil && user?.perfil !== requiredPerfil) {
      toast.error('Acesso não permitido. Seu perfil não possui permissão para acessar esta área.')
    }
  }, [isLoading, isAuthenticated, requiredPerfil, user])

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-background gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground font-medium">Verificando sessão...</p>
      </div>
    )
  }

  if (!isAuthenticated) {
    // Redireciona para /login guardando a rota de origem
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Verifica se o perfil tem permissão para a rota atual ou se a rota exige 'administrador'
  if (requiredPerfil && user?.perfil !== requiredPerfil) {
    return <Navigate to="/" replace />
  }

  if (!hasAccessToRoute(location.pathname)) {
    return <Navigate to="/" replace />
  }

  return children
}
