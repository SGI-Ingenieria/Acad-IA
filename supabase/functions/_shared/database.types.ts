/* eslint-disable */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      archivos: {
        Row: {
          creado_por: string | null
          created_at: string
          hash: string | null
          id: string
          openai_file_id: string | null
          path: string
          size: number | null
        }
        Insert: {
          creado_por?: string | null
          created_at?: string
          hash?: string | null
          id: string
          openai_file_id?: string | null
          path: string
          size?: number | null
        }
        Update: {
          creado_por?: string | null
          created_at?: string
          hash?: string | null
          id?: string
          openai_file_id?: string | null
          path?: string
          size?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "archivos_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "usuarios_app"
            referencedColumns: ["id"]
          },
        ]
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
          openai_response_id: string | null
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
          openai_response_id?: string | null
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
          openai_response_id?: string | null
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
          creditos: number | null
          criterios_de_evaluacion: Json
          datos: Json
          estado: Database["public"]["Enums"]["estado_asignatura"]
          estructura_id: string
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
          creditos?: number | null
          criterios_de_evaluacion?: Json
          datos?: Json
          estado?: Database["public"]["Enums"]["estado_asignatura"]
          estructura_id: string
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
          creditos?: number | null
          criterios_de_evaluacion?: Json
          datos?: Json
          estado?: Database["public"]["Enums"]["estado_asignatura"]
          estructura_id?: string
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
          anio: number | null
          asignatura_id: string
          autores: Json
          cita: string
          creado_en: string
          creado_por: string | null
          editorial: string | null
          formato: string | null
          id: string
          isbn: string | null
          referencia_biblioteca: string | null
          referencia_en_linea: string | null
          tipo: Database["public"]["Enums"]["tipo_bibliografia"]
          titulo: string | null
        }
        Insert: {
          actualizado_en?: string
          anio?: number | null
          asignatura_id: string
          autores?: Json
          cita: string
          creado_en?: string
          creado_por?: string | null
          editorial?: string | null
          formato?: string | null
          id?: string
          isbn?: string | null
          referencia_biblioteca?: string | null
          referencia_en_linea?: string | null
          tipo: Database["public"]["Enums"]["tipo_bibliografia"]
          titulo?: string | null
        }
        Update: {
          actualizado_en?: string
          anio?: number | null
          asignatura_id?: string
          autores?: Json
          cita?: string
          creado_en?: string
          creado_por?: string | null
          editorial?: string | null
          formato?: string | null
          id?: string
          isbn?: string | null
          referencia_biblioteca?: string | null
          referencia_en_linea?: string | null
          tipo?: Database["public"]["Enums"]["tipo_bibliografia"]
          titulo?: string | null
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
      borradores_campo: {
        Row: {
          actualizado_en: string
          actualizado_por: string | null
          clave: string
          contenido_html: string
          creado_en: string
          creado_por: string | null
          entidad: string
          entidad_id: string
          id: string
          plan_id: string
        }
        Insert: {
          actualizado_en?: string
          actualizado_por?: string | null
          clave: string
          contenido_html?: string
          creado_en?: string
          creado_por?: string | null
          entidad: string
          entidad_id: string
          id?: string
          plan_id: string
        }
        Update: {
          actualizado_en?: string
          actualizado_por?: string | null
          clave?: string
          contenido_html?: string
          creado_en?: string
          creado_por?: string | null
          entidad?: string
          entidad_id?: string
          id?: string
          plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "borradores_campo_actualizado_por_fkey"
            columns: ["actualizado_por"]
            isOneToOne: false
            referencedRelation: "usuarios_app"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "borradores_campo_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "usuarios_app"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "borradores_campo_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "planes_estudio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "borradores_campo_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plantilla_plan"
            referencedColumns: ["plan_estudio_id"]
          },
        ]
      }
      cambios_asignatura: {
        Row: {
          admin_override: boolean
          admin_override_estado_clave: string | null
          admin_override_motivo: string | null
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
          admin_override?: boolean
          admin_override_estado_clave?: string | null
          admin_override_motivo?: string | null
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
          admin_override?: boolean
          admin_override_estado_clave?: string | null
          admin_override_motivo?: string | null
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
          admin_override: boolean
          admin_override_estado_clave: string | null
          admin_override_motivo: string | null
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
          admin_override?: boolean
          admin_override_estado_clave?: string | null
          admin_override_motivo?: string | null
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
          admin_override?: boolean
          admin_override_estado_clave?: string | null
          admin_override_motivo?: string | null
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
          actualizado_por: string | null
          clave_sep: string | null
          creado_en: string
          creado_por: string | null
          facultad_id: string
          id: string
          nivel: Database["public"]["Enums"]["nivel_plan_estudio"]
          nombre: string
          nombre_corto: string | null
        }
        Insert: {
          activa?: boolean
          actualizado_en?: string
          actualizado_por?: string | null
          clave_sep?: string | null
          creado_en?: string
          creado_por?: string | null
          facultad_id: string
          id?: string
          nivel?: Database["public"]["Enums"]["nivel_plan_estudio"]
          nombre: string
          nombre_corto?: string | null
        }
        Update: {
          activa?: boolean
          actualizado_en?: string
          actualizado_por?: string | null
          clave_sep?: string | null
          creado_en?: string
          creado_por?: string | null
          facultad_id?: string
          id?: string
          nivel?: Database["public"]["Enums"]["nivel_plan_estudio"]
          nombre?: string
          nombre_corto?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "carreras_actualizado_por_fkey"
            columns: ["actualizado_por"]
            isOneToOne: false
            referencedRelation: "usuarios_app"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carreras_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "usuarios_app"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carreras_facultad_id_fkey"
            columns: ["facultad_id"]
            isOneToOne: false
            referencedRelation: "facultades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carreras_facultad_id_fkey"
            columns: ["facultad_id"]
            isOneToOne: false
            referencedRelation: "registros_oficiales_plan_detalle"
            referencedColumns: ["facultad_id"]
          },
        ]
      }
      comentarios_asignatura: {
        Row: {
          asignatura_id: string
          autor_id: string | null
          categoria: string
          comentario_padre_id: string | null
          creado_en: string
          cuerpo: string
          id: string
          resuelto: boolean
        }
        Insert: {
          asignatura_id: string
          autor_id?: string | null
          categoria?: string
          comentario_padre_id?: string | null
          creado_en?: string
          cuerpo: string
          id?: string
          resuelto?: boolean
        }
        Update: {
          asignatura_id?: string
          autor_id?: string | null
          categoria?: string
          comentario_padre_id?: string | null
          creado_en?: string
          cuerpo?: string
          id?: string
          resuelto?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "comentarios_asignatura_asignatura_id_fkey"
            columns: ["asignatura_id"]
            isOneToOne: false
            referencedRelation: "asignaturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comentarios_asignatura_asignatura_id_fkey"
            columns: ["asignatura_id"]
            isOneToOne: false
            referencedRelation: "plantilla_asignatura"
            referencedColumns: ["asignatura_id"]
          },
          {
            foreignKeyName: "comentarios_asignatura_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "usuarios_app"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comentarios_asignatura_comentario_padre_id_fkey"
            columns: ["comentario_padre_id"]
            isOneToOne: false
            referencedRelation: "comentarios_asignatura"
            referencedColumns: ["id"]
          },
        ]
      }
      comentarios_plan: {
        Row: {
          autor_id: string | null
          categoria: string
          comentario_padre_id: string | null
          creado_en: string
          cuerpo: string
          estado_id: string | null
          id: string
          plan_estudio_id: string
          resuelto: boolean
        }
        Insert: {
          autor_id?: string | null
          categoria?: string
          comentario_padre_id?: string | null
          creado_en?: string
          cuerpo: string
          estado_id?: string | null
          id?: string
          plan_estudio_id: string
          resuelto?: boolean
        }
        Update: {
          autor_id?: string | null
          categoria?: string
          comentario_padre_id?: string | null
          creado_en?: string
          cuerpo?: string
          estado_id?: string | null
          id?: string
          plan_estudio_id?: string
          resuelto?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "comentarios_plan_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "usuarios_app"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comentarios_plan_comentario_padre_id_fkey"
            columns: ["comentario_padre_id"]
            isOneToOne: false
            referencedRelation: "comentarios_plan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comentarios_plan_estado_id_fkey"
            columns: ["estado_id"]
            isOneToOne: false
            referencedRelation: "estados_plan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comentarios_plan_plan_estudio_id_fkey"
            columns: ["plan_estudio_id"]
            isOneToOne: false
            referencedRelation: "planes_estudio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comentarios_plan_plan_estudio_id_fkey"
            columns: ["plan_estudio_id"]
            isOneToOne: false
            referencedRelation: "plantilla_plan"
            referencedColumns: ["plan_estudio_id"]
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
      crash_reports: {
        Row: {
          app_version: string | null
          build_id: string | null
          component_stack: string | null
          contexto: Json
          creado_en: string
          fingerprint: string | null
          id: string
          mensaje: string
          nombre: string | null
          notas: string | null
          origen: string
          resuelto_en: string | null
          resuelto_por: string | null
          ruta: string | null
          severidad: string
          stack: string | null
          url: string | null
          user_agent: string | null
          usuario_id: string | null
        }
        Insert: {
          app_version?: string | null
          build_id?: string | null
          component_stack?: string | null
          contexto?: Json
          creado_en?: string
          fingerprint?: string | null
          id?: string
          mensaje: string
          nombre?: string | null
          notas?: string | null
          origen?: string
          resuelto_en?: string | null
          resuelto_por?: string | null
          ruta?: string | null
          severidad?: string
          stack?: string | null
          url?: string | null
          user_agent?: string | null
          usuario_id?: string | null
        }
        Update: {
          app_version?: string | null
          build_id?: string | null
          component_stack?: string | null
          contexto?: Json
          creado_en?: string
          fingerprint?: string | null
          id?: string
          mensaje?: string
          nombre?: string | null
          notas?: string | null
          origen?: string
          resuelto_en?: string | null
          resuelto_por?: string | null
          ruta?: string | null
          severidad?: string
          stack?: string | null
          url?: string | null
          user_agent?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crash_reports_resuelto_por_fkey"
            columns: ["resuelto_por"]
            isOneToOne: false
            referencedRelation: "usuarios_app"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crash_reports_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios_app"
            referencedColumns: ["id"]
          },
        ]
      }
      estados_plan: {
        Row: {
          clave: string
          color: string | null
          es_campo_editable: boolean
          es_final: boolean
          etiqueta: string
          id: string
          orden: number
        }
        Insert: {
          clave: string
          color?: string | null
          es_campo_editable?: boolean
          es_final?: boolean
          etiqueta: string
          id?: string
          orden?: number
        }
        Update: {
          clave?: string
          color?: string | null
          es_campo_editable?: boolean
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
          actualizado_por: string | null
          creado_en: string
          creado_por: string | null
          definicion: Json
          estructura_plan_id: string
          id: string
          nombre: string
          template_id: string | null
          tipo: Database["public"]["Enums"]["tipo_estructura_plan"] | null
        }
        Insert: {
          actualizado_en?: string
          actualizado_por?: string | null
          creado_en?: string
          creado_por?: string | null
          definicion?: Json
          estructura_plan_id: string
          id?: string
          nombre: string
          template_id?: string | null
          tipo?: Database["public"]["Enums"]["tipo_estructura_plan"] | null
        }
        Update: {
          actualizado_en?: string
          actualizado_por?: string | null
          creado_en?: string
          creado_por?: string | null
          definicion?: Json
          estructura_plan_id?: string
          id?: string
          nombre?: string
          template_id?: string | null
          tipo?: Database["public"]["Enums"]["tipo_estructura_plan"] | null
        }
        Relationships: [
          {
            foreignKeyName: "estructuras_asignatura_actualizado_por_fkey"
            columns: ["actualizado_por"]
            isOneToOne: false
            referencedRelation: "usuarios_app"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estructuras_asignatura_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "usuarios_app"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estructuras_asignatura_estructura_plan_id_fkey"
            columns: ["estructura_plan_id"]
            isOneToOne: false
            referencedRelation: "estructuras_plan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estructuras_asignatura_estructura_plan_id_fkey"
            columns: ["estructura_plan_id"]
            isOneToOne: false
            referencedRelation: "plantilla_plan"
            referencedColumns: ["estructura_id"]
          },
        ]
      }
      estructuras_plan: {
        Row: {
          actualizado_en: string
          actualizado_por: string | null
          creado_en: string
          creado_por: string | null
          definicion: Json
          excel_template_id: string | null
          id: string
          nombre: string
          template_id: string | null
          tipo: Database["public"]["Enums"]["tipo_estructura_plan"]
        }
        Insert: {
          actualizado_en?: string
          actualizado_por?: string | null
          creado_en?: string
          creado_por?: string | null
          definicion?: Json
          excel_template_id?: string | null
          id?: string
          nombre: string
          template_id?: string | null
          tipo: Database["public"]["Enums"]["tipo_estructura_plan"]
        }
        Update: {
          actualizado_en?: string
          actualizado_por?: string | null
          creado_en?: string
          creado_por?: string | null
          definicion?: Json
          excel_template_id?: string | null
          id?: string
          nombre?: string
          template_id?: string | null
          tipo?: Database["public"]["Enums"]["tipo_estructura_plan"]
        }
        Relationships: [
          {
            foreignKeyName: "estructuras_plan_actualizado_por_fkey"
            columns: ["actualizado_por"]
            isOneToOne: false
            referencedRelation: "usuarios_app"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estructuras_plan_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "usuarios_app"
            referencedColumns: ["id"]
          },
        ]
      }
      expertos: {
        Row: {
          contacto: string | null
          creado_en: string
          creado_por: string | null
          id: string
          institucion: string | null
          nombre: string
          tipo: string
          usuario_id: string | null
        }
        Insert: {
          contacto?: string | null
          creado_en?: string
          creado_por?: string | null
          id?: string
          institucion?: string | null
          nombre: string
          tipo?: string
          usuario_id?: string | null
        }
        Update: {
          contacto?: string | null
          creado_en?: string
          creado_por?: string | null
          id?: string
          institucion?: string | null
          nombre?: string
          tipo?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expertos_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "usuarios_app"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expertos_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios_app"
            referencedColumns: ["id"]
          },
        ]
      }
      facultades: {
        Row: {
          activa: boolean
          actualizado_en: string
          actualizado_por: string | null
          color: string | null
          creado_en: string
          creado_por: string | null
          icono: string | null
          id: string
          nombre: string
          nombre_corto: string | null
          prefijo: string | null
        }
        Insert: {
          activa?: boolean
          actualizado_en?: string
          actualizado_por?: string | null
          color?: string | null
          creado_en?: string
          creado_por?: string | null
          icono?: string | null
          id?: string
          nombre: string
          nombre_corto?: string | null
          prefijo?: string | null
        }
        Update: {
          activa?: boolean
          actualizado_en?: string
          actualizado_por?: string | null
          color?: string | null
          creado_en?: string
          creado_por?: string | null
          icono?: string | null
          id?: string
          nombre?: string
          nombre_corto?: string | null
          prefijo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "facultades_actualizado_por_fkey"
            columns: ["actualizado_por"]
            isOneToOne: false
            referencedRelation: "usuarios_app"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facultades_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "usuarios_app"
            referencedColumns: ["id"]
          },
        ]
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
      lineas_curriculares_sugeridas: {
        Row: {
          activa: boolean
          actualizado_en: string
          actualizado_por: string | null
          area: string | null
          color: string | null
          creado_en: string
          creado_por: string | null
          facultad_id: string
          id: string
          nombre: string
          orden: number
        }
        Insert: {
          activa?: boolean
          actualizado_en?: string
          actualizado_por?: string | null
          area?: string | null
          color?: string | null
          creado_en?: string
          creado_por?: string | null
          facultad_id: string
          id?: string
          nombre: string
          orden?: number
        }
        Update: {
          activa?: boolean
          actualizado_en?: string
          actualizado_por?: string | null
          area?: string | null
          color?: string | null
          creado_en?: string
          creado_por?: string | null
          facultad_id?: string
          id?: string
          nombre?: string
          orden?: number
        }
        Relationships: [
          {
            foreignKeyName: "lineas_curriculares_sugeridas_actualizado_por_fkey"
            columns: ["actualizado_por"]
            isOneToOne: false
            referencedRelation: "usuarios_app"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineas_curriculares_sugeridas_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "usuarios_app"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineas_curriculares_sugeridas_facultad_id_fkey"
            columns: ["facultad_id"]
            isOneToOne: false
            referencedRelation: "facultades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineas_curriculares_sugeridas_facultad_id_fkey"
            columns: ["facultad_id"]
            isOneToOne: false
            referencedRelation: "registros_oficiales_plan_detalle"
            referencedColumns: ["facultad_id"]
          },
        ]
      }
      lineas_plan: {
        Row: {
          actualizado_en: string
          actualizado_por: string | null
          area: string | null
          color: string | null
          creado_en: string
          creado_por: string | null
          id: string
          nombre: string
          orden: number
          plan_estudio_id: string
        }
        Insert: {
          actualizado_en?: string
          actualizado_por?: string | null
          area?: string | null
          color?: string | null
          creado_en?: string
          creado_por?: string | null
          id?: string
          nombre: string
          orden?: number
          plan_estudio_id: string
        }
        Update: {
          actualizado_en?: string
          actualizado_por?: string | null
          area?: string | null
          color?: string | null
          creado_en?: string
          creado_por?: string | null
          id?: string
          nombre?: string
          orden?: number
          plan_estudio_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lineas_plan_actualizado_por_fkey"
            columns: ["actualizado_por"]
            isOneToOne: false
            referencedRelation: "usuarios_app"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineas_plan_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "usuarios_app"
            referencedColumns: ["id"]
          },
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
      permisos: {
        Row: {
          clave: string
          creado_en: string
          descripcion: string | null
          grupo: string
          id: string
          nombre: string
          orden: number
        }
        Insert: {
          clave: string
          creado_en?: string
          descripcion?: string | null
          grupo?: string
          id?: string
          nombre: string
          orden?: number
        }
        Update: {
          clave?: string
          creado_en?: string
          descripcion?: string | null
          grupo?: string
          id?: string
          nombre?: string
          orden?: number
        }
        Relationships: []
      }
      plan_expertos: {
        Row: {
          creado_en: string
          experto_id: string
          id: string
          plan_estudio_id: string
        }
        Insert: {
          creado_en?: string
          experto_id: string
          id?: string
          plan_estudio_id: string
        }
        Update: {
          creado_en?: string
          experto_id?: string
          id?: string
          plan_estudio_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_expertos_experto_id_fkey"
            columns: ["experto_id"]
            isOneToOne: false
            referencedRelation: "expertos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_expertos_plan_estudio_id_fkey"
            columns: ["plan_estudio_id"]
            isOneToOne: false
            referencedRelation: "planes_estudio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_expertos_plan_estudio_id_fkey"
            columns: ["plan_estudio_id"]
            isOneToOne: false
            referencedRelation: "plantilla_plan"
            referencedColumns: ["plan_estudio_id"]
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
          openai_response_id: string | null
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
          openai_response_id?: string | null
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
          openai_response_id?: string | null
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
          fecha_inicio_imparticion: string | null
          id: string
          meta_origen: Json
          nombre: string | null
          nombre_display: string
          nombre_propuesto: string | null
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
          fecha_inicio_imparticion?: string | null
          id?: string
          meta_origen?: Json
          nombre?: string | null
          nombre_display: string
          nombre_propuesto?: string | null
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
          fecha_inicio_imparticion?: string | null
          id?: string
          meta_origen?: Json
          nombre?: string | null
          nombre_display?: string
          nombre_propuesto?: string | null
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
            foreignKeyName: "planes_estudio_carrera_id_fkey"
            columns: ["carrera_id"]
            isOneToOne: false
            referencedRelation: "registros_oficiales_plan_detalle"
            referencedColumns: ["carrera_id"]
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
      reasignaciones: {
        Row: {
          creado_en: string
          detalle: Json
          id: string
          reasignado_por: string | null
          usuario_destino: string | null
          usuario_origen: string | null
        }
        Insert: {
          creado_en?: string
          detalle: Json
          id?: string
          reasignado_por?: string | null
          usuario_destino?: string | null
          usuario_origen?: string | null
        }
        Update: {
          creado_en?: string
          detalle?: Json
          id?: string
          reasignado_por?: string | null
          usuario_destino?: string | null
          usuario_origen?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reasignaciones_reasignado_por_fkey"
            columns: ["reasignado_por"]
            isOneToOne: false
            referencedRelation: "usuarios_app"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reasignaciones_usuario_destino_fkey"
            columns: ["usuario_destino"]
            isOneToOne: false
            referencedRelation: "usuarios_app"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reasignaciones_usuario_origen_fkey"
            columns: ["usuario_origen"]
            isOneToOne: false
            referencedRelation: "usuarios_app"
            referencedColumns: ["id"]
          },
        ]
      }
      registros_oficiales_plan: {
        Row: {
          actualizado_en: string
          actualizado_por: string | null
          autoridad: string
          clave_sep: string
          creado_en: string
          documento_archivo_id: string | null
          documento_bucket: string
          documento_mime: string | null
          documento_nombre: string | null
          documento_path: string | null
          documento_size: number | null
          documento_url: string | null
          fecha_aprobacion: string
          id: string
          numero_acuerdo: string
          observaciones: string | null
          plan_estudio_id: string
          registrado_por: string | null
          vigencia_fin: string | null
          vigencia_inicio: string
        }
        Insert: {
          actualizado_en?: string
          actualizado_por?: string | null
          autoridad?: string
          clave_sep: string
          creado_en?: string
          documento_archivo_id?: string | null
          documento_bucket?: string
          documento_mime?: string | null
          documento_nombre?: string | null
          documento_path?: string | null
          documento_size?: number | null
          documento_url?: string | null
          fecha_aprobacion: string
          id?: string
          numero_acuerdo: string
          observaciones?: string | null
          plan_estudio_id: string
          registrado_por?: string | null
          vigencia_fin?: string | null
          vigencia_inicio: string
        }
        Update: {
          actualizado_en?: string
          actualizado_por?: string | null
          autoridad?: string
          clave_sep?: string
          creado_en?: string
          documento_archivo_id?: string | null
          documento_bucket?: string
          documento_mime?: string | null
          documento_nombre?: string | null
          documento_path?: string | null
          documento_size?: number | null
          documento_url?: string | null
          fecha_aprobacion?: string
          id?: string
          numero_acuerdo?: string
          observaciones?: string | null
          plan_estudio_id?: string
          registrado_por?: string | null
          vigencia_fin?: string | null
          vigencia_inicio?: string
        }
        Relationships: [
          {
            foreignKeyName: "registros_oficiales_plan_actualizado_por_fkey"
            columns: ["actualizado_por"]
            isOneToOne: false
            referencedRelation: "usuarios_app"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registros_oficiales_plan_documento_archivo_id_fkey"
            columns: ["documento_archivo_id"]
            isOneToOne: false
            referencedRelation: "archivos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registros_oficiales_plan_plan_estudio_id_fkey"
            columns: ["plan_estudio_id"]
            isOneToOne: true
            referencedRelation: "planes_estudio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registros_oficiales_plan_plan_estudio_id_fkey"
            columns: ["plan_estudio_id"]
            isOneToOne: true
            referencedRelation: "plantilla_plan"
            referencedColumns: ["plan_estudio_id"]
          },
          {
            foreignKeyName: "registros_oficiales_plan_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "usuarios_app"
            referencedColumns: ["id"]
          },
        ]
      }
      repositorios: {
        Row: {
          created_at: string
          enviado_por: string | null
          id: string
          nombre: string | null
          openai_vector_store_id: string | null
        }
        Insert: {
          created_at?: string
          enviado_por?: string | null
          id?: string
          nombre?: string | null
          openai_vector_store_id?: string | null
        }
        Update: {
          created_at?: string
          enviado_por?: string | null
          id?: string
          nombre?: string | null
          openai_vector_store_id?: string | null
        }
        Relationships: []
      }
      responsables_asignatura: {
        Row: {
          asignado_por: string | null
          asignatura_id: string
          creado_en: string
          id: string
          rol: Database["public"]["Enums"]["rol_responsable_asignatura"]
          usuario_id: string
        }
        Insert: {
          asignado_por?: string | null
          asignatura_id: string
          creado_en?: string
          id?: string
          rol?: Database["public"]["Enums"]["rol_responsable_asignatura"]
          usuario_id: string
        }
        Update: {
          asignado_por?: string | null
          asignatura_id?: string
          creado_en?: string
          id?: string
          rol?: Database["public"]["Enums"]["rol_responsable_asignatura"]
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "responsables_asignatura_asignado_por_fkey"
            columns: ["asignado_por"]
            isOneToOne: false
            referencedRelation: "usuarios_app"
            referencedColumns: ["id"]
          },
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
          alcance_default: string
          clave: string
          descripcion: string | null
          id: string
          nivel_jerarquico: number
          nombre: string
        }
        Insert: {
          alcance_default?: string
          clave: string
          descripcion?: string | null
          id?: string
          nivel_jerarquico?: number
          nombre: string
        }
        Update: {
          alcance_default?: string
          clave?: string
          descripcion?: string | null
          id?: string
          nivel_jerarquico?: number
          nombre?: string
        }
        Relationships: []
      }
      roles_permisos: {
        Row: {
          creado_en: string
          permiso_id: string
          rol_id: string
        }
        Insert: {
          creado_en?: string
          permiso_id: string
          rol_id: string
        }
        Update: {
          creado_en?: string
          permiso_id?: string
          rol_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roles_permisos_permiso_id_fkey"
            columns: ["permiso_id"]
            isOneToOne: false
            referencedRelation: "permisos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roles_permisos_rol_id_fkey"
            columns: ["rol_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      tareas_revision: {
        Row: {
          asignado_a: string
          completado_en: string | null
          creado_en: string
          creado_por: string | null
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
          creado_por?: string | null
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
          creado_por?: string | null
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
            foreignKeyName: "tareas_revision_creado_por_fkey"
            columns: ["creado_por"]
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
          clave: string | null
          creado_en: string
          dado_de_baja_en: string | null
          externo: boolean | null
          id: string
          invitado_por: string | null
          nombre_completo: string | null
        }
        Insert: {
          actualizado_en?: string
          clave?: string | null
          creado_en?: string
          dado_de_baja_en?: string | null
          externo?: boolean | null
          id: string
          invitado_por?: string | null
          nombre_completo?: string | null
        }
        Update: {
          actualizado_en?: string
          clave?: string | null
          creado_en?: string
          dado_de_baja_en?: string | null
          externo?: boolean | null
          id?: string
          invitado_por?: string | null
          nombre_completo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_app_invitado_por_fkey"
            columns: ["invitado_por"]
            isOneToOne: false
            referencedRelation: "usuarios_app"
            referencedColumns: ["id"]
          },
        ]
      }
      usuarios_roles: {
        Row: {
          asignado_por: string | null
          carrera_id: string | null
          creado_en: string
          facultad_id: string | null
          id: string
          rol_id: string
          usuario_id: string
        }
        Insert: {
          asignado_por?: string | null
          carrera_id?: string | null
          creado_en?: string
          facultad_id?: string | null
          id?: string
          rol_id: string
          usuario_id: string
        }
        Update: {
          asignado_por?: string | null
          carrera_id?: string | null
          creado_en?: string
          facultad_id?: string | null
          id?: string
          rol_id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_roles_asignado_por_fkey"
            columns: ["asignado_por"]
            isOneToOne: false
            referencedRelation: "usuarios_app"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuarios_roles_carrera_id_fkey"
            columns: ["carrera_id"]
            isOneToOne: false
            referencedRelation: "carreras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuarios_roles_carrera_id_fkey"
            columns: ["carrera_id"]
            isOneToOne: false
            referencedRelation: "registros_oficiales_plan_detalle"
            referencedColumns: ["carrera_id"]
          },
          {
            foreignKeyName: "usuarios_roles_facultad_id_fkey"
            columns: ["facultad_id"]
            isOneToOne: false
            referencedRelation: "facultades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuarios_roles_facultad_id_fkey"
            columns: ["facultad_id"]
            isOneToOne: false
            referencedRelation: "registros_oficiales_plan_detalle"
            referencedColumns: ["facultad_id"]
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
      registros_oficiales_plan_detalle: {
        Row: {
          actualizado_en: string | null
          actualizado_por: string | null
          autoridad: string | null
          carrera_id: string | null
          carrera_nivel:
            | Database["public"]["Enums"]["nivel_plan_estudio"]
            | null
          carrera_nombre: string | null
          carrera_nombre_corto: string | null
          clave_sep: string | null
          creado_en: string | null
          documento_archivo_id: string | null
          documento_archivo_path: string | null
          documento_bucket: string | null
          documento_mime: string | null
          documento_nombre: string | null
          documento_path: string | null
          documento_size: number | null
          documento_url: string | null
          estado_clave: string | null
          estado_color: string | null
          estado_etiqueta: string | null
          facultad_id: string | null
          facultad_nombre: string | null
          facultad_nombre_corto: string | null
          facultad_prefijo: string | null
          fecha_aprobacion: string | null
          fecha_inicio_imparticion: string | null
          id: string | null
          numero_acuerdo: string | null
          observaciones: string | null
          plan_estudio_id: string | null
          plan_nombre: string | null
          plan_nombre_legacy: string | null
          plan_nombre_propuesto: string | null
          registrado_por: string | null
          registrado_por_nombre: string | null
          vigencia_fin: string | null
          vigencia_inicio: string | null
        }
        Relationships: [
          {
            foreignKeyName: "registros_oficiales_plan_actualizado_por_fkey"
            columns: ["actualizado_por"]
            isOneToOne: false
            referencedRelation: "usuarios_app"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registros_oficiales_plan_documento_archivo_id_fkey"
            columns: ["documento_archivo_id"]
            isOneToOne: false
            referencedRelation: "archivos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registros_oficiales_plan_plan_estudio_id_fkey"
            columns: ["plan_estudio_id"]
            isOneToOne: true
            referencedRelation: "planes_estudio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registros_oficiales_plan_plan_estudio_id_fkey"
            columns: ["plan_estudio_id"]
            isOneToOne: true
            referencedRelation: "plantilla_plan"
            referencedColumns: ["plan_estudio_id"]
          },
          {
            foreignKeyName: "registros_oficiales_plan_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "usuarios_app"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      aplicar_operaciones_estructura_datos: {
        Args: { p_datos: Json; p_operaciones?: Json }
        Returns: Json
      }
      append_conversacion_asignatura: {
        Args: { p_append: Json; p_id: string }
        Returns: undefined
      }
      append_conversacion_plan: {
        Args: { p_append: Json; p_id: string }
        Returns: undefined
      }
      authz_admin_override_audit: {
        Args: { p_plan_id: string }
        Returns: {
          admin_override: boolean
          estado_clave: string
          motivo: string
        }[]
      }
      authz_admin_override_reason: { Args: never; Returns: string }
      authz_asignatura_content_write_allowed: {
        Args: { p_asignatura_id: string }
        Returns: boolean
      }
      authz_asignatura_ia_allowed: {
        Args: { p_asignatura_id: string }
        Returns: boolean
      }
      authz_asignatura_restricted_field_write_allowed: {
        Args: { p_asignatura_id: string }
        Returns: boolean
      }
      authz_asignatura_write_allowed: {
        Args: { p_asignatura_id: string }
        Returns: boolean
      }
      authz_campo_asignatura_write_allowed: {
        Args: { p_asignatura_id: string; p_clave: string }
        Returns: boolean
      }
      authz_campo_plan_write_allowed: {
        Args: { p_clave: string; p_plan_id: string }
        Returns: boolean
      }
      authz_can_access_asignatura: {
        Args: { p_asignatura_id: string }
        Returns: boolean
      }
      authz_can_access_carrera: {
        Args: { p_carrera_id: string }
        Returns: boolean
      }
      authz_can_access_facultad: {
        Args: { p_facultad_id: string }
        Returns: boolean
      }
      authz_can_access_plan: { Args: { p_plan_id: string }; Returns: boolean }
      authz_has_bootstrap_access: { Args: never; Returns: boolean }
      authz_has_global_scope: { Args: never; Returns: boolean }
      authz_has_permission: { Args: { p_permiso: string }; Returns: boolean }
      authz_has_role: { Args: { p_rol: string }; Returns: boolean }
      authz_is_admin: { Args: never; Returns: boolean }
      authz_is_responsable_asignatura: {
        Args: { p_asignatura_id: string }
        Returns: boolean
      }
      authz_is_responsable_de_plan: {
        Args: { p_plan_id: string }
        Returns: boolean
      }
      authz_is_service_role: { Args: never; Returns: boolean }
      authz_plan_ia_allowed: { Args: { p_plan_id: string }; Returns: boolean }
      authz_plan_restricted_field_write_allowed: {
        Args: { p_plan_id: string }
        Returns: boolean
      }
      authz_plan_write_allowed: {
        Args: { p_plan_id: string }
        Returns: boolean
      }
      authz_simulacion_activa: { Args: never; Returns: boolean }
      borrar_asignaturas_fallidas: { Args: never; Returns: undefined }
      borrar_planes_fallidos: { Args: never; Returns: undefined }
      build_asignaturas_prefix_tsquery: {
        Args: { p_search: string }
        Returns: unknown
      }
      catalogo_asignaturas_buscar: {
        Args: {
          p_carrera_id?: string
          p_estado?: Database["public"]["Enums"]["estado_asignatura"]
          p_facultad_id?: string
          p_incluir_archivadas?: boolean
          p_limit?: number
          p_offset?: number
          p_plan_estudio_id?: string
          p_q?: string
          p_tipo?: Database["public"]["Enums"]["tipo_asignatura"]
        }
        Returns: {
          asignatura_id: string
          carrera_id: string
          carrera_nombre: string
          codigo: string
          creditos: number
          estado: Database["public"]["Enums"]["estado_asignatura"]
          facultad_id: string
          facultad_nombre: string
          motivos_acceso: Json
          nombre: string
          numero_ciclo: number
          plan_estudio_id: string
          plan_nombre: string
          rank: number
          responsables: Json
          tipo: Database["public"]["Enums"]["tipo_asignatura"]
          total_count: number
        }[]
      }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      datos_validos_con_definicion: {
        Args: { p_datos: Json; p_definicion: Json }
        Returns: boolean
      }
      fn_generar_nombre_plan_curricular: {
        Args: { p_carrera_id: string; p_fecha_inicio_imparticion: string }
        Returns: string
      }
      json_schema_parcial_definicion: {
        Args: { p_definicion: Json }
        Returns: Json
      }
      nivel_es_posgrado: { Args: { p_nivel: string }; Returns: boolean }
      nombrar_responsable: {
        Args: {
          p_actor: string
          p_carrera: string
          p_facultad: string
          p_rol: string
          p_usuario: string
        }
        Returns: Json
      }
      normalizar_datos_por_definicion: {
        Args: { p_datos: Json; p_definicion: Json; p_null_invalid?: boolean }
        Returns: Json
      }
      normalizar_valor_por_propiedad: {
        Args: { p_null_invalid?: boolean; p_prop: Json; p_value: Json }
        Returns: Json
      }
      plan_estado_clave: { Args: { p_plan_id: string }; Returns: string }
      propiedad_restriccion_estados: {
        Args: { p_prop: Json }
        Returns: string[]
      }
      propiedad_restriccion_permiso: { Args: { p_prop: Json }; Returns: string }
      propiedad_tiene_restriccion: { Args: { p_prop: Json }; Returns: boolean }
      reasignar_responsabilidades: {
        Args: { p_actor: string; p_destino: string; p_origen: string }
        Returns: Json
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
      tipo_propiedad_json_schema: { Args: { p_prop: Json }; Returns: string }
      transiciones_permitidas_plan: {
        Args: { p_plan_id: string }
        Returns: {
          clave: string
          color: string | null
          es_campo_editable: boolean
          es_final: boolean
          etiqueta: string
          id: string
          orden: number
        }[]
        SetofOptions: {
          from: "*"
          to: "estados_plan"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      unaccent_immutable: { Args: { "": string }; Returns: string }
      usuario_es_externo_asignado_plan: {
        Args: { p_plan_id: string; p_usuario_id: string }
        Returns: boolean
      }
      usuario_es_jefe_encargado_plan: {
        Args: { p_plan_id: string; p_usuario_id: string }
        Returns: boolean
      }
      usuario_es_jefe_posgrado_encargado_plan: {
        Args: { p_plan_id: string; p_usuario_id: string }
        Returns: boolean
      }
      usuario_puede_acceder_plan: {
        Args: { p_plan_id: string; p_usuario_id: string }
        Returns: boolean
      }
      usuario_puede_comentar_asignatura: {
        Args: { p_asignatura_id: string; p_usuario_id: string }
        Returns: boolean
      }
      usuario_puede_comentar_plan: {
        Args: { p_plan_id: string; p_usuario_id: string }
        Returns: boolean
      }
      usuario_puede_editar_asignatura: {
        Args: { p_asignatura_id: string; p_usuario_id: string }
        Returns: boolean
      }
      usuario_puede_editar_campo_asignatura: {
        Args: { p_asignatura_id: string; p_clave: string; p_usuario_id: string }
        Returns: boolean
      }
      usuario_puede_editar_campo_plan: {
        Args: { p_clave: string; p_plan_id: string; p_usuario_id: string }
        Returns: boolean
      }
      usuario_puede_editar_plan: {
        Args: { p_plan_id: string; p_usuario_id: string }
        Returns: boolean
      }
      usuario_puede_gestionar_rol: {
        Args: {
          p_actor: string
          p_carrera?: string
          p_facultad?: string
          p_rol: string
        }
        Returns: boolean
      }
      usuario_puede_gestionar_usuario: {
        Args: { p_actor: string; p_usuario: string }
        Returns: boolean
      }
      usuario_puede_transicionar_asignatura: {
        Args: {
          p_asignatura_id: string
          p_nuevo_estado: Database["public"]["Enums"]["estado_asignatura"]
          p_usuario_id: string
        }
        Returns: boolean
      }
      usuario_puede_transicionar_plan: {
        Args: {
          p_hacia_estado_id: string
          p_plan_id: string
          p_usuario_id: string
        }
        Returns: boolean
      }
      usuario_puede_usar_ia_asignatura: {
        Args: { p_asignatura_id: string; p_usuario_id: string }
        Returns: boolean
      }
      usuario_puede_usar_ia_plan: {
        Args: { p_plan_id: string; p_usuario_id: string }
        Returns: boolean
      }
      usuario_tiene_permiso: {
        Args: { p_permiso: string; p_usuario_id: string }
        Returns: boolean
      }
      usuario_tiene_rol_contextual_plan: {
        Args: { p_plan_id: string; p_rol: string; p_usuario_id: string }
        Returns: boolean
      }
      usuario_tiene_rol_en_plan: {
        Args: { p_plan_id: string; p_rol: string; p_usuario_id: string }
        Returns: boolean
      }
      valor_jsonb_vacio: { Args: { p_value: Json }; Returns: boolean }
    }
    Enums: {
      estado_asignatura:
        | "borrador"
        | "revisada"
        | "aprobada"
        | "generando"
        | "fallida"
        | "archivada"
      estado_conversacion: "ACTIVA" | "ARCHIVANDO" | "ARCHIVADA" | "ERROR"
      estado_mensaje_ia: "PROCESANDO" | "COMPLETADO" | "ERROR" | "CANCELADO"
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
      tipo_interaccion_ia: "GENERAR" | "MEJORAR_SECCION" | "OTRA"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      estado_asignatura: [
        "borrador",
        "revisada",
        "aprobada",
        "generando",
        "fallida",
        "archivada",
      ],
      estado_conversacion: ["ACTIVA", "ARCHIVANDO", "ARCHIVADA", "ERROR"],
      estado_mensaje_ia: ["PROCESANDO", "COMPLETADO", "ERROR", "CANCELADO"],
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
      tipo_interaccion_ia: ["GENERAR", "MEJORAR_SECCION", "OTRA"],
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

