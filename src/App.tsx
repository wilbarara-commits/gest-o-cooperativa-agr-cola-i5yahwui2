import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AppProvider } from '@/context/app-context'

import Layout from './components/Layout'
import Index from './pages/Index'
import NotFound from './pages/NotFound'
import Products from './pages/Products'
import Schools from './pages/Schools'
import Contracts from './pages/Contracts'
import Orders from './pages/Orders'
import DeliveryRoutes from './pages/DeliveryRoutes'
import Atestos from './pages/Atestos'

const App = () => (
  <AppProvider>
    <BrowserRouter>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Index />} />
            <Route path="/produtos" element={<Products />} />
            <Route path="/escolas" element={<Schools />} />
            <Route path="/contratos" element={<Contracts />} />
            <Route path="/pedidos" element={<Orders />} />
            <Route path="/rotas" element={<DeliveryRoutes />} />
            <Route path="/atestos" element={<Atestos />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </TooltipProvider>
    </BrowserRouter>
  </AppProvider>
)

export default App
