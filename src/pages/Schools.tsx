import { useApp } from '@/context/app-context'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Building2, MapPin, Phone, Search, Map } from 'lucide-react'
import { useState } from 'react'

export default function Schools() {
  const { schools } = useApp()
  const [search, setSearch] = useState('')

  const filteredSchools = schools.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Escolas Parceiras</h1>
          <p className="text-muted-foreground">
            Diretório de instituições atendidas pela cooperativa.
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar escola..."
            className="pl-9 bg-card"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {filteredSchools.map((school) => (
          <Card key={school.id} className="flex flex-col hover:border-primary/50 transition-colors">
            <CardHeader className="flex flex-row gap-4 items-start pb-4">
              <div className="p-3 bg-primary/10 text-primary rounded-lg">
                <Building2 className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-lg leading-tight">{school.name}</CardTitle>
                <div className="flex items-center text-sm text-muted-foreground mt-2">
                  <Map className="h-3 w-3 mr-1" /> {school.route}
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <span>{school.address}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{school.contact}</span>
              </div>
            </CardContent>
            <CardFooter className="pt-4 border-t border-border/50">
              <Button variant="outline" className="w-full">
                Ver Detalhes
              </Button>
            </CardFooter>
          </Card>
        ))}
        {filteredSchools.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground">
            Nenhuma escola encontrada.
          </div>
        )}
      </div>
    </div>
  )
}
