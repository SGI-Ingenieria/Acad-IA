import { FileText, Eye, ExternalLink, GraduationCap, BookOpen, Sparkles } from "lucide-react"
import { useState } from "react"

import { FileListModal } from "./FileListModal"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { useFilesList } from "@/data/hooks/useFiles"
import { cn } from "@/lib/utils"


const recentItems = [
  {
    id: 1,
    title: "Plan de Estudios - Ingeniería en Sistemas 2024",
    category: "Plan de estudios",
    updatedAt: "hace alrededor de 2 años",
    files: ["Marco_Curricular_Nacional_2024.pdf", "Perfiles_Egreso_Ingenieria.pdf"],
    extraFiles: 1,
    icon: GraduationCap,
    color: "text-blue-600 bg-blue-50 border-blue-100"
  },
  {
    id: 2,
    title: "Programación Orientada a Objetos",
    category: "Materia",
    updatedAt: "hace alrededor de 2 años",
    files: ["Metodologias_Activas.docx", "Evaluacion_Competencias.pdf"],
    icon: BookOpen,
    color: "text-green-600 bg-green-50 border-green-100"
  },
  {
    id: 3,
    title: "Mejora de contenidos - Algoritmos",
    category: "Interacción IA",
    updatedAt: "hace alrededor de 2 años",
    files: ["Metodologias_Activas.docx"],
    icon: Sparkles,
    color: "text-purple-600 bg-purple-50 border-purple-100"
  }
]

export function RecentActivityGrid() {
  const [selectedItem, setSelectedItem] = useState<{title: string} | null>(null)
  const { data: archivos, isLoading } = useFilesList({ limit: 6 });
  console.log(archivos);
  
  if (isLoading) return <div>Cargando actividad reciente...</div>;
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {recentItems.map((item) => (
          <Card key={item.id} className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
              <Badge variant="outline" className={cn("flex items-center gap-1.5 px-2 py-0.5 font-medium", item.color)}>
                <item.icon className="w-3.5 h-3.5" />
                {item.category}
              </Badge>
              <span className="text-[11px] text-slate-400 font-medium">{item.updatedAt}</span>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <h3 className="font-bold text-slate-800 leading-tight line-clamp-2">
                {item.title}
              </h3>
              
              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Archivos usados ({item.files.length + (item.extraFiles || 0)})
                </p>
                <div className="space-y-1.5">
                  {item.files.map((file) => (
                    <div key={file} className="flex items-center gap-2 text-slate-600">
                      <FileText className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-xs truncate">{file}</span>
                    </div>
                  ))}
                  {item.extraFiles && (
                    <p className="text-[11px] text-slate-400 ml-5">+{item.extraFiles} más</p>
                  )}
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex items-center justify-between pt-2">
              <Button 
                variant="secondary" 
                size="sm" 
                className="bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200 h-9 px-4"
                onClick={() => setSelectedItem({ title: item.title })}
              >
                <Eye className="w-4 h-4 mr-2" />
                Ver archivos
              </Button>
              
              <Button variant="link" size="sm" className="text-blue-600 font-semibold p-0 h-auto">
                {item.category === "Plan de estudios" ? "Ir al plan" : "Ir a la materia"}
                <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <FileListModal 
        isOpen={!!selectedItem} 
        onClose={() => setSelectedItem(null)} 
        planTitle={selectedItem?.title || ""} 
      />
    </>
  )
}