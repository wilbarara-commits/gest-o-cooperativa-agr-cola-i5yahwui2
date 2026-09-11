import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from '@/context/auth-context'
import { AppProvider } from '@/context/app-context'
import ProtectedRoute from '@/components/ProtectedRoute'

import Layout from './components/Layout'
import Login from './pages/Login'
import Index from './pages/Index'
import NotFound from './pages/NotFound'
import Products from './pages/Products'
import Schools from './pages/Schools'
import Contracts from './pages/Contracts'
import Orders from './pages/Orders'
import DeliveryRoutes from './pages/DeliveryRoutes'
import Atestos from './pages/Atestos'
import Requirements from './pages/Requirements'

const App = () => (
  <AuthProvider>
    <AppProvider>
      <BrowserRouter>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <Routes>
            {/* Rota pública de login */}
            <Route path="/login" element={<Login />} />

            {/* Rotas protegidas dentro do Layout */}
            <Route
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              {/* Rotas acessíveis tanto por Administrador quanto Secretária */}
              <Route path="/" element={<Index />} />
              <Route path="/pedidos" element={<Orders />} />
              <Route path="/rotas" element={<DeliveryRoutes />} />
              <Route path="/atestos" element={<Atestos />} />

              {/* Rotas restritas exclusivamente para Administrador */}
              <Route
                path="/produtos"
                element={
                  <ProtectedRoute requiredPerfil="administrador">
                    <Products />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/escolas"
                element={
                  <ProtectedRoute requiredPerfil="administrador">
                    <Schools />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/contratos"
                element={
                  <ProtectedRoute requiredPerfil="administrador">
                    <Contracts />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/requisitos"
                element={
                  <ProtectedRoute requiredPerfil="administrador">
                    <Requirements />
                  </ProtectedRoute>
                }
              />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </TooltipProvider>
      </BrowserRouter>
    </AppProvider>
  </AuthProvider>
)

export default App
