/* eslint-disable import/order */
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { Button } from "../ui/button"
import { Plus, Upload } from "lucide-react"
import { Input } from "../ui/input"
import { RepositoryGrid } from "./RepositoryGrid"
import { FileTableDetailed } from "./FileTableDetailed"
import { RecentActivityGrid } from "./RecentActivityGrid"
import { UploadFilesModal } from "./modal/UploadFilesModal"
import { useState } from "react"

export function ReferencesLayout() {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Referencias</h1>
          <p className="text-muted-foreground text-sm">Gestiona tu biblioteca de documentos para IA</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline"><Plus className="mr-2 h-4 w-4" /> Nuevo repositorio</Button>
          <Button onClick={() => setIsUploadModalOpen(true)}><Upload className="mr-2 h-4 w-4" /> Subir archivo</Button>
          <UploadFilesModal 
            isOpen={isUploadModalOpen} 
            onClose={() => setIsUploadModalOpen(false)} 
          />
        
        </div>
      </header>

      <Tabs defaultValue="repositorios" className="w-full">
        <div className="flex justify-between items-center mb-4">
          <TabsList>
            <TabsTrigger value="repositorios">Repositorios</TabsTrigger>
            <TabsTrigger value="archivos">Archivos</TabsTrigger>
            <TabsTrigger value="recientes">Recientes</TabsTrigger>
          </TabsList>
          <Input placeholder="Buscar..." className="max-w-xs" />
        </div>
        
        <TabsContent value="repositorios">
          <RepositoryGrid />
        </TabsContent>
        <TabsContent value="archivos">
          <FileTableDetailed />
        </TabsContent>
        <TabsContent value="recientes">
          <RecentActivityGrid />
        </TabsContent>
      </Tabs>
    </div>
  )
}