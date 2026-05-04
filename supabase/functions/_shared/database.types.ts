export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      archivos: {
        Row: {
          created_at: string
          hash: string | null
          id: string
          openai_file_id: string | null
          path: string
          size: number | null
        }
        Insert: {
          created_at?: string
          hash?: string | null
          id: string
          openai_file_id?: string | null
          path: string
          size?: number | null
        }
        Update: {
          created_at?: string
          hash?: string | null
          id?: string
          openai_file_id?: string | null
          path?: string
          size?: number | null
        }
        Relationships: []
      }
      archivos_repositorios: {
        Row: {
          archivo_id: string
          created_at: string
          repositorio_id: string
        }
        Insert: {
          archivo_id: string
          created_at?: string
          repositorio_id: string
        }
        Update: {
          archivo_id?: string
          created_at?: string
          repositorio_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "archivos_repositorios_archivo_id_fkey"
            columns: ["archivo_id"]
            isOneToOne: false
            referencedRelation: "archivos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "archivos_repositorios_repositorio_id_fkey"
            columns: ["repositorio_id"]
            isOneToOne: false
            referencedRelation: "repositorios"
            referencedColumns: ["id"]
          },
        ]
      }
      asignatura_mensajes_ia: {
        Row: {
          campos: string[]
          conversacion_asignatura_id: string
          enviado_por: string
          estado: Database["public"]["Enums"]["estado_mensaje_ia"]
          fecha_actualizacion: string
          fecha_creacion: string
          id: string
          is_refusal: boolean
          mensaje: string
          propuesta: Json | null
          respuesta: string | null
        }
        Insert: {
          campos?: string[]
          conversacion_asignatura_id: string
          enviado_por?: string
          estado?: Database["public"]["Enums"]["estado_mensaje_ia"]
          fecha_actualizacion?: string
          fecha_creacion?: string
          id?: string
          is_refusal?: boolean
          mensaje: string
          propuesta?: Json | null
          respuesta?: string | null
        }
        Update: {
          campos?: string[]
          conversacion_asignatura_id?: string
          enviado_por?: string
          estado?: Database["public"]["Enums"]["estado_mensaje_ia"]
          fecha_actualizacion?: string
          fecha_creacion?: string
          id?: string
          is_refusal?: boolean
          mensaje?: string
          propuesta?: Json | null
          respuesta?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asignatura_mensajes_ia_conversacion_asignatura_id_fkey"
            columns: ["conversacion_asignatura_id"]
            isOneToOne: false
            referencedRelation: "conversaciones_asignatura"
            referencedColumns: ["id"]
          },
        ]
      }
      asignaturas: {
        Row: {
          actualizado_en: string
          actualizado_por: string | null
          asignatura_hash: string | null
          codigo: string | null
          contenido_tematico: Json
          creado_en: string
          creado_por: string | null
          creditos: number
          criterios_de_evaluacion: Json
          datos: Json
          estado: Database["public"]["Enums"]["estado_asignatura"]
          estructura_id: string | null
          horas_academicas: number | null
          horas_independientes: number | null
          id: string
          linea_plan_id: string | null
          meta_origen: Json
          nombre: string
          numero_ciclo: number | null
          orden_celda: number | null
          plan_estudio_id: string
          prerrequisito_asignatura_id: string | null
          search_vector: unknown
          tipo: Database["public"]["Enums"]["tipo_asignatura"]
          tipo_origen: Database["public"]["Enums"]["tipo_origen"] | null
        }
        Insert: {
          actualizado_en?: string
          actualizado_por?: string | null
          asignatura_hash?: string | null
          codigo?: string | null
          contenido_tematico?: Json
          creado_en?: string
          creado_por?: string | null
          creditos: number
          criterios_de_evaluacion?: Json
          datos?: Json
          estado?: Database["public"]["Enums"]["estado_asignatura"]
          estructura_id?: string | null
          horas_academicas?: number | null
          horas_independientes?: number | null
          id?: string
          linea_plan_id?: string | null
          meta_origen?: Json
          nombre: string
          numero_ciclo?: number | null
          orden_celda?: number | null
          plan_estudio_id: string
          prerrequisito_asignatura_id?: string | null
          search_vector?: unknown
          tipo?: Database["public"]["Enums"]["tipo_asignatura"]
          tipo_origen?: Database["public"]["Enums"]["tipo_origen"] | null
        }
        Update: {
          actualizado_en?: string
          actualizado_por?: string | null
          asignatura_hash?: string | null
          codigo?: string | null
          contenido_tematico?: Json
          creado_en?: string
          creado_por?: string | null
          creditos?: number
          criterios_de_evaluacion?: Json
          datos?: Json
          estado?: Database["public"]["Enums"]["estado_asignatura"]
          estructura_id?: string | null
          horas_academicas?: number | null
          horas_independientes?: number | null
          id?: string
          linea_plan_id?: string | null
          meta_origen?: Json
          nombre?: string
          numero_ciclo?: number | null
          orden_celda?: number | null
          plan_estudio_id?: string
          prerrequisito_asignatura_id?: string | null
          search_vector?: unknown
          tipo?: Database["public"]["Enums"]["tipo_asignatura"]
          tipo_origen?: Database["public"]["Enums"]["tipo_origen"] | null
        }
        Relationships: [
          {
            foreignKeyName: "asignaturas_actualizado_por_fkey"
            columns: ["actualizado_por"]
            isOneToOne: false
            referencedRelation: "usuarios_app"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asignaturas_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "usuarios_app"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asignaturas_estructura_id_fkey"
            columns: ["estructura_id"]
            isOneToOne: false
            referencedRelation: "estructuras_asignatura"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asignaturas_estructura_id_fkey"
            columns: ["estructura_id"]
            isOneToOne: false
            referencedRelation: "plantilla_asignatura"
            referencedColumns: ["estructura_id"]
          },
          {
            foreignKeyName: "asignaturas_linea_plan_fk_compuesta"
            columns: ["linea_plan_id", "plan_estudio_id"]
            isOneToOne: false
            referencedRelation: "lineas_plan"
            referencedColumns: ["id", "plan_estudio_id"]
          },
          {
            foreignKeyName: "asignaturas_plan_estudio_id_fkey"
            columns: ["plan_estudio_id"]
            isOneToOne: false
            referencedRelation: "planes_estudio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asignaturas_plan_estudio_id_fkey"
            columns: ["plan_estudio_id"]
            isOneToOne: false
            referencedRelation: "plantilla_plan"
            referencedColumns: ["plan_estudio_id"]
          },
          {
            foreignKeyName: "asignaturas_prerrequisito_asignatura_id_fkey"
            columns: ["prerrequisito_asignatura_id"]
            isOneToOne: false
            referencedRelation: "asignaturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asignaturas_prerrequisito_asignatura_id_fkey"
            columns: ["prerrequisito_asignatura_id"]
            isOneToOne: false
            referencedRelation: "plantilla_asignatura"
            referencedColumns: ["asignatura_id"]
          },
        ]
      }
      bibliografia_asignatura: {
        Row: {
          actualizado_en: string
          asignatura_id: string
          cita: string
          creado_en: string
          creado_por: string | null
          id: string
          referencia_biblioteca: string | null
          referencia_en_linea: string | null
          tipo: Database["public"]["Enums"]["tipo_bibliografia"]
        }
        Insert: {
          actualizado_en?: string
          asignatura_id: string
          cita: string
          creado_en?: string
          creado_por?: string | null
          id?: string
          referencia_biblioteca?: string | null
          referencia_en_linea?: string | null
          tipo: Database["public"]["Enums"]["tipo_bibliografia"]
        }
        Update: {
          actualizado_en?: string
          asignatura_id?: string
          cita?: string
          creado_en?: string
          creado_por?: string | null
          id?: string
          referencia_biblioteca?: string | null
          referencia_en_linea?: string | null
          tipo?: Database["public"]["Enums"]["tipo_bibliografia"]
        }
        Relationships: [
          {
            foreignKeyName: "bibliografia_asignatura_asignatura_id_fkey"
            columns: ["asignatura_id"]
            isOneToOne: false
            referencedRelation: "asignaturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bibliografia_asignatura_asignatura_id_fkey"
            columns: ["asignatura_id"]
            isOneToOne: false
            referencedRelation: "plantilla_asignatura"
            referencedColumns: ["asignatura_id"]
          },
          {
            foreignKeyName: "bibliografia_asignatura_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "usuarios_app"
            referencedColumns: ["id"]
          },
        ]
      }
      cambios_asignatura: {
        Row: {
          asignatura_id: string
          cambiado_en: string
          cambiado_por: string | null
          campo: string | null
          fuente: Database["public"]["Enums"]["fuente_cambio"] | null
          id: string
          interaccion_ia_id: string | null
          tipo: Database["public"]["Enums"]["tipo_cambio"]
          valor_anterior: Json | null
          valor_nuevo: Json | null
        }
        Insert: {
          asignatura_id: string
          cambiado_en?: string
          cambiado_por?: string | null
          campo?: string | null
          fuente?: Database["public"]["Enums"]["fuente_cambio"] | null
          id?: string
          interaccion_ia_id?: string | null
          tipo: Database["public"]["Enums"]["tipo_cambio"]
          valor_anterior?: Json | null
          valor_nuevo?: Json | null
        }
        Update: {
          asignatura_id?: string
          cambiado_en?: string
          cambiado_por?: string | null
          campo?: string | null
          fuente?: Database["public"]["Enums"]["fuente_cambio"] | null
          id?: string
          interaccion_ia_id?: string | null
          tipo?: Database["public"]["Enums"]["tipo_cambio"]
          valor_anterior?: Json | null
          valor_nuevo?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "cambios_asignatura_asignatura_id_fkey"
            columns: ["asignatura_id"]
            isOneToOne: false
            referencedRelation: "asignaturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cambios_asignatura_asignatura_id_fkey"
            columns: ["asignatura_id"]
            isOneToOne: false
            referencedRelation: "plantilla_asignatura"
            referencedColumns: ["asignatura_id"]
          },
          {
            foreignKeyName: "cambios_asignatura_cambiado_por_fkey"
            columns: ["cambiado_por"]
            isOneToOne: false
            referencedRelation: "usuarios_app"
            referencedColumns: ["id"]
          },
        ]
      }
      cambios_plan: {
        Row: {
          cambiado_en: string
          cambiado_por: string | null
          campo: string | null
          id: string
          plan_estudio_id: string
          response_id: string | null
          tipo: Database["public"]["Enums"]["tipo_cambio"]
          valor_anterior: Json | null
          valor_nuevo: Json | null
        }
        Insert: {
          cambiado_en?: string
          cambiado_por?: string | null
          campo?: string | null
          id?: string
          plan_estudio_id: string
          response_id?: string | null
          tipo: Database["public"]["Enums"]["tipo_cambio"]
          valor_anterior?: Json | null
          valor_nuevo?: Json | null
        }
        Update: {
          cambiado_en?: string
          cambiado_por?: string | null
          campo?: string | null
          id?: string
          plan_estudio_id?: string
          response_id?: string | null
          tipo?: Database["public"]["Enums"]["tipo_cambio"]
          valor_anterior?: Json | null
          valor_nuevo?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "cambios_plan_cambiado_por_fkey"
            columns: ["cambiado_por"]
            isOneToOne: false
            referencedRelation: "usuarios_app"
            referencedColumns: ["id"]
          },
        ]
      }
      carreras: {
        Row: {
          activa: boolean
          actualizado_en: string
          clave_sep: string | null
          creado_en: string
          facultad_id: string
          id: string
          nivel: Database["public"]["Enums"]["nivel_plan_estudio"]
          nombre: string
          nombre_corto: string | null
        }
        Insert: {
          activa?: boolean
          actualizado_en?: string
          clave_sep?: string | null
          creado_en?: string
          facultad_id: string
          id?: string
          nivel?: Database["public"]["Enums"]["nivel_plan_estudio"]
          nombre: string
          nombre_corto?: string | null
        }
        Update: {
          activa?: boolean
          actualizado_en?: string
          clave_sep?: string | null
          creado_en?: string
          facultad_id?: string
          id?: string
          nivel?: Database["public"]["Enums"]["nivel_plan_estudio"]
          nombre?: string
          nombre_corto?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "carreras_facultad_id_fkey"
            columns: ["facultad_id"]
            isOneToOne: false
            referencedRelation: "facultades"
            referencedColumns: ["id"]
          },
        ]
      }
      conversaciones_asignatura: {
        Row: {
          archivado_en: string | null
          archivado_por: string | null
          asignatura_id: string
          conversacion_json: Json
          creado_en: string
          creado_por: string | null
          estado: Database["public"]["Enums"]["estado_conversacion"]
          id: string
          intento_archivado: number
          nombre: string | null
          openai_conversation_id: string
        }
        Insert: {
          archivado_en?: string | null
          archivado_por?: string | null
          asignatura_id: string
          conversacion_json?: Json
          creado_en?: string
          creado_por?: string | null
          estado?: Database["public"]["Enums"]["estado_conversacion"]
          id?: string
          intento_archivado?: number
          nombre?: string | null
          openai_conversation_id: string
        }
        Update: {
          archivado_en?: string | null
          archivado_por?: string | null
          asignatura_id?: string
          conversacion_json?: Json
          creado_en?: string
          creado_por?: string | null
          estado?: Database["public"]["Enums"]["estado_conversacion"]
          id?: string
          intento_archivado?: number
          nombre?: string | null
          openai_conversation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversaciones_asignatura_archivado_por_fkey"
            columns: ["archivado_por"]
            isOneToOne: false
            referencedRelation: "usuarios_app"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversaciones_asignatura_asignatura_id_fkey"
            columns: ["asignatura_id"]
            isOneToOne: false
            referencedRelation: "asignaturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversaciones_asignatura_asignatura_id_fkey"
            columns: ["asignatura_id"]
            isOneToOne: false
            referencedRelation: "plantilla_asignatura"
            referencedColumns: ["asignatura_id"]
          },
          {
            foreignKeyName: "conversaciones_asignatura_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "usuarios_app"
            referencedColumns: ["id"]
          },
        ]
      }
      conversaciones_plan: {
        Row: {
          archivado_en: string | null
          archivado_por: string | null
          conversacion_json: Json
          creado_en: string
          creado_por: string | null
          estado: Database["public"]["Enums"]["estado_conversacion"]
          id: string
          intento_archivado: number
          nombre: string | null
          openai_conversation_id: string
          plan_estudio_id: string
        }
        Insert: {
          archivado_en?: string | null
          archivado_por?: string | null
          conversacion_json?: Json
          creado_en?: string
          creado_por?: string | null
          estado?: Database["public"]["Enums"]["estado_conversacion"]
          id?: string
          intento_archivado?: number
          nombre?: string | null
          openai_conversation_id: string
          plan_estudio_id: string
        }
        Update: {
          archivado_en?: string | null
          archivado_por?: string | null
          conversacion_json?: Json
          creado_en?: string
          creado_por?: string | null
          estado?: Database["public"]["Enums"]["estado_conversacion"]
          id?: string
          intento_archivado?: number
          nombre?: string | null
          openai_conversation_id?: string
          plan_estudio_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversaciones_plan_archivado_por_fkey"
            columns: ["archivado_por"]
            isOneToOne: false
            referencedRelation: "usuarios_app"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversaciones_plan_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "usuarios_app"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversaciones_plan_plan_estudio_id_fkey"
            columns: ["plan_estudio_id"]
            isOneToOne: false
            referencedRelation: "planes_estudio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversaciones_plan_plan_estudio_id_fkey"
            columns: ["plan_estudio_id"]
            isOneToOne: false
            referencedRelation: "plantilla_plan"
            referencedColumns: ["plan_estudio_id"]
          },
        ]
      }
      estados_plan: {
        Row: {
          clave: string
          color: string | null
          es_final: boolean
          etiqueta: string
          id: string
          orden: number
        }
        Insert: {
          clave: string
          color?: string | null
          es_final?: boolean
          etiqueta: string
          id?: string
          orden?: number
        }
        Update: {
          clave?: string
          color?: string | null
          es_final?: boolean
          etiqueta?: string
          id?: string
          orden?: number
        }
        Relationships: []
      }
      estructuras_asignatura: {
        Row: {
          actualizado_en: string
          creado_en: string
          definicion: Json
          id: string
          nombre: string
          template_id: string | null
          tipo: Database["public"]["Enums"]["tipo_estructura_plan"] | null
        }
        Insert: {
          actualizado_en?: string
          creado_en?: string
          definicion?: Json
          id?: string
          nombre: string
          template_id?: string | null
          tipo?: Database["public"]["Enums"]["tipo_estructura_plan"] | null
        }
        Update: {
          actualizado_en?: string
          creado_en?: string
          definicion?: Json
          id?: string
          nombre?: string
          template_id?: string | null
          tipo?: Database["public"]["Enums"]["tipo_estructura_plan"] | null
        }
        Relationships: []
      }
      estructuras_plan: {
        Row: {
          actualizado_en: string
          creado_en: string
          definicion: Json
          id: string
          nombre: string
          template_id: string | null
          tipo: Database["public"]["Enums"]["tipo_estructura_plan"]
        }
        Insert: {
          actualizado_en?: string
          creado_en?: string
          definicion?: Json
          id?: string
          nombre: string
          template_id?: string | null
          tipo: Database["public"]["Enums"]["tipo_estructura_plan"]
        }
        Update: {
          actualizado_en?: string
          creado_en?: string
          definicion?: Json
          id?: string
          nombre?: string
          template_id?: string | null
          tipo?: Database["public"]["Enums"]["tipo_estructura_plan"]
        }
        Relationships: []
      }
      facultades: {
        Row: {
          actualizado_en: string
          color: string | null
          creado_en: string
          icono: string | null
          id: string
          nombre: string
          nombre_corto: string | null
        }
        Insert: {
          actualizado_en?: string
          color?: string | null
          creado_en?: string
          icono?: string | null
          id?: string
          nombre: string
          nombre_corto?: string | null
        }
        Update: {
          actualizado_en?: string
          color?: string | null
          creado_en?: string
          icono?: string | null
          id?: string
          nombre?: string
          nombre_corto?: string | null
        }
        Relationships: []
      }
      interacciones_ia: {
        Row: {
          aceptada: boolean
          asignatura_id: string | null
          conversacion_id: string | null
          creado_en: string
          id: string
          ids_archivos: Json
          ids_vector_store: Json
          modelo: string | null
          plan_estudio_id: string | null
          prompt: Json
          respuesta: Json
          rutas_storage: Json
          temperatura: number | null
          tipo: Database["public"]["Enums"]["tipo_interaccion_ia"]
          usuario_id: string | null
        }
        Insert: {
          aceptada?: boolean
          asignatura_id?: string | null
          conversacion_id?: string | null
          creado_en?: string
          id?: string
          ids_archivos?: Json
          ids_vector_store?: Json
          modelo?: string | null
          plan_estudio_id?: string | null
          prompt?: Json
          respuesta?: Json
          rutas_storage?: Json
          temperatura?: number | null
          tipo: Database["public"]["Enums"]["tipo_interaccion_ia"]
          usuario_id?: string | null
        }
        Update: {
          aceptada?: boolean
          asignatura_id?: string | null
          conversacion_id?: string | null
          creado_en?: string
          id?: string
          ids_archivos?: Json
          ids_vector_store?: Json
          modelo?: string | null
          plan_estudio_id?: string | null
          prompt?: Json
          respuesta?: Json
          rutas_storage?: Json
          temperatura?: number | null
          tipo?: Database["public"]["Enums"]["tipo_interaccion_ia"]
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interacciones_ia_asignatura_id_fkey"
            columns: ["asignatura_id"]
            isOneToOne: false
            referencedRelation: "asignaturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interacciones_ia_asignatura_id_fkey"
            columns: ["asignatura_id"]
            isOneToOne: false
            referencedRelation: "plantilla_asignatura"
            referencedColumns: ["asignatura_id"]
          },
          {
            foreignKeyName: "interacciones_ia_plan_estudio_id_fkey"
            columns: ["plan_estudio_id"]
            isOneToOne: false
            referencedRelation: "planes_estudio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interacciones_ia_plan_estudio_id_fkey"
            columns: ["plan_estudio_id"]
            isOneToOne: false
            referencedRelation: "plantilla_plan"
            referencedColumns: ["plan_estudio_id"]
          },
          {
            foreignKeyName: "interacciones_ia_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios_app"
            referencedColumns: ["id"]
          },
        ]
      }
      lineas_plan: {
        Row: {
          actualizado_en: string
          area: string | null
          color: string | null
          creado_en: string
          id: string
          nombre: string
          orden: number
          plan_estudio_id: string
        }
        Insert: {
          actualizado_en?: string
          area?: string | null
          color?: string | null
          creado_en?: string
          id?: string
          nombre: string
          orden?: number
          plan_estudio_id: string
        }
        Update: {
          actualizado_en?: string
          area?: string | null
          color?: string | null
          creado_en?: string
          id?: string
          nombre?: string
          orden?: number
          plan_estudio_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lineas_plan_plan_estudio_id_fkey"
            columns: ["plan_estudio_id"]
            isOneToOne: false
            referencedRelation: "planes_estudio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineas_plan_plan_estudio_id_fkey"
            columns: ["plan_estudio_id"]
            isOneToOne: false
            referencedRelation: "plantilla_plan"
            referencedColumns: ["plan_estudio_id"]
          },
        ]
      }
      notificaciones: {
        Row: {
          creado_en: string
          id: string
          leida: boolean
          leida_en: string | null
          payload: Json
          tipo: Database["public"]["Enums"]["tipo_notificacion"]
          usuario_id: string
        }
        Insert: {
          creado_en?: string
          id?: string
          leida?: boolean
          leida_en?: string | null
          payload?: Json
          tipo: Database["public"]["Enums"]["tipo_notificacion"]
          usuario_id: string
        }
        Update: {
          creado_en?: string
          id?: string
          leida?: boolean
          leida_en?: string | null
          payload?: Json
          tipo?: Database["public"]["Enums"]["tipo_notificacion"]
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificaciones_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios_app"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_mensajes_ia: {
        Row: {
          campos: string[]
          conversacion_plan_id: string
          enviado_por: string
          estado: Database["public"]["Enums"]["estado_mensaje_ia"]
          fecha_actualizacion: string
          fecha_creacion: string
          id: string
          is_refusal: boolean
          mensaje: string
          propuesta: Json | null
          respuesta: string | null
        }
        Insert: {
          campos?: string[]
          conversacion_plan_id: string
          enviado_por?: string
          estado?: Database["public"]["Enums"]["estado_mensaje_ia"]
          fecha_actualizacion?: string
          fecha_creacion?: string
          id?: string
          is_refusal?: boolean
          mensaje: string
          propuesta?: Json | null
          respuesta?: string | null
        }
        Update: {
          campos?: string[]
          conversacion_plan_id?: string
          enviado_por?: string
          estado?: Database["public"]["Enums"]["estado_mensaje_ia"]
          fecha_actualizacion?: string
          fecha_creacion?: string
          id?: string
          is_refusal?: boolean
          mensaje?: string
          propuesta?: Json | null
          respuesta?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plan_mensajes_ia_conversacion_plan_id_fkey"
            columns: ["conversacion_plan_id"]
            isOneToOne: false
            referencedRelation: "conversaciones_plan"
            referencedColumns: ["id"]
          },
        ]
      }
      planes_estudio: {
        Row: {
          activo: boolean
          actualizado_en: string
          actualizado_por: string | null
          carrera_id: string
          creado_en: string
          creado_por: string | null
          datos: Json
          estado_actual_id: string | null
          estructura_id: string
          id: string
          meta_origen: Json
          nombre: string
          nombre_search: string | null
          numero_ciclos: number
          plan_hash: string | null
          tipo_ciclo: Database["public"]["Enums"]["tipo_ciclo"]
          tipo_origen: Database["public"]["Enums"]["tipo_origen"] | null
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string
          actualizado_por?: string | null
          carrera_id: string
          creado_en?: string
          creado_por?: string | null
          datos?: Json
          estado_actual_id?: string | null
          estructura_id: string
          id?: string
          meta_origen?: Json
          nombre: string
          nombre_search?: string | null
          numero_ciclos: number
          plan_hash?: string | null
          tipo_ciclo: Database["public"]["Enums"]["tipo_ciclo"]
          tipo_origen?: Database["public"]["Enums"]["tipo_origen"] | null
        }
        Update: {
          activo?: boolean
          actualizado_en?: string
          actualizado_por?: string | null
          carrera_id?: string
          creado_en?: string
          creado_por?: string | null
          datos?: Json
          estado_actual_id?: string | null
          estructura_id?: string
          id?: string
          meta_origen?: Json
          nombre?: string
          nombre_search?: string | null
          numero_ciclos?: number
          plan_hash?: string | null
          tipo_ciclo?: Database["public"]["Enums"]["tipo_ciclo"]
          tipo_origen?: Database["public"]["Enums"]["tipo_origen"] | null
        }
        Relationships: [
          {
            foreignKeyName: "planes_estudio_actualizado_por_fkey"
            columns: ["actualizado_por"]
            isOneToOne: false
            referencedRelation: "usuarios_app"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planes_estudio_carrera_id_fkey"
            columns: ["carrera_id"]
            isOneToOne: false
            referencedRelation: "carreras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planes_estudio_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "usuarios_app"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planes_estudio_estado_actual_id_fkey"
            columns: ["estado_actual_id"]
            isOneToOne: false
            referencedRelation: "estados_plan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planes_estudio_estructura_id_fkey"
            columns: ["estructura_id"]
            isOneToOne: false
            referencedRelation: "estructuras_plan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planes_estudio_estructura_id_fkey"
            columns: ["estructura_id"]
            isOneToOne: false
            referencedRelation: "plantilla_plan"
            referencedColumns: ["estructura_id"]
          },
        ]
      }
      repositorios: {
        Row: {
          created_at: string
          id: string
          nombre: string | null
          openai_vector_store_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          nombre?: string | null
          openai_vector_store_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          nombre?: string | null
          openai_vector_store_id?: string | null
        }
        Relationships: []
      }
      responsables_asignatura: {
        Row: {
          asignatura_id: string
          creado_en: string
          id: string
          rol: Database["public"]["Enums"]["rol_responsable_asignatura"]
          usuario_id: string
        }
        Insert: {
          asignatura_id: string
          creado_en?: string
          id?: string
          rol?: Database["public"]["Enums"]["rol_responsable_asignatura"]
          usuario_id: string
        }
        Update: {
          asignatura_id?: string
          creado_en?: string
          id?: string
          rol?: Database["public"]["Enums"]["rol_responsable_asignatura"]
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "responsables_asignatura_asignatura_id_fkey"
            columns: ["asignatura_id"]
            isOneToOne: false
            referencedRelation: "asignaturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "responsables_asignatura_asignatura_id_fkey"
            columns: ["asignatura_id"]
            isOneToOne: false
            referencedRelation: "plantilla_asignatura"
            referencedColumns: ["asignatura_id"]
          },
          {
            foreignKeyName: "responsables_asignatura_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios_app"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          clave: string
          descripcion: string | null
          id: string
          nombre: string
        }
        Insert: {
          clave: string
          descripcion?: string | null
          id?: string
          nombre: string
        }
        Update: {
          clave?: string
          descripcion?: string | null
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      tareas_revision: {
        Row: {
          asignado_a: string
          completado_en: string | null
          creado_en: string
          estado_id: string | null
          estatus: Database["public"]["Enums"]["estado_tarea_revision"]
          fecha_limite: string | null
          id: string
          plan_estudio_id: string
          rol_id: string | null
        }
        Insert: {
          asignado_a: string
          completado_en?: string | null
          creado_en?: string
          estado_id?: string | null
          estatus?: Database["public"]["Enums"]["estado_tarea_revision"]
          fecha_limite?: string | null
          id?: string
          plan_estudio_id: string
          rol_id?: string | null
        }
        Update: {
          asignado_a?: string
          completado_en?: string | null
          creado_en?: string
          estado_id?: string | null
          estatus?: Database["public"]["Enums"]["estado_tarea_revision"]
          fecha_limite?: string | null
          id?: string
          plan_estudio_id?: string
          rol_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tareas_revision_asignado_a_fkey"
            columns: ["asignado_a"]
            isOneToOne: false
            referencedRelation: "usuarios_app"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tareas_revision_estado_id_fkey"
            columns: ["estado_id"]
            isOneToOne: false
            referencedRelation: "estados_plan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tareas_revision_plan_estudio_id_fkey"
            columns: ["plan_estudio_id"]
            isOneToOne: false
            referencedRelation: "planes_estudio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tareas_revision_plan_estudio_id_fkey"
            columns: ["plan_estudio_id"]
            isOneToOne: false
            referencedRelation: "plantilla_plan"
            referencedColumns: ["plan_estudio_id"]
          },
          {
            foreignKeyName: "tareas_revision_rol_id_fkey"
            columns: ["rol_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      transiciones_estado_plan: {
        Row: {
          creado_en: string
          desde_estado_id: string
          hacia_estado_id: string
          id: string
          rol_permitido_id: string
        }
        Insert: {
          creado_en?: string
          desde_estado_id: string
          hacia_estado_id: string
          id?: string
          rol_permitido_id: string
        }
        Update: {
          creado_en?: string
          desde_estado_id?: string
          hacia_estado_id?: string
          id?: string
          rol_permitido_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transiciones_estado_plan_desde_estado_id_fkey"
            columns: ["desde_estado_id"]
            isOneToOne: false
            referencedRelation: "estados_plan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transiciones_estado_plan_hacia_estado_id_fkey"
            columns: ["hacia_estado_id"]
            isOneToOne: false
            referencedRelation: "estados_plan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transiciones_estado_plan_rol_permitido_id_fkey"
            columns: ["rol_permitido_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      usuarios_app: {
        Row: {
          actualizado_en: string
          creado_en: string
          email: string | null
          externo: boolean
          id: string
          nombre_completo: string | null
        }
        Insert: {
          actualizado_en?: string
          creado_en?: string
          email?: string | null
          externo?: boolean
          id: string
          nombre_completo?: string | null
        }
        Update: {
          actualizado_en?: string
          creado_en?: string
          email?: string | null
          externo?: boolean
          id?: string
          nombre_completo?: string | null
        }
        Relationships: []
      }
      usuarios_roles: {
        Row: {
          carrera_id: string | null
          creado_en: string
          facultad_id: string | null
          id: string
          rol_id: string
          usuario_id: string
        }
        Insert: {
          carrera_id?: string | null
          creado_en?: string
          facultad_id?: string | null
          id?: string
          rol_id: string
          usuario_id: string
        }
        Update: {
          carrera_id?: string | null
          creado_en?: string
          facultad_id?: string | null
          id?: string
          rol_id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_roles_carrera_id_fkey"
            columns: ["carrera_id"]
            isOneToOne: false
            referencedRelation: "carreras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuarios_roles_facultad_id_fkey"
            columns: ["facultad_id"]
            isOneToOne: false
            referencedRelation: "facultades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuarios_roles_rol_id_fkey"
            columns: ["rol_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuarios_roles_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios_app"
            referencedColumns: ["id"]
          },
        ]
      }
      vector_stores: {
        Row: {
          creado_en: string
          creado_por: string | null
          id: string
          nombre: string
          openai_vector_id: string | null
        }
        Insert: {
          creado_en?: string
          creado_por?: string | null
          id?: string
          nombre: string
          openai_vector_id?: string | null
        }
        Update: {
          creado_en?: string
          creado_por?: string | null
          id?: string
          nombre?: string
          openai_vector_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vector_stores_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "usuarios_app"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      plantilla_asignatura: {
        Row: {
          asignatura_id: string | null
          estructura_id: string | null
          template_id: string | null
        }
        Relationships: []
      }
      plantilla_plan: {
        Row: {
          estructura_id: string | null
          plan_estudio_id: string | null
          template_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      append_conversacion_asignatura: {
        Args: { p_append: Json; p_id: string }
        Returns: undefined
      }
      append_conversacion_plan: {
        Args: { p_append: Json; p_id: string }
        Returns: undefined
      }
      build_asignaturas_prefix_tsquery: {
        Args: { p_search: string }
        Returns: unknown
      }
      recalcular_vectores_asignaturas: { Args: never; Returns: undefined }
      search_asignaturas: {
        Args: {
          p_carrera_id?: string
          p_facultad_id?: string
          p_limit?: number
          p_offset?: number
          p_plan_estudio_id?: string
          p_search?: string
        }
        Returns: {
          codigo: string
          contenido_tematico: Json
          creditos: number
          datos: Json
          estado: Database["public"]["Enums"]["estado_asignatura"]
          id: string
          nombre: string
          numero_ciclo: number
          plan_estudio_id: string
          rank: number
          tipo: Database["public"]["Enums"]["tipo_asignatura"]
          total_count: number
        }[]
      }
      suma_porcentajes: { Args: { "": Json }; Returns: number }
      unaccent: { Args: { "": string }; Returns: string }
      unaccent_immutable: { Args: { "": string }; Returns: string }
    }
    Enums: {
      estado_asignatura: "borrador" | "revisada" | "aprobada" | "generando"
      estado_conversacion: "ACTIVA" | "ARCHIVANDO" | "ARCHIVADA" | "ERROR"
      estado_mensaje_ia: "PROCESANDO" | "COMPLETADO" | "ERROR"
      estado_tarea_revision: "PENDIENTE" | "COMPLETADA" | "OMITIDA"
      fuente_cambio: "HUMANO" | "IA"
      nivel_plan_estudio:
        | "Licenciatura"
        | "Maestría"
        | "Doctorado"
        | "Especialidad"
        | "Diplomado"
        | "Otro"
      puesto_tipo:
        | "vicerrector"
        | "director_facultad"
        | "secretario_academico"
        | "jefe_carrera"
        | "profesor"
        | "lci"
      rol_responsable_asignatura: "PROFESOR_RESPONSABLE" | "COAUTOR" | "REVISOR"
      tipo_asignatura: "OBLIGATORIA" | "OPTATIVA" | "TRONCAL" | "OTRA"
      tipo_bibliografia: "BASICA" | "COMPLEMENTARIA"
      tipo_cambio:
        | "ACTUALIZACION_CAMPO"
        | "ACTUALIZACION_MAPA"
        | "TRANSICION_ESTADO"
        | "OTRO"
        | "CREACION"
        | "ACTUALIZACION"
      tipo_ciclo: "Semestre" | "Cuatrimestre" | "Trimestre" | "Otro"
      tipo_estructura_plan: "CURRICULAR" | "NO_CURRICULAR"
      tipo_fuente_bibliografia: "MANUAL" | "BIBLIOTECA"
      tipo_interaccion_ia: "GENERAR" | "MEJORAR_SECCION" | "CHAT" | "OTRA"
      tipo_notificacion:
        | "PLAN_ASIGNADO"
        | "ESTADO_CAMBIADO"
        | "TAREA_ASIGNADA"
        | "COMENTARIO"
        | "OTRA"
      tipo_origen:
        | "MANUAL"
        | "IA"
        | "CLONADO_INTERNO"
        | "CLONADO_TRADICIONAL"
        | "OTRO"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      estado_asignatura: ["borrador", "revisada", "aprobada", "generando"],
      estado_conversacion: ["ACTIVA", "ARCHIVANDO", "ARCHIVADA", "ERROR"],
      estado_mensaje_ia: ["PROCESANDO", "COMPLETADO", "ERROR"],
      estado_tarea_revision: ["PENDIENTE", "COMPLETADA", "OMITIDA"],
      fuente_cambio: ["HUMANO", "IA"],
      nivel_plan_estudio: [
        "Licenciatura",
        "Maestría",
        "Doctorado",
        "Especialidad",
        "Diplomado",
        "Otro",
      ],
      puesto_tipo: [
        "vicerrector",
        "director_facultad",
        "secretario_academico",
        "jefe_carrera",
        "profesor",
        "lci",
      ],
      rol_responsable_asignatura: [
        "PROFESOR_RESPONSABLE",
        "COAUTOR",
        "REVISOR",
      ],
      tipo_asignatura: ["OBLIGATORIA", "OPTATIVA", "TRONCAL", "OTRA"],
      tipo_bibliografia: ["BASICA", "COMPLEMENTARIA"],
      tipo_cambio: [
        "ACTUALIZACION_CAMPO",
        "ACTUALIZACION_MAPA",
        "TRANSICION_ESTADO",
        "OTRO",
        "CREACION",
        "ACTUALIZACION",
      ],
      tipo_ciclo: ["Semestre", "Cuatrimestre", "Trimestre", "Otro"],
      tipo_estructura_plan: ["CURRICULAR", "NO_CURRICULAR"],
      tipo_fuente_bibliografia: ["MANUAL", "BIBLIOTECA"],
      tipo_interaccion_ia: ["GENERAR", "MEJORAR_SECCION", "CHAT", "OTRA"],
      tipo_notificacion: [
        "PLAN_ASIGNADO",
        "ESTADO_CAMBIADO",
        "TAREA_ASIGNADA",
        "COMENTARIO",
        "OTRA",
      ],
      tipo_origen: [
        "MANUAL",
        "IA",
        "CLONADO_INTERNO",
        "CLONADO_TRADICIONAL",
        "OTRO",
      ],
    },
  },
} as const
