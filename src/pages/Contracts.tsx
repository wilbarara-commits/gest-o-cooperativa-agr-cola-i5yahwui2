import { useApp } from '@/context/app-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { FileText, Plus } from 'lucide-react'

export default function Contracts() {
  const { contracts } = useApp()

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contratos Institucionais</h1>
          <p className="text-muted-foreground">
            Acompanhe saldos e execuções de contratos PNAE/PAA.
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Novo Contrato
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Visão Geral de Contratos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contrato ID</TableHead>
                  <TableHead>Instituição</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor Total</TableHead>
                  <TableHead className="text-right">Saldo Restante</TableHead>
                  <TableHead className="w-[200px]">Execução</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts.map((contract) => {
                  const used = contract.totalValue - contract.balance
                  const percentage = (used / contract.totalValue) * 100
                  return (
                    <TableRow key={contract.id}>
                      <TableCell className="font-medium text-primary">{contract.id}</TableCell>
                      <TableCell>{contract.schoolName}</TableCell>
                      <TableCell>
                        <Badge
                          variant={contract.status === 'Ativo' ? 'default' : 'secondary'}
                          className={contract.status === 'Ativo' ? 'bg-primary' : ''}
                        >
                          {contract.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        R${' '}
                        {contract.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right font-medium text-green-700">
                        R$ {contract.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1.5">
                          <Progress value={percentage} className="h-2" />
                          <span className="text-xs text-muted-foreground text-right">
                            {percentage.toFixed(0)}% utilizado
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
