/* eslint-disable jsx-a11y/click-events-have-key-events */

/* eslint-disable jsx-a11y/no-static-element-interactions */
import { useNavigate, useParams } from '@tanstack/react-router'
import { Plus, Search, BookOpen, Trash2, Library, Edit3 } from 'lucide-react'
import { useState } from 'react'

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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  useCreateBibliografia,
  useDeleteBibliografia,
  useSubjectBibliografia,
  useUpdateBibliografia,
} from '@/data/hooks/useSubjects'
import { cn } from '@/lib/utils'

// --- Interfaces ---
export interface BibliografiaEntry {
  id: string
  tipo: 'BASICA' | 'COMPLEMENTARIA'
  cita: string
  tipo_fuente?: 'MANUAL' | 'BIBLIOTECA'
  biblioteca_item_id?: string | null
  fuenteBibliotecaId?: string
  fuenteBiblioteca?: any
}

export function BibliographyItem() {
  const navigate = useNavigate()
  const { planId, asignaturaId } = useParams({
    from: '/planes/$planId/asignaturas/$asignaturaId',
  })

  // --- 1. Única fuente de verdad: La Query ---
  const { data: bibliografia = [], isLoading } =
    useSubjectBibliografia(asignaturaId)

  // --- 2. Mutaciones ---
  const { mutate: crearBibliografia } = useCreateBibliografia()
  const { mutate: actualizarBibliografia } = useUpdateBibliografia(asignaturaId)
  const { mutate: eliminarBibliografia } = useDeleteBibliografia(asignaturaId)

  // --- 3. Estados de UI (Solo para diálogos y edición) ---
  const [isLibraryDialogOpen, setIsLibraryDialogOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  console.log('Datos actuales en el front:', bibliografia)
  // --- 4. Derivación de datos (Se calculan en cada render) ---
  const basicaEntries = bibliografia.filter((e) => e.tipo === 'BASICA')
  const complementariaEntries = bibliografia.filter(
    (e) => e.tipo === 'COMPLEMENTARIA',
  )

  // --- Handlers Conectados a la Base de Datos ---

  const handleAddFromLibrary = (
    resource: any,
    tipo: 'BASICA' | 'COMPLEMENTARIA',
  ) => {
    const cita = `${resource.autor} (${resource.anio}). ${resource.titulo}. ${resource.editorial}.`
    crearBibliografia(
      {
        asignatura_id: asignaturaId,
        tipo,
        cita,
        referencia_biblioteca: resource.id,
      },
      {
        onSuccess: () => setIsLibraryDialogOpen(false),
      },
    )
  }

  const handleUpdateCita = (id: string, nuevaCita: string) => {
    actualizarBibliografia(
      {
        id,
        updates: { cita: nuevaCita },
      },
      {
        onSuccess: () => setEditingId(null),
      },
    )
  }

  const onConfirmDelete = () => {
    if (deleteId) {
      eliminarBibliografia(deleteId, {
        onSuccess: () => setDeleteId(null),
      })
    }
  }

  if (isLoading)
    return <div className="p-10 text-center">Cargando bibliografía...</div>

  return (
    <div className="animate-in fade-in space-y-8 pb-8 duration-500">
      <div className="flex flex-col gap-4 border-b pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-foreground text-2xl font-bold tracking-tight">
            Bibliografía
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {basicaEntries.length} básica • {complementariaEntries.length}{' '}
            complementaria
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog
            open={isLibraryDialogOpen}
            onOpenChange={setIsLibraryDialogOpen}
          >
            <DialogTrigger asChild>
              <Button
                variant="outline"
                className="border-primary text-primary hover:bg-primary/10"
              >
                <Library className="mr-2 h-4 w-4" /> Buscar en biblioteca
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
              <LibrarySearchDialog
                // CORRECCIÓN: Usamos 'bibliografia' en lugar de 'bibliografia2'
                resources={[]} // Aquí deberías pasar el catálogo general, no la bibliografía de la asignatura
                onSelect={handleAddFromLibrary}
                // CORRECCIÓN: Usamos 'bibliografia' en lugar de 'entries'
                existingIds={bibliografia.map(
                  (e) => e.referencia_biblioteca || '',
                )}
              />
            </DialogContent>
          </Dialog>

          <Button
            onClick={() =>
              navigate({
                to: `/planes/${planId}/asignaturas/${asignaturaId}/bibliografia/nueva`,
                resetScroll: false,
              })
            }
            className="shadow-md"
          >
            <Plus className="mr-2 h-4 w-4" /> Agregar Bibliografía
          </Button>
        </div>
      </div>

      <div className="grid gap-8">
        {/* BASICA */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="bg-primary h-4 w-1 rounded-full" />
            <h3 className="text-foreground font-semibold">
              Bibliografía Básica
            </h3>
          </div>
          <div className="grid gap-3">
            {basicaEntries.map((entry) => (
              <BibliografiaCard
                key={entry.id}
                entry={entry}
                isEditing={editingId === entry.id}
                onEdit={() => setEditingId(entry.id)}
                onStopEditing={() => setEditingId(null)}
                onUpdateCita={handleUpdateCita}
                onDelete={() => setDeleteId(entry.id)}
              />
            ))}
          </div>
        </section>

        {/* COMPLEMENTARIA */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="bg-muted-foreground/40 h-4 w-1 rounded-full" />
            <h3 className="text-foreground font-semibold">
              Bibliografía Complementaria
            </h3>
          </div>
          <div className="grid gap-3">
            {complementariaEntries.map((entry) => (
              <BibliografiaCard
                key={entry.id}
                entry={entry}
                isEditing={editingId === entry.id}
                onEdit={() => setEditingId(entry.id)}
                onStopEditing={() => setEditingId(null)}
                onUpdateCita={handleUpdateCita}
                onDelete={() => setDeleteId(entry.id)}
              />
            ))}
          </div>
        </section>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar referencia?</AlertDialogTitle>
            <AlertDialogDescription>
              La referencia será quitada del plan de estudios.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirmDelete} className="bg-red-600">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// --- Subcomponentes ---

function BibliografiaCard({
  entry,
  isEditing,
  onEdit,
  onStopEditing,
  onUpdateCita,
  onDelete,
}: any) {
  const [localCita, setLocalCita] = useState(entry.cita)

  return (
    <Card
      className={cn(
        'group transition-all hover:shadow-md',
        isEditing && 'ring-primary ring-2',
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <BookOpen
            className={cn(
              'mt-1 h-5 w-5',
              entry.tipo === 'BASICA'
                ? 'text-primary'
                : 'text-muted-foreground',
            )}
          />
          <div className="min-w-0 flex-1">
            {isEditing ? (
              <div className="space-y-2">
                <Textarea
                  value={localCita}
                  onChange={(e) => setLocalCita(e.target.value)}
                  className="min-h-20"
                />
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={onStopEditing}>
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    className="bg-primary hover:bg-primary/90"
                    onClick={() => {
                      onUpdateCita(entry.id, localCita)
                      onStopEditing()
                    }}
                  >
                    Guardar
                  </Button>
                </div>
              </div>
            ) : (
              <div onClick={onEdit} className="cursor-pointer">
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {entry.cita}
                </p>
                {entry.fuenteBiblioteca && (
                  <div className="mt-2 flex gap-2">
                    <Badge
                      variant="secondary"
                      className="bg-muted text-muted-foreground text-[10px]"
                    >
                      Biblioteca
                    </Badge>
                    {entry.fuenteBiblioteca.disponible && (
                      <Badge className="border-primary/20 bg-primary/10 text-primary text-[10px]">
                        Disponible
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          {!isEditing && (
            <div className="flex opacity-0 transition-opacity group-hover:opacity-100">
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-primary h-8 w-8"
                onClick={onEdit}
              >
                <Edit3 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive h-8 w-8"
                onClick={onDelete}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function LibrarySearchDialog({ resources, onSelect, existingIds }: any) {
  const [search, setSearch] = useState('')
  const [tipo, setTipo] = useState<'BASICA' | 'COMPLEMENTARIA'>('BASICA')
  const filtered = (resources || []).filter(
    (r: any) =>
      !existingIds.includes(r.id) &&
      r.titulo?.toLowerCase().includes(search.toLowerCase()),
  )
  console.log(filtered)
  console.log(resources)

  return (
    <div className="space-y-4 py-2">
      <DialogHeader>
        <DialogTitle>Catálogo de Biblioteca</DialogTitle>
      </DialogHeader>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título o autor..."
            className="pl-10"
          />
        </div>
        <Select value={tipo} onValueChange={(v: any) => setTipo(v)}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="BASICA">Básica</SelectItem>
            <SelectItem value="COMPLEMENTARIA">Complem.</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="max-h-75 space-y-2 overflow-y-auto pr-2">
        {filtered.map((res: any) => (
          <div
            key={res.id}
            onClick={() => onSelect(res, tipo)}
            className="group hover:bg-muted/50 flex cursor-pointer items-center justify-between rounded-lg border p-3"
          >
            <div>
              <p className="text-foreground text-sm font-semibold">
                {res.titulo}
              </p>
              <p className="text-muted-foreground text-xs">{res.autor}</p>
            </div>
            <Plus className="text-primary h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
        ))}
      </div>
    </div>
  )
}
