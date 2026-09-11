import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { UserRecord, UserPerfil } from '@/lib/types'
import { authService } from '@/services/auth'

interface AuthContextType {
  user: UserRecord | null
  isAuthenticated: boolean
  isAdmin: boolean
  isSecretaria: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<UserRecord>
  logout: () => void
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>
  hasAccessToRoute: (pathname: string) => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Rotas restritas apenas para Administrador
const ADMIN_ONLY_ROUTES = ['/produtos', '/contratos', '/escolas', '/requisitos']

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserRecord | null>(() => authService.getCurrentUser())
  const [isLoading, setIsLoading] = useState<boolean>(true)

  useEffect(() => {
    // Sincronizar estado inicial
    setUser(authService.getCurrentUser())
    setIsLoading(false)

    // Ouvir alterações do pb.authStore (persistência e revalidação)
    const unsubscribe = authService.subscribe((updatedUser) => {
      setUser(updatedUser)
    })

    return () => {
      unsubscribe()
    }
  }, [])

  const login = async (email: string, password: string): Promise<UserRecord> => {
    const loggedUser = await authService.login(email, password)
    setUser(loggedUser)
    return loggedUser
  }

  const logout = () => {
    authService.logout()
    setUser(null)
  }

  const changePassword = async (oldPassword: string, newPassword: string): Promise<void> => {
    await authService.changePassword(oldPassword, newPassword)
  }

  const isAuthenticated = !!user
  const isAdmin = user?.perfil === 'administrador'
  const isSecretaria = user?.perfil === 'secretaria'

  const hasAccessToRoute = (pathname: string): boolean => {
    if (!user) return false
    if (isAdmin) return true

    // Secretária não tem acesso às rotas exclusivas do Administrador
    const isRestricted = ADMIN_ONLY_ROUTES.some(
      (route) => pathname === route || pathname.startsWith(`${route}/`),
    )
    return !isRestricted
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isAdmin,
        isSecretaria,
        isLoading,
        login,
        logout,
        changePassword,
        hasAccessToRoute,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
