import {
  FileText,
  Eye,
  ExternalLink,
  GraduationCap,
  BookOpen,
  Sparkles,
} from 'lucide-react'
import { useState } from 'react'

import { FileListModal } from './FileListModal'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { useFilesList } from '@/data/hooks/useFiles'
import { cn } from '@/lib/utils'

// Actualizamos los colores para que respondan al modo oscuro con el prefijo dark:
const recentItems = [
  {
    id: 1,
    title: 'Plan de Estudios - Ingeniería en Sistemas 2024',
    category: 'Plan de estudios',
    updatedAt: 'hace alrededor de 2 años',
    files: [
      'Marco_Curricular_Nacional_2024.pdf',
      'Perfiles_Egreso_Ingenieria.pdf',
    ],
    extraFiles: 1,
    icon: GraduationCap,
    color:
      'text-blue-600 bg-blue-50 border-blue-100 dark:text-blue-400 dark:bg-blue-950/30 dark:border-blue-900/50',
  },
  {
    id: 2,
    title: 'Programación Orientada a Objetos',
    category: 'Materia',
    updatedAt: 'hace alrededor de 2 años',
    files: ['Metodologias_Activas.docx', 'Evaluacion_Competencias.pdf'],
    icon: BookOpen,
    color:
      'text-green-600 bg-green-50 border-green-100 dark:text-green-400 dark:bg-green-950/30 dark:border-green-900/50',
  },
  {
    id: 3,
    title: 'Mejora de contenidos - Algoritmos',
    category: 'Interacción IA',
    updatedAt: 'hace alrededor de 2 años',
    files: ['Metodologias_Activas.docx'],
    icon: Sparkles,
    color:
      'text-purple-600 bg-purple-50 border-purple-100 dark:text-purple-400 dark:bg-purple-950/30 dark:border-purple-900/50',
  },
]

export function RecentActivityGrid() {
  const [selectedItem, setSelectedItem] = useState<{ title: string } | null>(
    null,
  )
  const { data: archivos, isLoading } = useFilesList({ limit: 6 })
  console.log(archivos)

  if (isLoading) {
    return (
      <div className="text-muted-foreground p-8 text-center text-sm">
        Cargando actividad reciente...
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {recentItems.map((item) => (
          <Card
            key={item.id}
            className="border-border bg-card text-card-foreground shadow-sm transition-shadow hover:shadow-md"
          >
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
              <Badge
                variant="outline"
                className={cn(
                  'flex items-center gap-1.5 px-2 py-0.5 font-medium',
                  item.color,
                )}
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.category}
              </Badge>
              <span className="text-muted-foreground text-[11px] font-medium">
                {item.updatedAt}
              </span>
            </CardHeader>

            <CardContent className="space-y-4">
              <h3 className="text-foreground line-clamp-2 leading-tight font-bold">
                {item.title}
              </h3>

              <div className="space-y-2">
                <p className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
                  Archivos usados ({item.files.length + (item.extraFiles || 0)})
                </p>
                <div className="space-y-1.5">
                  {item.files.map((file) => (
                    <div
                      key={file}
                      className="text-muted-foreground hover:text-foreground flex items-center gap-2 transition-colors"
                    >
                      <FileText className="text-muted-foreground/70 h-3.5 w-3.5" />
                      <span className="truncate text-xs">{file}</span>
                    </div>
                  ))}
                  {item.extraFiles && (
                    <p className="text-muted-foreground/60 ml-5 text-[11px]">
                      +{item.extraFiles} más
                    </p>
                  )}
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex items-center justify-between pt-2">
              <Button
                variant="secondary"
                size="sm"
                className="bg-secondary text-secondary-foreground hover:bg-secondary/80 border-border h-9 border px-4"
                onClick={() => setSelectedItem({ title: item.title })}
              >
                <Eye className="mr-2 h-4 w-4" />
                Ver archivos
              </Button>

              <Button
                variant="link"
                size="sm"
                className="text-primary h-auto gap-1 p-0 font-semibold"
              >
                {item.category === 'Plan de estudios'
                  ? 'Ir al plan'
                  : 'Ir a la materia'}
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <FileListModal
        isOpen={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        planTitle={selectedItem?.title || ''}
      />
    </>
  )
}
