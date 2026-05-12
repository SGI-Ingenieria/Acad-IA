import { createFileRoute } from '@tanstack/react-router'
import {
  ArrowRight,
  BookOpenText,
  Laptop,
  Stethoscope,
  Scale,
  Calculator,
  FlaskConical,
  Activity,
  PencilRuler,
  ClipboardCheck,
} from 'lucide-react'

import DashboardHeader from '@/components/dashboard/DashboardHeader'
import PlanEstudiosCard from '@/components/planes/PlanEstudiosCard'

export const Route = createFileRoute('/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    // 1. min-h-screen para asegurar que llene la pantalla verticalmente
    // 2. bg-background para asegurar consistencia con el tema
    <main className="bg-background min-h-screen w-full">
      {/* 1. max-w-7xl: El tope de anchura.
      2. w-full: Para que ocupe el 100% hasta llegar al tope.
      3. mx-auto: Para centrarse.
      4. px-4 md:px-6: Padding RESPONSIVO interno (seguro para móviles y desktop).
      5. py-6: Padding vertical (opcional, para separarse del header).
      */}
      <div className="mx-auto flex w-full flex-col gap-4 p-4 md:px-6 md:pb-6 lg:px-8 lg:pb-8">
        <DashboardHeader
          nombre="Dr. Carlos Mendoza"
          rol="Jefe de Carrera"
          facultad="Facultad de Ingeniería"
        />

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          {/* --- Sección de Mis Planes de Estudio --- */}
          <div className="flex flex-col gap-4 lg:col-span-2">
            {/* --- Título de sección y enlace a página --- */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="text-primary">
                  <BookOpenText className="h-6 w-6" strokeWidth={2} />
                </div>

                <h3 className="text-foreground text-xl font-bold tracking-tight">
                  Mis Planes de Estudio
                </h3>
              </div>

              {/* Usamos 'group' para animar la flecha al hacer hover en el texto */}
              <a
                href="/planes"
                className="group text-muted-foreground hover:text-primary flex items-center gap-1.5 text-sm font-medium transition-colors"
              >
                <span>Ver todos</span>
                {/* La flecha se mueve a la derecha al hacer hover en el grupoo */}
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </a>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <PlanEstudiosCard
                Icono={Laptop}
                nombrePrograma="Ingeniería en Sistemas Computacionales"
                nivel="Licenciatura"
                ciclos="8 semestres"
                facultad="Facultad de Ingeniería"
                estado="Revisión expertos"
                claseColorEstado="bg-amber-600"
                colorFacultad="#2563eb"
                onClick={() => console.log('Navegar a Sistemas...')}
              />

              <PlanEstudiosCard
                Icono={Stethoscope}
                nombrePrograma="Médico Cirujano"
                nivel="Licenciatura"
                ciclos="10 semestres"
                facultad="Facultad de Medicina"
                estado="Aprobado"
                claseColorEstado="bg-emerald-600"
                colorFacultad="#dc2626"
              />

              <PlanEstudiosCard
                Icono={Calculator}
                nombrePrograma="Licenciatura en Actuaría"
                nivel="Licenciatura"
                ciclos="9 semestres"
                facultad="Facultad de Negocios"
                estado="Aprobado"
                claseColorEstado="bg-emerald-600"
                colorFacultad="#059669"
                onClick={() => console.log('Ver Actuaría')}
              />

              <PlanEstudiosCard
                Icono={PencilRuler}
                nombrePrograma="Licenciatura en Arquitectura"
                nivel="Licenciatura"
                ciclos="10 semestres"
                facultad="Facultad Mexicana de Arquitectura, Diseño y Comunicación"
                estado="En proceso"
                claseColorEstado="bg-orange-500"
                colorFacultad="#ea580c"
                onClick={() => console.log('Ver Arquitectura')}
              />

              <PlanEstudiosCard
                Icono={Activity}
                nombrePrograma="Licenciatura en Fisioterapia"
                nivel="Licenciatura"
                ciclos="8 semestres"
                facultad="Escuela de Altos Estudios en Salud"
                estado="Revisión expertos"
                claseColorEstado="bg-amber-600"
                colorFacultad="#0891b2"
                onClick={() => console.log('Ver Fisioterapia')}
              />

              <PlanEstudiosCard
                Icono={Scale}
                nombrePrograma="Licenciatura en Derecho"
                nivel="Licenciatura"
                ciclos="10 semestres"
                facultad="Facultad de Derecho"
                estado="Pendiente"
                claseColorEstado="bg-yellow-500"
                colorFacultad="#7c3aed"
                onClick={() => console.log('Ver Derecho')}
              />

              <PlanEstudiosCard
                Icono={FlaskConical}
                nombrePrograma="Químico Farmacéutico Biólogo"
                nivel="Licenciatura"
                ciclos="9 semestres"
                facultad="Facultad de Ciencias Químicas"
                estado="Actualización"
                claseColorEstado="bg-lime-600"
                colorFacultad="#65a30d"
                onClick={() => console.log('Ver QFB')}
              />
            </div>
          </div>

          {/* --- Sección de Mis Revisiones --- */}
          <div className="flex flex-col gap-4">
            {/* --- Título de sección y enlace a página --- */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="text-primary">
                  <ClipboardCheck className="h-6 w-6" strokeWidth={2} />
                </div>

                <h3 className="text-foreground text-xl font-bold tracking-tight">
                  Mis Revisiones
                </h3>
              </div>

              <a
                href="/revisiones"
                className="group text-muted-foreground hover:text-primary flex items-center gap-1.5 text-sm font-medium transition-colors"
              >
                <span>Ver todas</span>
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </a>
            </div>
            {/* --- Lista de revisiones (simplificada para este ejemplo) --- */}
            <div className="flex flex-col gap-4">
              <div className="min-h-20 rounded-lg border p-4 shadow-md">
                Revision 1
              </div>
              <div className="min-h-20 rounded-lg border p-4 shadow-md">
                Revision 2
              </div>
              <div className="min-h-20 rounded-lg border p-4 shadow-md">
                Revision 3
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
