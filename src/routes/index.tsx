import { createFileRoute, useNavigate } from '@tanstack/react-router'
import {
  BookOpen,
  ClipboardList,
  Users,
  FileText,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  Zap,
  BarChart3,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export const Route = createFileRoute('/')({
  component: Dashboard,
})

interface StatCard {
  label: string
  value: string | number
  icon: React.ReactNode
  color: string
  trend?: string
}

interface FeatureCard {
  title: string
  description: string
  icon: React.ReactNode
  path: string
  badge?: string
  color: string
}

interface ActivityItem {
  id: string
  title: string
  type: 'plan' | 'subject' | 'user' | 'system'
  time: string
  status: 'completed' | 'pending' | 'warning'
}

function Dashboard() {
  const navigate = useNavigate()

  // Mock data - Replace with actual API calls
  const stats: Array<StatCard> = [
    {
      label: 'Planes de Estudio',
      value: 24,
      icon: <ClipboardList className="h-6 w-6" />,
      color: 'bg-blue-50 text-blue-700',
      trend: '+3 este mes',
    },
    {
      label: 'Asignaturas',
      value: 287,
      icon: <BookOpen className="h-6 w-6" />,
      color: 'bg-emerald-50 text-emerald-700',
      trend: '+12 actualizadas',
    },
    {
      label: 'Usuarios Activos',
      value: 48,
      icon: <Users className="h-6 w-6" />,
      color: 'bg-purple-50 text-purple-700',
      trend: 'En línea ahora',
    },
    {
      label: 'Documentos',
      value: 156,
      icon: <FileText className="h-6 w-6" />,
      color: 'bg-orange-50 text-orange-700',
      trend: '+8 nuevos',
    },
  ]

  const features: Array<FeatureCard> = [
    {
      title: 'Mis Planes',
      description: 'Gestiona y revisa planes de estudio',
      icon: <ClipboardList className="h-8 w-8" />,
      path: '/planes',
      color: 'hover:bg-blue-50',
      badge: '3 pendientes',
    },
    {
      title: 'Asignaturas',
      description: 'Administra contenido de cursos',
      icon: <BookOpen className="h-8 w-8" />,
      path: '/asignaturas',
      color: 'hover:bg-emerald-50',
      badge: '12 actualizadas',
    },
    {
      title: 'Usuarios',
      description: 'Gestión de roles y permisos',
      icon: <Users className="h-8 w-8" />,
      path: '/usuarios',
      color: 'hover:bg-purple-50',
    },
    {
      title: 'Reportes',
      description: 'Analytics y estadísticas del sistema',
      icon: <BarChart3 className="h-8 w-8" />,
      path: '/reportes',
      color: 'hover:bg-amber-50',
    },
  ]

  const recentActivity: Array<ActivityItem> = [
    {
      id: '1',
      title: 'Plan "Ingeniería Informática 2024" aprobado por consejo',
      type: 'plan',
      time: 'Hace 2 horas',
      status: 'completed',
    },
    {
      id: '2',
      title: 'Asignatura "Programación Avanzada" actualizada',
      type: 'subject',
      time: 'Hace 4 horas',
      status: 'completed',
    },
    {
      id: '3',
      title: 'Nuevo usuario agregado: Dr. Juan Pérez',
      type: 'user',
      time: 'Hace 1 día',
      status: 'completed',
    },
    {
      id: '4',
      title: 'Plan "Administración" en revisión de expertos',
      type: 'plan',
      time: 'Hace 1 día',
      status: 'pending',
    },
    {
      id: '5',
      title: 'Base de datos sincronizada',
      type: 'system',
      time: 'Hace 6 horas',
      status: 'completed',
    },
  ]

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'plan':
        return <ClipboardList className="h-4 w-4" />
      case 'subject':
        return <BookOpen className="h-4 w-4" />
      case 'user':
        return <Users className="h-4 w-4" />
      case 'system':
        return <Zap className="h-4 w-4" />
      default:
        return null
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <div className="flex items-center gap-1 text-xs text-emerald-700">
            <CheckCircle className="h-3 w-3" />
            Completado
          </div>
        )
      case 'pending':
        return (
          <div className="flex items-center gap-1 text-xs text-amber-700">
            <Clock className="h-3 w-3" />
            Pendiente
          </div>
        )
      case 'warning':
        return (
          <div className="flex items-center gap-1 text-xs text-red-700">
            <AlertCircle className="h-3 w-3" />
            Atención
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-slate-900">
            Panel de Control Acad-IA
          </h1>
          <p className="text-slate-600">
            Bienvenido al sistema de gestión académica integral
          </p>
        </div>

        {/* Stats Grid */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, idx) => (
            <Card
              key={idx}
              className="overflow-hidden border-0 bg-white shadow-sm transition-all hover:shadow-md"
            >
              <div className="p-6">
                <div className="mb-4 flex items-start justify-between">
                  <div
                    className={`flex items-center justify-center rounded-lg p-3 ${stat.color}`}
                  >
                    {stat.icon}
                  </div>
                  {stat.trend && (
                    <div className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
                      <TrendingUp className="h-3 w-3" />
                      {stat.trend}
                    </div>
                  )}
                </div>
                <p className="text-sm font-medium text-slate-600">
                  {stat.label}
                </p>
                <p className="mt-2 text-3xl font-bold text-slate-900">
                  {stat.value}
                </p>
              </div>
            </Card>
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Feature Cards - Left Side (2 cols) */}
          <div className="lg:col-span-2">
            <h2 className="mb-4 text-xl font-bold text-slate-900">
              Acceso Rápido
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {features.map((feature, idx) => (
                <Card
                  key={idx}
                  className={`cursor-pointer border-0 bg-white shadow-sm transition-all hover:shadow-lg ${feature.color}`}
                  onClick={() => navigate({ to: feature.path })}
                >
                  <div className="p-6">
                    <div className="mb-3 flex items-start justify-between">
                      <div className="text-slate-700">{feature.icon}</div>
                      {feature.badge && (
                        <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200">
                          {feature.badge}
                        </Badge>
                      )}
                    </div>
                    <h3 className="mb-1 font-semibold text-slate-900">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-slate-600">
                      {feature.description}
                    </p>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* System Status - Right Side */}
          <div>
            <h2 className="mb-4 text-xl font-bold text-slate-900">
              Estado del Sistema
            </h2>
            <Card className="border-0 bg-white shadow-sm">
              <div className="p-6">
                <div className="space-y-4">
                  {[
                    { label: 'Base de Datos', status: 'online' },
                    { label: 'API Gateway', status: 'online' },
                    { label: 'Storage', status: 'online' },
                    { label: 'Servidor de IA', status: 'online' },
                  ].map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between"
                    >
                      <span className="text-sm font-medium text-slate-700">
                        {item.label}
                      </span>
                      <div className="flex items-center gap-2">
                        <div
                          className={`h-2 w-2 rounded-full ${
                            item.status === 'online'
                              ? 'bg-emerald-500'
                              : 'bg-red-500'
                          }`}
                        />
                        <span className="text-xs font-semibold text-slate-600">
                          {item.status === 'online'
                            ? 'En línea'
                            : 'Desconectado'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="mt-8">
          <h2 className="mb-4 text-xl font-bold text-slate-900">
            Actividad Reciente
          </h2>
          <Card className="border-0 bg-white shadow-sm">
            <div className="overflow-hidden">
              {recentActivity.map((activity, idx) => (
                <div
                  key={activity.id}
                  className={`flex items-start gap-4 border-t border-slate-200 p-4 transition-colors hover:bg-slate-50 ${
                    idx === 0 ? 'border-t-0' : ''
                  }`}
                >
                  <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900">
                      {activity.title}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {activity.time}
                    </p>
                  </div>
                  <div>{getStatusBadge(activity.status)}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button className="flex-1 bg-blue-600 hover:bg-blue-700">
            <ClipboardList className="mr-2 h-4 w-4" />
            Crear Nuevo Plan
          </Button>
          <Button
            variant="outline"
            className="flex-1 border-slate-300 hover:bg-slate-50"
          >
            <BookOpen className="mr-2 h-4 w-4" />
            Agregar Asignatura
          </Button>
          <Button
            variant="outline"
            className="flex-1 border-slate-300 hover:bg-slate-50"
          >
            <BarChart3 className="mr-2 h-4 w-4" />
            Ver Reportes
          </Button>
        </div>
      </div>
    </div>
  )
}
