import { createFileRoute } from '@tanstack/react-router'
import { UserPlus, Users } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  useCreateUsuario,
  useDarDeBajaUsuario,
  useReactivarUsuario,
  useUsuarios,
} from '@/data/hooks/useUsuarios'
import { usuariosOptions } from '@/data/query/queryOptions'

export const Route = createFileRoute('/usuarios')({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(usuariosOptions()),
  preload: true,
  component: RouteComponent,
})

const FORM_INITIAL = {
  nombre_completo: '',
  email: '',
  password: '',
  externo: false,
}

function RouteComponent() {
  const { data: usuarios = [] } = useUsuarios()
  const createMutation = useCreateUsuario()
  const darDeBajaMutation = useDarDeBajaUsuario()
  const reactivarMutation = useReactivarUsuario()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState(FORM_INITIAL)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createMutation.mutateAsync(form)
      toast.success('Usuario creado correctamente.')
      setDialogOpen(false)
      setForm(FORM_INITIAL)
    } catch (err: any) {
      toast.error(err.message ?? 'Error al crear usuario.')
    }
  }

  const handleDarDeBaja = async (id: string) => {
    try {
      await darDeBajaMutation.mutateAsync(id)
      toast.success('Usuario dado de baja.')
    } catch (err: any) {
      toast.error(err.message ?? 'Error al dar de baja.')
    }
  }

  const handleReactivar = async (id: string) => {
    try {
      await reactivarMutation.mutateAsync(id)
      toast.success('Usuario reactivado.')
    } catch (err: any) {
      toast.error(err.message ?? 'Error al reactivar usuario.')
    }
  }

  return (
    <main className="bg-background min-h-screen w-full">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 lg:px-8 lg:py-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-primary bg-primary/10 rounded-lg p-2">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-foreground text-3xl font-bold">Usuarios</h1>
              <p className="text-muted-foreground text-sm">
                Gestión de usuarios del sistema
              </p>
            </div>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Nuevo Usuario
          </Button>
        </div>

        <Card>
          {usuarios.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-12">
              <Users className="text-muted-foreground h-12 w-12" />
              <div className="text-center">
                <h2 className="text-foreground text-xl font-semibold">
                  Sin usuarios registrados
                </h2>
                <p className="text-muted-foreground text-sm">
                  Comienza creando un nuevo usuario
                </p>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Correo</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Registrado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usuarios.map((u) => (
                  <TableRow
                    key={u.id}
                    className={u.dado_de_baja_en ? 'opacity-60' : ''}
                  >
                    <TableCell className="font-medium">
                      {u.nombre_completo ?? '—'}
                    </TableCell>
                    <TableCell>{u.email ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant={u.externo ? 'outline' : 'secondary'}>
                        {u.externo ? 'Externo' : 'Interno'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {u.dado_de_baja_en ? (
                        <Badge variant="destructive">Inactivo</Badge>
                      ) : (
                        <Badge className="bg-green-600 hover:bg-green-700">
                          Activo
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {new Date(u.creado_en).toLocaleDateString('es-MX')}
                    </TableCell>
                    <TableCell className="text-right">
                      {u.dado_de_baja_en ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReactivar(u.id)}
                          disabled={reactivarMutation.isPending}
                        >
                          Reactivar
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDarDeBaja(u.id)}
                          disabled={darDeBajaMutation.isPending}
                        >
                          Dar de baja
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nuevo usuario</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="nombre_completo">Nombre completo</Label>
                <Input
                  id="nombre_completo"
                  value={form.nombre_completo}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, nombre_completo: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Correo electrónico</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña inicial</Label>
                <Input
                  id="password"
                  type="password"
                  value={form.password}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, password: e.target.value }))
                  }
                  required
                  minLength={6}
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="externo"
                  checked={form.externo}
                  onCheckedChange={(v) =>
                    setForm((f) => ({ ...f, externo: Boolean(v) }))
                  }
                />
                <Label htmlFor="externo" className="cursor-pointer">
                  Usuario externo
                </Label>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Creando...' : 'Crear usuario'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </main>
  )
}
