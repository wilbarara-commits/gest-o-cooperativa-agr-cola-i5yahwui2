import { Outlet, Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Sprout,
  School,
  FileText,
  Map,
  ShoppingCart,
  FileCheck,
  Bell,
  Search,
  Menu,
  LogOut,
  User,
} from 'lucide-react'
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Produtos', path: '/produtos', icon: Sprout },
  { name: 'Escolas', path: '/escolas', icon: School },
  { name: 'Contratos', path: '/contratos', icon: FileText },
  { name: 'Pedidos', path: '/pedidos', icon: ShoppingCart },
  { name: 'Rotas', path: '/rotas', icon: Map },
  { name: 'Atestos', path: '/atestos', icon: FileCheck },
]

export default function Layout() {
  const location = useLocation()

  const NavLinks = ({ onClick }: { onClick?: () => void }) => (
    <nav className="space-y-1 p-4">
      {NAV_ITEMS.map((item) => {
        const isActive = location.pathname === item.path
        return (
          <Link
            key={item.path}
            to={item.path}
            onClick={onClick}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <item.icon
              className={cn('h-5 w-5', isActive ? 'text-primary' : 'text-muted-foreground')}
            />
            {item.name}
          </Link>
        )
      })}
    </nav>
  )

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r bg-card shadow-sm z-10">
        <div className="flex h-16 items-center gap-2 px-6 border-b">
          <Sprout className="h-6 w-6 text-primary" />
          <span className="font-bold text-lg tracking-tight text-primary">CoopGestão</span>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          <NavLinks />
        </div>
      </aside>

      <div className="flex flex-col flex-1 overflow-hidden w-full">
        {/* Header */}
        <header className="flex h-16 items-center justify-between border-b bg-card px-4 md:px-6 shadow-sm z-10">
          <div className="flex items-center gap-4">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                <SheetTitle className="sr-only">Menu de Navegação</SheetTitle>
                <div className="flex h-16 items-center gap-2 px-6 border-b">
                  <Sprout className="h-6 w-6 text-primary" />
                  <span className="font-bold text-lg text-primary">CoopGestão</span>
                </div>
                <NavLinks />
              </SheetContent>
            </Sheet>

            <div className="hidden sm:flex items-center relative w-64 md:w-80">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar escolas, pedidos..."
                className="pl-9 bg-muted/50 border-none focus-visible:ring-1 focus-visible:ring-primary rounded-full"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="relative text-muted-foreground hover:text-primary"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-secondary"></span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                  <Avatar className="h-9 w-9 border border-border">
                    <AvatarImage
                      src="https://img.usecurling.com/ppl/thumbnail?gender=female&seed=1"
                      alt="Avatar"
                    />
                    <AvatarFallback>MA</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <User className="mr-2 h-4 w-4" /> Perfil
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 animate-fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
