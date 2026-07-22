export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Array<Json>

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
      ai_request_references: {
        Row: {
          chunk_ids: Array<string>
          conversation_id: string
          conversation_type: Database['public']['Enums']['tipo_conversacion_documental']
          created_at: string
          file_id: string
          file_version_id: string
          id: string
          message_id: string | null
          message_type:
            | Database['public']['Enums']['tipo_conversacion_documental']
            | null
          mode: string
          request_id: string
          retrieval_query: string | null
          retrieval_scores: Json
          tenant_id: string
        }
        Insert: {
          chunk_ids?: Array<string>
          conversation_id: string
          conversation_type: Database['public']['Enums']['tipo_conversacion_documental']
          created_at?: string
          file_id: string
          file_version_id: string
          id?: string
          message_id?: string | null
          message_type?:
            | Database['public']['Enums']['tipo_conversacion_documental']
            | null
          mode: string
          request_id: string
          retrieval_query?: string | null
          retrieval_scores?: Json
          tenant_id: string
        }
        Update: {
          chunk_ids?: Array<string>
          conversation_id?: string
          conversation_type?: Database['public']['Enums']['tipo_conversacion_documental']
          created_at?: string
          file_id?: string
          file_version_id?: string
          id?: string
          message_id?: string | null
          message_type?:
            | Database['public']['Enums']['tipo_conversacion_documental']
            | null
          mode?: string
          request_id?: string
          retrieval_query?: string | null
          retrieval_scores?: Json
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'ai_request_references_file_id_fkey'
            columns: ['file_id']
            isOneToOne: false
            referencedRelation: 'files'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'ai_request_references_file_version_id_fkey'
            columns: ['file_version_id']
            isOneToOne: false
            referencedRelation: 'file_versions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'ai_request_references_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
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
            foreignKeyName: 'archivos_creado_por_fkey'
            columns: ['creado_por']
            isOneToOne: false
            referencedRelation: 'usuarios_app'
            referencedColumns: ['id']
          },
        ]
      }
      asignatura_mensajes_ia: {
        Row: {
          campos: Array<string>
          conversacion_asignatura_id: string
          enviado_por: string
          estado: Database['public']['Enums']['estado_mensaje_ia']
          fecha_actualizacion: string
          fecha_creacion: string
          id: string
          intencion: string | null
          is_refusal: boolean
          mensaje: string
          openai_response_id: string | null
          propuesta: Json | null
          reasoning_effort: string
          respuesta: string | null
          retry_of_message_id: string | null
          web_search_enabled: boolean
        }
        Insert: {
          campos?: Array<string>
          conversacion_asignatura_id: string
          enviado_por?: string
          estado?: Database['public']['Enums']['estado_mensaje_ia']
          fecha_actualizacion?: string
          fecha_creacion?: string
          id?: string
          intencion?: string | null
          is_refusal?: boolean
          mensaje: string
          openai_response_id?: string | null
          propuesta?: Json | null
          reasoning_effort?: string
          respuesta?: string | null
          retry_of_message_id?: string | null
          web_search_enabled?: boolean
        }
        Update: {
          campos?: Array<string>
          conversacion_asignatura_id?: string
          enviado_por?: string
          estado?: Database['public']['Enums']['estado_mensaje_ia']
          fecha_actualizacion?: string
          fecha_creacion?: string
          id?: string
          intencion?: string | null
          is_refusal?: boolean
          mensaje?: string
          openai_response_id?: string | null
          propuesta?: Json | null
          reasoning_effort?: string
          respuesta?: string | null
          retry_of_message_id?: string | null
          web_search_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: 'asignatura_mensajes_ia_conversacion_asignatura_id_fkey'
            columns: ['conversacion_asignatura_id']
            isOneToOne: false
            referencedRelation: 'conversaciones_asignatura'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'asignatura_mensajes_ia_retry_source_fkey'
            columns: [
              'retry_of_message_id',
              'conversacion_asignatura_id',
              'enviado_por',
            ]
            isOneToOne: false
            referencedRelation: 'asignatura_mensajes_ia'
            referencedColumns: [
              'id',
              'conversacion_asignatura_id',
              'enviado_por',
            ]
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
          estado: Database['public']['Enums']['estado_asignatura']
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
          tipo: Database['public']['Enums']['tipo_asignatura']
          tipo_origen: Database['public']['Enums']['tipo_origen'] | null
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
          estado?: Database['public']['Enums']['estado_asignatura']
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
          tipo?: Database['public']['Enums']['tipo_asignatura']
          tipo_origen?: Database['public']['Enums']['tipo_origen'] | null
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
          estado?: Database['public']['Enums']['estado_asignatura']
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
          tipo?: Database['public']['Enums']['tipo_asignatura']
          tipo_origen?: Database['public']['Enums']['tipo_origen'] | null
        }
        Relationships: [
          {
            foreignKeyName: 'asignaturas_actualizado_por_fkey'
            columns: ['actualizado_por']
            isOneToOne: false
            referencedRelation: 'usuarios_app'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'asignaturas_creado_por_fkey'
            columns: ['creado_por']
            isOneToOne: false
            referencedRelation: 'usuarios_app'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'asignaturas_estructura_id_fkey'
            columns: ['estructura_id']
            isOneToOne: false
            referencedRelation: 'estructuras_asignatura'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'asignaturas_estructura_id_fkey'
            columns: ['estructura_id']
            isOneToOne: false
            referencedRelation: 'plantilla_asignatura'
            referencedColumns: ['estructura_id']
          },
          {
            foreignKeyName: 'asignaturas_linea_plan_fk_compuesta'
            columns: ['linea_plan_id', 'plan_estudio_id']
            isOneToOne: false
            referencedRelation: 'lineas_plan'
            referencedColumns: ['id', 'plan_estudio_id']
          },
          {
            foreignKeyName: 'asignaturas_plan_estudio_id_fkey'
            columns: ['plan_estudio_id']
            isOneToOne: false
            referencedRelation: 'planes_estudio'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'asignaturas_plan_estudio_id_fkey'
            columns: ['plan_estudio_id']
            isOneToOne: false
            referencedRelation: 'plantilla_plan'
            referencedColumns: ['plan_estudio_id']
          },
          {
            foreignKeyName: 'asignaturas_prerrequisito_asignatura_id_fkey'
            columns: ['prerrequisito_asignatura_id']
            isOneToOne: false
            referencedRelation: 'asignaturas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'asignaturas_prerrequisito_asignatura_id_fkey'
            columns: ['prerrequisito_asignatura_id']
            isOneToOne: false
            referencedRelation: 'plantilla_asignatura'
            referencedColumns: ['asignatura_id']
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
          tipo: Database['public']['Enums']['tipo_bibliografia']
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
          tipo: Database['public']['Enums']['tipo_bibliografia']
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
          tipo?: Database['public']['Enums']['tipo_bibliografia']
          titulo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'bibliografia_asignatura_asignatura_id_fkey'
            columns: ['asignatura_id']
            isOneToOne: false
            referencedRelation: 'asignaturas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'bibliografia_asignatura_asignatura_id_fkey'
            columns: ['asignatura_id']
            isOneToOne: false
            referencedRelation: 'plantilla_asignatura'
            referencedColumns: ['asignatura_id']
          },
          {
            foreignKeyName: 'bibliografia_asignatura_creado_por_fkey'
            columns: ['creado_por']
            isOneToOne: false
            referencedRelation: 'usuarios_app'
            referencedColumns: ['id']
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
            foreignKeyName: 'borradores_campo_actualizado_por_fkey'
            columns: ['actualizado_por']
            isOneToOne: false
            referencedRelation: 'usuarios_app'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'borradores_campo_creado_por_fkey'
            columns: ['creado_por']
            isOneToOne: false
            referencedRelation: 'usuarios_app'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'borradores_campo_plan_id_fkey'
            columns: ['plan_id']
            isOneToOne: false
            referencedRelation: 'planes_estudio'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'borradores_campo_plan_id_fkey'
            columns: ['plan_id']
            isOneToOne: false
            referencedRelation: 'plantilla_plan'
            referencedColumns: ['plan_estudio_id']
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
          fuente: Database['public']['Enums']['fuente_cambio'] | null
          id: string
          interaccion_ia_id: string | null
          tipo: Database['public']['Enums']['tipo_cambio']
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
          fuente?: Database['public']['Enums']['fuente_cambio'] | null
          id?: string
          interaccion_ia_id?: string | null
          tipo: Database['public']['Enums']['tipo_cambio']
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
          fuente?: Database['public']['Enums']['fuente_cambio'] | null
          id?: string
          interaccion_ia_id?: string | null
          tipo?: Database['public']['Enums']['tipo_cambio']
          valor_anterior?: Json | null
          valor_nuevo?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: 'cambios_asignatura_asignatura_id_fkey'
            columns: ['asignatura_id']
            isOneToOne: false
            referencedRelation: 'asignaturas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'cambios_asignatura_asignatura_id_fkey'
            columns: ['asignatura_id']
            isOneToOne: false
            referencedRelation: 'plantilla_asignatura'
            referencedColumns: ['asignatura_id']
          },
          {
            foreignKeyName: 'cambios_asignatura_cambiado_por_fkey'
            columns: ['cambiado_por']
            isOneToOne: false
            referencedRelation: 'usuarios_app'
            referencedColumns: ['id']
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
          tipo: Database['public']['Enums']['tipo_cambio']
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
          tipo: Database['public']['Enums']['tipo_cambio']
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
          tipo?: Database['public']['Enums']['tipo_cambio']
          valor_anterior?: Json | null
          valor_nuevo?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: 'cambios_plan_cambiado_por_fkey'
            columns: ['cambiado_por']
            isOneToOne: false
            referencedRelation: 'usuarios_app'
            referencedColumns: ['id']
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
          nivel: Database['public']['Enums']['nivel_plan_estudio']
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
          nivel?: Database['public']['Enums']['nivel_plan_estudio']
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
          nivel?: Database['public']['Enums']['nivel_plan_estudio']
          nombre?: string
          nombre_corto?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'carreras_actualizado_por_fkey'
            columns: ['actualizado_por']
            isOneToOne: false
            referencedRelation: 'usuarios_app'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'carreras_creado_por_fkey'
            columns: ['creado_por']
            isOneToOne: false
            referencedRelation: 'usuarios_app'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'carreras_facultad_id_fkey'
            columns: ['facultad_id']
            isOneToOne: false
            referencedRelation: 'facultades'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'carreras_facultad_id_fkey'
            columns: ['facultad_id']
            isOneToOne: false
            referencedRelation: 'registros_oficiales_plan_detalle'
            referencedColumns: ['facultad_id']
          },
        ]
      }
      collection_files: {
        Row: {
          added_at: string
          added_by: string
          collection_id: string
          file_id: string
          tenant_id: string
        }
        Insert: {
          added_at?: string
          added_by: string
          collection_id: string
          file_id: string
          tenant_id: string
        }
        Update: {
          added_at?: string
          added_by?: string
          collection_id?: string
          file_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'collection_files_added_by_fkey'
            columns: ['added_by']
            isOneToOne: false
            referencedRelation: 'usuarios_app'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'collection_files_collection_id_fkey'
            columns: ['collection_id']
            isOneToOne: false
            referencedRelation: 'collections'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'collection_files_file_id_fkey'
            columns: ['file_id']
            isOneToOne: false
            referencedRelation: 'files'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'collection_files_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      collections: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          kind: string
          name: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          kind?: string
          name: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          kind?: string
          name?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'collections_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'usuarios_app'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'collections_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      comentarios_adjuntos: {
        Row: {
          bucket: string
          comentario_id: string
          creado_en: string
          creado_por: string | null
          id: string
          mime: string | null
          nombre: string | null
          path: string
          plan_estudio_id: string
          size: number | null
        }
        Insert: {
          bucket?: string
          comentario_id: string
          creado_en?: string
          creado_por?: string | null
          id?: string
          mime?: string | null
          nombre?: string | null
          path: string
          plan_estudio_id: string
          size?: number | null
        }
        Update: {
          bucket?: string
          comentario_id?: string
          creado_en?: string
          creado_por?: string | null
          id?: string
          mime?: string | null
          nombre?: string | null
          path?: string
          plan_estudio_id?: string
          size?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'comentarios_adjuntos_comentario_id_fkey'
            columns: ['comentario_id']
            isOneToOne: false
            referencedRelation: 'comentarios_plan'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'comentarios_adjuntos_creado_por_fkey'
            columns: ['creado_por']
            isOneToOne: false
            referencedRelation: 'usuarios_app'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'comentarios_adjuntos_plan_estudio_id_fkey'
            columns: ['plan_estudio_id']
            isOneToOne: false
            referencedRelation: 'planes_estudio'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'comentarios_adjuntos_plan_estudio_id_fkey'
            columns: ['plan_estudio_id']
            isOneToOne: false
            referencedRelation: 'plantilla_plan'
            referencedColumns: ['plan_estudio_id']
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
            foreignKeyName: 'comentarios_asignatura_asignatura_id_fkey'
            columns: ['asignatura_id']
            isOneToOne: false
            referencedRelation: 'asignaturas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'comentarios_asignatura_asignatura_id_fkey'
            columns: ['asignatura_id']
            isOneToOne: false
            referencedRelation: 'plantilla_asignatura'
            referencedColumns: ['asignatura_id']
          },
          {
            foreignKeyName: 'comentarios_asignatura_autor_id_fkey'
            columns: ['autor_id']
            isOneToOne: false
            referencedRelation: 'usuarios_app'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'comentarios_asignatura_comentario_padre_id_fkey'
            columns: ['comentario_padre_id']
            isOneToOne: false
            referencedRelation: 'comentarios_asignatura'
            referencedColumns: ['id']
          },
        ]
      }
      comentarios_plan: {
        Row: {
          asignatura_id: string | null
          autor_id: string | null
          categoria: string
          comentario_padre_id: string | null
          creado_en: string
          cuerpo: string
          estado_id: string | null
          id: string
          plan_estudio_id: string
          referencia: Json | null
          resuelto: boolean
        }
        Insert: {
          asignatura_id?: string | null
          autor_id?: string | null
          categoria?: string
          comentario_padre_id?: string | null
          creado_en?: string
          cuerpo: string
          estado_id?: string | null
          id?: string
          plan_estudio_id: string
          referencia?: Json | null
          resuelto?: boolean
        }
        Update: {
          asignatura_id?: string | null
          autor_id?: string | null
          categoria?: string
          comentario_padre_id?: string | null
          creado_en?: string
          cuerpo?: string
          estado_id?: string | null
          id?: string
          plan_estudio_id?: string
          referencia?: Json | null
          resuelto?: boolean
        }
        Relationships: [
          {
            foreignKeyName: 'comentarios_plan_asignatura_id_fkey'
            columns: ['asignatura_id']
            isOneToOne: false
            referencedRelation: 'asignaturas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'comentarios_plan_asignatura_id_fkey'
            columns: ['asignatura_id']
            isOneToOne: false
            referencedRelation: 'plantilla_asignatura'
            referencedColumns: ['asignatura_id']
          },
          {
            foreignKeyName: 'comentarios_plan_autor_id_fkey'
            columns: ['autor_id']
            isOneToOne: false
            referencedRelation: 'usuarios_app'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'comentarios_plan_comentario_padre_id_fkey'
            columns: ['comentario_padre_id']
            isOneToOne: false
            referencedRelation: 'comentarios_plan'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'comentarios_plan_estado_id_fkey'
            columns: ['estado_id']
            isOneToOne: false
            referencedRelation: 'estados_plan'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'comentarios_plan_plan_estudio_id_fkey'
            columns: ['plan_estudio_id']
            isOneToOne: false
            referencedRelation: 'planes_estudio'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'comentarios_plan_plan_estudio_id_fkey'
            columns: ['plan_estudio_id']
            isOneToOne: false
            referencedRelation: 'plantilla_plan'
            referencedColumns: ['plan_estudio_id']
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
          estado: Database['public']['Enums']['estado_conversacion']
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
          estado?: Database['public']['Enums']['estado_conversacion']
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
          estado?: Database['public']['Enums']['estado_conversacion']
          id?: string
          intento_archivado?: number
          nombre?: string | null
          openai_conversation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'conversaciones_asignatura_archivado_por_fkey'
            columns: ['archivado_por']
            isOneToOne: false
            referencedRelation: 'usuarios_app'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'conversaciones_asignatura_asignatura_id_fkey'
            columns: ['asignatura_id']
            isOneToOne: false
            referencedRelation: 'asignaturas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'conversaciones_asignatura_asignatura_id_fkey'
            columns: ['asignatura_id']
            isOneToOne: false
            referencedRelation: 'plantilla_asignatura'
            referencedColumns: ['asignatura_id']
          },
          {
            foreignKeyName: 'conversaciones_asignatura_creado_por_fkey'
            columns: ['creado_por']
            isOneToOne: false
            referencedRelation: 'usuarios_app'
            referencedColumns: ['id']
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
          estado: Database['public']['Enums']['estado_conversacion']
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
          estado?: Database['public']['Enums']['estado_conversacion']
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
          estado?: Database['public']['Enums']['estado_conversacion']
          id?: string
          intento_archivado?: number
          nombre?: string | null
          openai_conversation_id?: string
          plan_estudio_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'conversaciones_plan_archivado_por_fkey'
            columns: ['archivado_por']
            isOneToOne: false
            referencedRelation: 'usuarios_app'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'conversaciones_plan_creado_por_fkey'
            columns: ['creado_por']
            isOneToOne: false
            referencedRelation: 'usuarios_app'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'conversaciones_plan_plan_estudio_id_fkey'
            columns: ['plan_estudio_id']
            isOneToOne: false
            referencedRelation: 'planes_estudio'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'conversaciones_plan_plan_estudio_id_fkey'
            columns: ['plan_estudio_id']
            isOneToOne: false
            referencedRelation: 'plantilla_plan'
            referencedColumns: ['plan_estudio_id']
          },
        ]
      }
      conversation_files: {
        Row: {
          added_at: string
          added_by: string
          conversation_id: string
          conversation_type: Database['public']['Enums']['tipo_conversacion_documental']
          file_id: string
          removed_at: string | null
          tenant_id: string
        }
        Insert: {
          added_at?: string
          added_by: string
          conversation_id: string
          conversation_type: Database['public']['Enums']['tipo_conversacion_documental']
          file_id: string
          removed_at?: string | null
          tenant_id: string
        }
        Update: {
          added_at?: string
          added_by?: string
          conversation_id?: string
          conversation_type?: Database['public']['Enums']['tipo_conversacion_documental']
          file_id?: string
          removed_at?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'conversation_files_added_by_fkey'
            columns: ['added_by']
            isOneToOne: false
            referencedRelation: 'usuarios_app'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'conversation_files_file_id_fkey'
            columns: ['file_id']
            isOneToOne: false
            referencedRelation: 'files'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'conversation_files_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
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
            foreignKeyName: 'crash_reports_resuelto_por_fkey'
            columns: ['resuelto_por']
            isOneToOne: false
            referencedRelation: 'usuarios_app'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'crash_reports_usuario_id_fkey'
            columns: ['usuario_id']
            isOneToOne: false
            referencedRelation: 'usuarios_app'
            referencedColumns: ['id']
          },
        ]
      }
      document_chunks: {
        Row: {
          chunk_index: number
          chunker_version: string
          created_at: string
          embedding: string | null
          embedding_model: string | null
          embedding_version: string | null
          file_version_id: string
          heading_path: Array<string>
          id: string
          metadata: Json
          page_end: number | null
          page_start: number | null
          search_vector: unknown
          tenant_id: string
          text: string
          text_sha256: string
          token_count: number
        }
        Insert: {
          chunk_index: number
          chunker_version: string
          created_at?: string
          embedding?: string | null
          embedding_model?: string | null
          embedding_version?: string | null
          file_version_id: string
          heading_path?: Array<string>
          id?: string
          metadata?: Json
          page_end?: number | null
          page_start?: number | null
          search_vector?: unknown
          tenant_id: string
          text: string
          text_sha256: string
          token_count: number
        }
        Update: {
          chunk_index?: number
          chunker_version?: string
          created_at?: string
          embedding?: string | null
          embedding_model?: string | null
          embedding_version?: string | null
          file_version_id?: string
          heading_path?: Array<string>
          id?: string
          metadata?: Json
          page_end?: number | null
          page_start?: number | null
          search_vector?: unknown
          tenant_id?: string
          text?: string
          text_sha256?: string
          token_count?: number
        }
        Relationships: [
          {
            foreignKeyName: 'document_chunks_file_version_id_fkey'
            columns: ['file_version_id']
            isOneToOne: false
            referencedRelation: 'file_versions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'document_chunks_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      document_extractions: {
        Row: {
          attempts: number
          completed_at: string | null
          created_at: string
          extracted_content: Json | null
          file_version_id: string
          id: string
          page_from: number | null
          page_to: number | null
          provider: string
          provider_response_id: string | null
          quality_flags: Json
          schema_version: string
          status: string
          tenant_id: string
        }
        Insert: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          extracted_content?: Json | null
          file_version_id: string
          id?: string
          page_from?: number | null
          page_to?: number | null
          provider: string
          provider_response_id?: string | null
          quality_flags?: Json
          schema_version: string
          status: string
          tenant_id: string
        }
        Update: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          extracted_content?: Json | null
          file_version_id?: string
          id?: string
          page_from?: number | null
          page_to?: number | null
          provider?: string
          provider_response_id?: string | null
          quality_flags?: Json
          schema_version?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'document_extractions_file_version_id_fkey'
            columns: ['file_version_id']
            isOneToOne: false
            referencedRelation: 'file_versions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'document_extractions_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      document_webhook_events: {
        Row: {
          delivery_count: number
          event_id: string
          event_type: string
          payload: Json
          processed_at: string | null
          processing_error: string | null
          provider_response_id: string
          received_at: string
        }
        Insert: {
          delivery_count?: number
          event_id: string
          event_type: string
          payload: Json
          processed_at?: string | null
          processing_error?: string | null
          provider_response_id: string
          received_at?: string
        }
        Update: {
          delivery_count?: number
          event_id?: string
          event_type?: string
          payload?: Json
          processed_at?: string | null
          processing_error?: string | null
          provider_response_id?: string
          received_at?: string
        }
        Relationships: []
      }
      ejecuciones_recuperacion_ia: {
        Row: {
          completado_en: string | null
          completados: number
          descubiertos: number
          error: string | null
          fallidos: number
          id: string
          iniciado_en: string
          metadata: Json
          reclamados: number
          reprogramados: number
        }
        Insert: {
          completado_en?: string | null
          completados?: number
          descubiertos?: number
          error?: string | null
          fallidos?: number
          id?: string
          iniciado_en?: string
          metadata?: Json
          reclamados?: number
          reprogramados?: number
        }
        Update: {
          completado_en?: string | null
          completados?: number
          descubiertos?: number
          error?: string | null
          fallidos?: number
          id?: string
          iniciado_en?: string
          metadata?: Json
          reclamados?: number
          reprogramados?: number
        }
        Relationships: []
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
          tipo: Database['public']['Enums']['tipo_estructura_plan'] | null
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
          tipo?: Database['public']['Enums']['tipo_estructura_plan'] | null
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
          tipo?: Database['public']['Enums']['tipo_estructura_plan'] | null
        }
        Relationships: [
          {
            foreignKeyName: 'estructuras_asignatura_actualizado_por_fkey'
            columns: ['actualizado_por']
            isOneToOne: false
            referencedRelation: 'usuarios_app'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'estructuras_asignatura_creado_por_fkey'
            columns: ['creado_por']
            isOneToOne: false
            referencedRelation: 'usuarios_app'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'estructuras_asignatura_estructura_plan_id_fkey'
            columns: ['estructura_plan_id']
            isOneToOne: false
            referencedRelation: 'estructuras_plan'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'estructuras_asignatura_estructura_plan_id_fkey'
            columns: ['estructura_plan_id']
            isOneToOne: false
            referencedRelation: 'plantilla_plan'
            referencedColumns: ['estructura_id']
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
          tipo: Database['public']['Enums']['tipo_estructura_plan']
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
          tipo: Database['public']['Enums']['tipo_estructura_plan']
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
          tipo?: Database['public']['Enums']['tipo_estructura_plan']
        }
        Relationships: [
          {
            foreignKeyName: 'estructuras_plan_actualizado_por_fkey'
            columns: ['actualizado_por']
            isOneToOne: false
            referencedRelation: 'usuarios_app'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'estructuras_plan_creado_por_fkey'
            columns: ['creado_por']
            isOneToOne: false
            referencedRelation: 'usuarios_app'
            referencedColumns: ['id']
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
            foreignKeyName: 'expertos_creado_por_fkey'
            columns: ['creado_por']
            isOneToOne: false
            referencedRelation: 'usuarios_app'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'expertos_usuario_id_fkey'
            columns: ['usuario_id']
            isOneToOne: false
            referencedRelation: 'usuarios_app'
            referencedColumns: ['id']
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
            foreignKeyName: 'facultades_actualizado_por_fkey'
            columns: ['actualizado_por']
            isOneToOne: false
            referencedRelation: 'usuarios_app'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'facultades_creado_por_fkey'
            columns: ['creado_por']
            isOneToOne: false
            referencedRelation: 'usuarios_app'
            referencedColumns: ['id']
          },
        ]
      }
      file_blobs: {
        Row: {
          created_at: string
          deleted_at: string | null
          detected_mime: string
          id: string
          openai_file_id: string | null
          openai_sync_error: string | null
          openai_synced_at: string | null
          processing_status: Database['public']['Enums']['estado_procesamiento_documento']
          refcount: number
          refcount_cero_desde: string | null
          sha256: string
          size_bytes: number
          storage_bucket: string
          storage_path: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          detected_mime: string
          id?: string
          openai_file_id?: string | null
          openai_sync_error?: string | null
          openai_synced_at?: string | null
          processing_status?: Database['public']['Enums']['estado_procesamiento_documento']
          refcount?: number
          refcount_cero_desde?: string | null
          sha256: string
          size_bytes: number
          storage_bucket?: string
          storage_path: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          detected_mime?: string
          id?: string
          openai_file_id?: string | null
          openai_sync_error?: string | null
          openai_synced_at?: string | null
          processing_status?: Database['public']['Enums']['estado_procesamiento_documento']
          refcount?: number
          refcount_cero_desde?: string | null
          sha256?: string
          size_bytes?: number
          storage_bucket?: string
          storage_path?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'file_blobs_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      file_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          event_type: string
          file_id: string | null
          id: string
          metadata: Json
          tenant_id: string
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          event_type: string
          file_id?: string | null
          id?: string
          metadata?: Json
          tenant_id: string
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          event_type?: string
          file_id?: string | null
          id?: string
          metadata?: Json
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'file_events_actor_user_id_fkey'
            columns: ['actor_user_id']
            isOneToOne: false
            referencedRelation: 'usuarios_app'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'file_events_file_id_fkey'
            columns: ['file_id']
            isOneToOne: false
            referencedRelation: 'files'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'file_events_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      file_grants: {
        Row: {
          created_at: string
          expires_at: string | null
          file_id: string
          granted_by: string
          id: string
          permission: Database['public']['Enums']['permiso_archivo_documental']
          subject_id: string
          subject_type: Database['public']['Enums']['tipo_sujeto_archivo_documental']
          tenant_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          file_id: string
          granted_by: string
          id?: string
          permission: Database['public']['Enums']['permiso_archivo_documental']
          subject_id: string
          subject_type: Database['public']['Enums']['tipo_sujeto_archivo_documental']
          tenant_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          file_id?: string
          granted_by?: string
          id?: string
          permission?: Database['public']['Enums']['permiso_archivo_documental']
          subject_id?: string
          subject_type?: Database['public']['Enums']['tipo_sujeto_archivo_documental']
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'file_grants_file_id_fkey'
            columns: ['file_id']
            isOneToOne: false
            referencedRelation: 'files'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'file_grants_granted_by_fkey'
            columns: ['granted_by']
            isOneToOne: false
            referencedRelation: 'usuarios_app'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'file_grants_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      file_user_state: {
        Row: {
          archived_at: string | null
          file_id: string
          last_used_at: string | null
          last_viewed_at: string | null
          pinned_at: string | null
          tenant_id: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          file_id: string
          last_used_at?: string | null
          last_viewed_at?: string | null
          pinned_at?: string | null
          tenant_id: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          file_id?: string
          last_used_at?: string | null
          last_viewed_at?: string | null
          pinned_at?: string | null
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'file_user_state_file_id_fkey'
            columns: ['file_id']
            isOneToOne: false
            referencedRelation: 'files'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'file_user_state_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'file_user_state_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'usuarios_app'
            referencedColumns: ['id']
          },
        ]
      }
      file_versions: {
        Row: {
          blob_id: string
          created_at: string
          file_id: string
          id: string
          original_filename: string
          tenant_id: string
          uploaded_by: string
          version_number: number
        }
        Insert: {
          blob_id: string
          created_at?: string
          file_id: string
          id?: string
          original_filename: string
          tenant_id: string
          uploaded_by: string
          version_number: number
        }
        Update: {
          blob_id?: string
          created_at?: string
          file_id?: string
          id?: string
          original_filename?: string
          tenant_id?: string
          uploaded_by?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: 'file_versions_blob_id_fkey'
            columns: ['blob_id']
            isOneToOne: false
            referencedRelation: 'file_blobs'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'file_versions_file_id_fkey'
            columns: ['file_id']
            isOneToOne: false
            referencedRelation: 'files'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'file_versions_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'file_versions_uploaded_by_fkey'
            columns: ['uploaded_by']
            isOneToOne: false
            referencedRelation: 'usuarios_app'
            referencedColumns: ['id']
          },
        ]
      }
      files: {
        Row: {
          created_at: string
          created_by: string
          current_version_id: string | null
          deleted_at: string | null
          description: string | null
          display_name: string
          id: string
          last_used_at: string | null
          source: string
          status: Database['public']['Enums']['estado_procesamiento_documento']
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          current_version_id?: string | null
          deleted_at?: string | null
          description?: string | null
          display_name: string
          id?: string
          last_used_at?: string | null
          source?: string
          status?: Database['public']['Enums']['estado_procesamiento_documento']
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          current_version_id?: string | null
          deleted_at?: string | null
          description?: string | null
          display_name?: string
          id?: string
          last_used_at?: string | null
          source?: string
          status?: Database['public']['Enums']['estado_procesamiento_documento']
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'files_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'usuarios_app'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'files_current_version_fk'
            columns: ['current_version_id']
            isOneToOne: false
            referencedRelation: 'file_versions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'files_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      ingestion_jobs: {
        Row: {
          attempts: number
          available_at: string
          completed_at: string | null
          created_at: string
          file_version_id: string | null
          id: string
          idempotency_key: string
          job_type: Database['public']['Enums']['tipo_trabajo_ingesta_documental']
          last_error: Json | null
          locked_at: string | null
          locked_by: string | null
          payload: Json
          status: Database['public']['Enums']['estado_trabajo_ingesta_documental']
          tenant_id: string
          upload_session_id: string | null
        }
        Insert: {
          attempts?: number
          available_at?: string
          completed_at?: string | null
          created_at?: string
          file_version_id?: string | null
          id?: string
          idempotency_key: string
          job_type: Database['public']['Enums']['tipo_trabajo_ingesta_documental']
          last_error?: Json | null
          locked_at?: string | null
          locked_by?: string | null
          payload?: Json
          status?: Database['public']['Enums']['estado_trabajo_ingesta_documental']
          tenant_id: string
          upload_session_id?: string | null
        }
        Update: {
          attempts?: number
          available_at?: string
          completed_at?: string | null
          created_at?: string
          file_version_id?: string | null
          id?: string
          idempotency_key?: string
          job_type?: Database['public']['Enums']['tipo_trabajo_ingesta_documental']
          last_error?: Json | null
          locked_at?: string | null
          locked_by?: string | null
          payload?: Json
          status?: Database['public']['Enums']['estado_trabajo_ingesta_documental']
          tenant_id?: string
          upload_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'ingestion_jobs_file_version_id_fkey'
            columns: ['file_version_id']
            isOneToOne: false
            referencedRelation: 'file_versions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'ingestion_jobs_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'ingestion_jobs_upload_session_id_fkey'
            columns: ['upload_session_id']
            isOneToOne: false
            referencedRelation: 'upload_sessions'
            referencedColumns: ['id']
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
          tipo: Database['public']['Enums']['tipo_interaccion_ia']
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
          tipo: Database['public']['Enums']['tipo_interaccion_ia']
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
          tipo?: Database['public']['Enums']['tipo_interaccion_ia']
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'interacciones_ia_asignatura_id_fkey'
            columns: ['asignatura_id']
            isOneToOne: false
            referencedRelation: 'asignaturas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'interacciones_ia_asignatura_id_fkey'
            columns: ['asignatura_id']
            isOneToOne: false
            referencedRelation: 'plantilla_asignatura'
            referencedColumns: ['asignatura_id']
          },
          {
            foreignKeyName: 'interacciones_ia_plan_estudio_id_fkey'
            columns: ['plan_estudio_id']
            isOneToOne: false
            referencedRelation: 'planes_estudio'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'interacciones_ia_plan_estudio_id_fkey'
            columns: ['plan_estudio_id']
            isOneToOne: false
            referencedRelation: 'plantilla_plan'
            referencedColumns: ['plan_estudio_id']
          },
          {
            foreignKeyName: 'interacciones_ia_usuario_id_fkey'
            columns: ['usuario_id']
            isOneToOne: false
            referencedRelation: 'usuarios_app'
            referencedColumns: ['id']
          },
        ]
      }
      learning_generation_jobs: {
        Row: {
          actualizado_en: string
          asignatura_id: string
          completado_en: string | null
          config_json: Json
          creado_en: string
          creado_por: string | null
          error: string | null
          estado: Database['public']['Enums']['learning_generation_estado']
          id: string
          intento_generacion_activo_id: string | null
          openai_response_id: string | null
          requested_types: Array<
            Database['public']['Enums']['learning_object_tipo']
          >
          resultado_json: Json
          scope: Database['public']['Enums']['learning_generation_scope']
          tema_id: string | null
          unidad_id: string | null
        }
        Insert: {
          actualizado_en?: string
          asignatura_id: string
          completado_en?: string | null
          config_json?: Json
          creado_en?: string
          creado_por?: string | null
          error?: string | null
          estado?: Database['public']['Enums']['learning_generation_estado']
          id?: string
          intento_generacion_activo_id?: string | null
          openai_response_id?: string | null
          requested_types: Array<
            Database['public']['Enums']['learning_object_tipo']
          >
          resultado_json?: Json
          scope?: Database['public']['Enums']['learning_generation_scope']
          tema_id?: string | null
          unidad_id?: string | null
        }
        Update: {
          actualizado_en?: string
          asignatura_id?: string
          completado_en?: string | null
          config_json?: Json
          creado_en?: string
          creado_por?: string | null
          error?: string | null
          estado?: Database['public']['Enums']['learning_generation_estado']
          id?: string
          intento_generacion_activo_id?: string | null
          openai_response_id?: string | null
          requested_types?: Array<
            Database['public']['Enums']['learning_object_tipo']
          >
          resultado_json?: Json
          scope?: Database['public']['Enums']['learning_generation_scope']
          tema_id?: string | null
          unidad_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'learning_generation_jobs_asignatura_id_fkey'
            columns: ['asignatura_id']
            isOneToOne: false
            referencedRelation: 'asignaturas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'learning_generation_jobs_asignatura_id_fkey'
            columns: ['asignatura_id']
            isOneToOne: false
            referencedRelation: 'plantilla_asignatura'
            referencedColumns: ['asignatura_id']
          },
          {
            foreignKeyName: 'learning_generation_jobs_creado_por_fkey'
            columns: ['creado_por']
            isOneToOne: false
            referencedRelation: 'usuarios_app'
            referencedColumns: ['id']
          },
        ]
      }
      learning_objects: {
        Row: {
          actualizado_en: string
          actualizado_por: string | null
          archivo_path: string | null
          asignatura_id: string
          contenido_json: Json
          creado_en: string
          creado_por: string | null
          descripcion: string | null
          generation_job_id: string | null
          id: string
          interaccion_ia_id: string | null
          metadata: Json
          score: number | null
          source_refs: Json
          tema_id: string | null
          tipo: Database['public']['Enums']['learning_object_tipo']
          titulo: string
          unidad_id: string | null
        }
        Insert: {
          actualizado_en?: string
          actualizado_por?: string | null
          archivo_path?: string | null
          asignatura_id: string
          contenido_json?: Json
          creado_en?: string
          creado_por?: string | null
          descripcion?: string | null
          generation_job_id?: string | null
          id?: string
          interaccion_ia_id?: string | null
          metadata?: Json
          score?: number | null
          source_refs?: Json
          tema_id?: string | null
          tipo: Database['public']['Enums']['learning_object_tipo']
          titulo: string
          unidad_id?: string | null
        }
        Update: {
          actualizado_en?: string
          actualizado_por?: string | null
          archivo_path?: string | null
          asignatura_id?: string
          contenido_json?: Json
          creado_en?: string
          creado_por?: string | null
          descripcion?: string | null
          generation_job_id?: string | null
          id?: string
          interaccion_ia_id?: string | null
          metadata?: Json
          score?: number | null
          source_refs?: Json
          tema_id?: string | null
          tipo?: Database['public']['Enums']['learning_object_tipo']
          titulo?: string
          unidad_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'learning_objects_actualizado_por_fkey'
            columns: ['actualizado_por']
            isOneToOne: false
            referencedRelation: 'usuarios_app'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'learning_objects_asignatura_id_fkey'
            columns: ['asignatura_id']
            isOneToOne: false
            referencedRelation: 'asignaturas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'learning_objects_asignatura_id_fkey'
            columns: ['asignatura_id']
            isOneToOne: false
            referencedRelation: 'plantilla_asignatura'
            referencedColumns: ['asignatura_id']
          },
          {
            foreignKeyName: 'learning_objects_creado_por_fkey'
            columns: ['creado_por']
            isOneToOne: false
            referencedRelation: 'usuarios_app'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'learning_objects_generation_job_id_fkey'
            columns: ['generation_job_id']
            isOneToOne: false
            referencedRelation: 'learning_generation_jobs'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'learning_objects_interaccion_ia_id_fkey'
            columns: ['interaccion_ia_id']
            isOneToOne: false
            referencedRelation: 'interacciones_ia'
            referencedColumns: ['id']
          },
        ]
      }
      learning_quality_scores: {
        Row: {
          asignatura_id: string
          calculado_en: string
          generado_por: string | null
          generation_job_id: string | null
          id: string
          recomendaciones_json: Json
          rubrica_json: Json
          score_total: number
          tema_id: string | null
          unidad_id: string | null
        }
        Insert: {
          asignatura_id: string
          calculado_en?: string
          generado_por?: string | null
          generation_job_id?: string | null
          id?: string
          recomendaciones_json?: Json
          rubrica_json?: Json
          score_total: number
          tema_id?: string | null
          unidad_id?: string | null
        }
        Update: {
          asignatura_id?: string
          calculado_en?: string
          generado_por?: string | null
          generation_job_id?: string | null
          id?: string
          recomendaciones_json?: Json
          rubrica_json?: Json
          score_total?: number
          tema_id?: string | null
          unidad_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'learning_quality_scores_asignatura_id_fkey'
            columns: ['asignatura_id']
            isOneToOne: false
            referencedRelation: 'asignaturas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'learning_quality_scores_asignatura_id_fkey'
            columns: ['asignatura_id']
            isOneToOne: false
            referencedRelation: 'plantilla_asignatura'
            referencedColumns: ['asignatura_id']
          },
          {
            foreignKeyName: 'learning_quality_scores_generado_por_fkey'
            columns: ['generado_por']
            isOneToOne: false
            referencedRelation: 'usuarios_app'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'learning_quality_scores_generation_job_id_fkey'
            columns: ['generation_job_id']
            isOneToOne: false
            referencedRelation: 'learning_generation_jobs'
            referencedColumns: ['id']
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
            foreignKeyName: 'lineas_curriculares_sugeridas_actualizado_por_fkey'
            columns: ['actualizado_por']
            isOneToOne: false
            referencedRelation: 'usuarios_app'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lineas_curriculares_sugeridas_creado_por_fkey'
            columns: ['creado_por']
            isOneToOne: false
            referencedRelation: 'usuarios_app'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lineas_curriculares_sugeridas_facultad_id_fkey'
            columns: ['facultad_id']
            isOneToOne: false
            referencedRelation: 'facultades'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lineas_curriculares_sugeridas_facultad_id_fkey'
            columns: ['facultad_id']
            isOneToOne: false
            referencedRelation: 'registros_oficiales_plan_detalle'
            referencedColumns: ['facultad_id']
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
            foreignKeyName: 'lineas_plan_actualizado_por_fkey'
            columns: ['actualizado_por']
            isOneToOne: false
            referencedRelation: 'usuarios_app'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lineas_plan_creado_por_fkey'
            columns: ['creado_por']
            isOneToOne: false
            referencedRelation: 'usuarios_app'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lineas_plan_plan_estudio_id_fkey'
            columns: ['plan_estudio_id']
            isOneToOne: false
            referencedRelation: 'planes_estudio'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lineas_plan_plan_estudio_id_fkey'
            columns: ['plan_estudio_id']
            isOneToOne: false
            referencedRelation: 'plantilla_plan'
            referencedColumns: ['plan_estudio_id']
          },
        ]
      }
      message_file_references: {
        Row: {
          created_at: string
          file_id: string
          file_version_id: string
          message_id: string
          message_type: Database['public']['Enums']['tipo_conversacion_documental']
          reference_mode: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          file_id: string
          file_version_id: string
          message_id: string
          message_type: Database['public']['Enums']['tipo_conversacion_documental']
          reference_mode: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          file_id?: string
          file_version_id?: string
          message_id?: string
          message_type?: Database['public']['Enums']['tipo_conversacion_documental']
          reference_mode?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'message_file_references_file_id_fkey'
            columns: ['file_id']
            isOneToOne: false
            referencedRelation: 'files'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'message_file_references_file_version_id_fkey'
            columns: ['file_version_id']
            isOneToOne: false
            referencedRelation: 'file_versions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'message_file_references_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
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
          tipo: Database['public']['Enums']['tipo_notificacion']
          usuario_id: string
        }
        Insert: {
          creado_en?: string
          id?: string
          leida?: boolean
          leida_en?: string | null
          payload?: Json
          tipo: Database['public']['Enums']['tipo_notificacion']
          usuario_id: string
        }
        Update: {
          creado_en?: string
          id?: string
          leida?: boolean
          leida_en?: string | null
          payload?: Json
          tipo?: Database['public']['Enums']['tipo_notificacion']
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'notificaciones_usuario_id_fkey'
            columns: ['usuario_id']
            isOneToOne: false
            referencedRelation: 'usuarios_app'
            referencedColumns: ['id']
          },
        ]
      }
      observability_test_runs: {
        Row: {
          completed_at: string | null
          created_by: string | null
          error_code: string | null
          error_message: string | null
          estado: string
          id: string
          latency_ms: number | null
          metadata: Json
          openai_response_id: string | null
          started_at: string
          tipo: string
        }
        Insert: {
          completed_at?: string | null
          created_by?: string | null
          error_code?: string | null
          error_message?: string | null
          estado?: string
          id?: string
          latency_ms?: number | null
          metadata?: Json
          openai_response_id?: string | null
          started_at?: string
          tipo: string
        }
        Update: {
          completed_at?: string | null
          created_by?: string | null
          error_code?: string | null
          error_message?: string | null
          estado?: string
          id?: string
          latency_ms?: number | null
          metadata?: Json
          openai_response_id?: string | null
          started_at?: string
          tipo?: string
        }
        Relationships: []
      }
      observability_webhook_events: {
        Row: {
          delivery_count: number
          event_id: string
          event_type: string
          id: string
          last_received_at: string
          openai_response_id: string | null
          payload: Json
          processing_error: string | null
          processing_status: string
          received_at: string
          signature_valid: boolean
          test_run_id: string | null
        }
        Insert: {
          delivery_count?: number
          event_id: string
          event_type: string
          id?: string
          last_received_at?: string
          openai_response_id?: string | null
          payload?: Json
          processing_error?: string | null
          processing_status?: string
          received_at?: string
          signature_valid?: boolean
          test_run_id?: string | null
        }
        Update: {
          delivery_count?: number
          event_id?: string
          event_type?: string
          id?: string
          last_received_at?: string
          openai_response_id?: string | null
          payload?: Json
          processing_error?: string | null
          processing_status?: string
          received_at?: string
          signature_valid?: boolean
          test_run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'observability_webhook_events_test_run_id_fkey'
            columns: ['test_run_id']
            isOneToOne: false
            referencedRelation: 'observability_test_runs'
            referencedColumns: ['id']
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
            foreignKeyName: 'plan_expertos_experto_id_fkey'
            columns: ['experto_id']
            isOneToOne: false
            referencedRelation: 'expertos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'plan_expertos_plan_estudio_id_fkey'
            columns: ['plan_estudio_id']
            isOneToOne: false
            referencedRelation: 'planes_estudio'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'plan_expertos_plan_estudio_id_fkey'
            columns: ['plan_estudio_id']
            isOneToOne: false
            referencedRelation: 'plantilla_plan'
            referencedColumns: ['plan_estudio_id']
          },
        ]
      }
      plan_mensajes_ia: {
        Row: {
          campos: Array<string>
          conversacion_plan_id: string
          enviado_por: string
          estado: Database['public']['Enums']['estado_mensaje_ia']
          fecha_actualizacion: string
          fecha_creacion: string
          id: string
          intencion: string | null
          is_refusal: boolean
          mensaje: string
          openai_response_id: string | null
          propuesta: Json | null
          reasoning_effort: string
          respuesta: string | null
          retry_of_message_id: string | null
          web_search_enabled: boolean
        }
        Insert: {
          campos?: Array<string>
          conversacion_plan_id: string
          enviado_por?: string
          estado?: Database['public']['Enums']['estado_mensaje_ia']
          fecha_actualizacion?: string
          fecha_creacion?: string
          id?: string
          intencion?: string | null
          is_refusal?: boolean
          mensaje: string
          openai_response_id?: string | null
          propuesta?: Json | null
          reasoning_effort?: string
          respuesta?: string | null
          retry_of_message_id?: string | null
          web_search_enabled?: boolean
        }
        Update: {
          campos?: Array<string>
          conversacion_plan_id?: string
          enviado_por?: string
          estado?: Database['public']['Enums']['estado_mensaje_ia']
          fecha_actualizacion?: string
          fecha_creacion?: string
          id?: string
          intencion?: string | null
          is_refusal?: boolean
          mensaje?: string
          openai_response_id?: string | null
          propuesta?: Json | null
          reasoning_effort?: string
          respuesta?: string | null
          retry_of_message_id?: string | null
          web_search_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: 'plan_mensajes_ia_conversacion_plan_id_fkey'
            columns: ['conversacion_plan_id']
            isOneToOne: false
            referencedRelation: 'conversaciones_plan'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'plan_mensajes_ia_retry_source_fkey'
            columns: [
              'retry_of_message_id',
              'conversacion_plan_id',
              'enviado_por',
            ]
            isOneToOne: false
            referencedRelation: 'plan_mensajes_ia'
            referencedColumns: ['id', 'conversacion_plan_id', 'enviado_por']
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
          tipo_ciclo: Database['public']['Enums']['tipo_ciclo']
          tipo_origen: Database['public']['Enums']['tipo_origen'] | null
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
          tipo_ciclo: Database['public']['Enums']['tipo_ciclo']
          tipo_origen?: Database['public']['Enums']['tipo_origen'] | null
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
          tipo_ciclo?: Database['public']['Enums']['tipo_ciclo']
          tipo_origen?: Database['public']['Enums']['tipo_origen'] | null
        }
        Relationships: [
          {
            foreignKeyName: 'planes_estudio_actualizado_por_fkey'
            columns: ['actualizado_por']
            isOneToOne: false
            referencedRelation: 'usuarios_app'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'planes_estudio_carrera_id_fkey'
            columns: ['carrera_id']
            isOneToOne: false
            referencedRelation: 'carreras'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'planes_estudio_carrera_id_fkey'
            columns: ['carrera_id']
            isOneToOne: false
            referencedRelation: 'registros_oficiales_plan_detalle'
            referencedColumns: ['carrera_id']
          },
          {
            foreignKeyName: 'planes_estudio_creado_por_fkey'
            columns: ['creado_por']
            isOneToOne: false
            referencedRelation: 'usuarios_app'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'planes_estudio_estado_actual_id_fkey'
            columns: ['estado_actual_id']
            isOneToOne: false
            referencedRelation: 'estados_plan'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'planes_estudio_estructura_id_fkey'
            columns: ['estructura_id']
            isOneToOne: false
            referencedRelation: 'estructuras_plan'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'planes_estudio_estructura_id_fkey'
            columns: ['estructura_id']
            isOneToOne: false
            referencedRelation: 'plantilla_plan'
            referencedColumns: ['estructura_id']
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
            foreignKeyName: 'reasignaciones_reasignado_por_fkey'
            columns: ['reasignado_por']
            isOneToOne: false
            referencedRelation: 'usuarios_app'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'reasignaciones_usuario_destino_fkey'
            columns: ['usuario_destino']
            isOneToOne: false
            referencedRelation: 'usuarios_app'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'reasignaciones_usuario_origen_fkey'
            columns: ['usuario_origen']
            isOneToOne: false
            referencedRelation: 'usuarios_app'
            referencedColumns: ['id']
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
            foreignKeyName: 'registros_oficiales_plan_actualizado_por_fkey'
            columns: ['actualizado_por']
            isOneToOne: false
            referencedRelation: 'usuarios_app'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'registros_oficiales_plan_documento_archivo_id_fkey'
            columns: ['documento_archivo_id']
            isOneToOne: false
            referencedRelation: 'archivos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'registros_oficiales_plan_plan_estudio_id_fkey'
            columns: ['plan_estudio_id']
            isOneToOne: true
            referencedRelation: 'planes_estudio'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'registros_oficiales_plan_plan_estudio_id_fkey'
            columns: ['plan_estudio_id']
            isOneToOne: true
            referencedRelation: 'plantilla_plan'
            referencedColumns: ['plan_estudio_id']
          },
          {
            foreignKeyName: 'registros_oficiales_plan_registrado_por_fkey'
            columns: ['registrado_por']
            isOneToOne: false
            referencedRelation: 'usuarios_app'
            referencedColumns: ['id']
          },
        ]
      }
      responsables_asignatura: {
        Row: {
          asignado_por: string | null
          asignatura_id: string
          creado_en: string
          id: string
          rol: Database['public']['Enums']['rol_responsable_asignatura']
          usuario_id: string
        }
        Insert: {
          asignado_por?: string | null
          asignatura_id: string
          creado_en?: string
          id?: string
          rol?: Database['public']['Enums']['rol_responsable_asignatura']
          usuario_id: string
        }
        Update: {
          asignado_por?: string | null
          asignatura_id?: string
          creado_en?: string
          id?: string
          rol?: Database['public']['Enums']['rol_responsable_asignatura']
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'responsables_asignatura_asignado_por_fkey'
            columns: ['asignado_por']
            isOneToOne: false
            referencedRelation: 'usuarios_app'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'responsables_asignatura_asignatura_id_fkey'
            columns: ['asignatura_id']
            isOneToOne: false
            referencedRelation: 'asignaturas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'responsables_asignatura_asignatura_id_fkey'
            columns: ['asignatura_id']
            isOneToOne: false
            referencedRelation: 'plantilla_asignatura'
            referencedColumns: ['asignatura_id']
          },
          {
            foreignKeyName: 'responsables_asignatura_usuario_id_fkey'
            columns: ['usuario_id']
            isOneToOne: false
            referencedRelation: 'usuarios_app'
            referencedColumns: ['id']
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
            foreignKeyName: 'roles_permisos_permiso_id_fkey'
            columns: ['permiso_id']
            isOneToOne: false
            referencedRelation: 'permisos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'roles_permisos_rol_id_fkey'
            columns: ['rol_id']
            isOneToOne: false
            referencedRelation: 'roles'
            referencedColumns: ['id']
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
          estatus: Database['public']['Enums']['estado_tarea_revision']
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
          estatus?: Database['public']['Enums']['estado_tarea_revision']
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
          estatus?: Database['public']['Enums']['estado_tarea_revision']
          fecha_limite?: string | null
          id?: string
          plan_estudio_id?: string
          rol_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'tareas_revision_asignado_a_fkey'
            columns: ['asignado_a']
            isOneToOne: false
            referencedRelation: 'usuarios_app'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tareas_revision_creado_por_fkey'
            columns: ['creado_por']
            isOneToOne: false
            referencedRelation: 'usuarios_app'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tareas_revision_estado_id_fkey'
            columns: ['estado_id']
            isOneToOne: false
            referencedRelation: 'estados_plan'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tareas_revision_plan_estudio_id_fkey'
            columns: ['plan_estudio_id']
            isOneToOne: false
            referencedRelation: 'planes_estudio'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tareas_revision_plan_estudio_id_fkey'
            columns: ['plan_estudio_id']
            isOneToOne: false
            referencedRelation: 'plantilla_plan'
            referencedColumns: ['plan_estudio_id']
          },
          {
            foreignKeyName: 'tareas_revision_rol_id_fkey'
            columns: ['rol_id']
            isOneToOne: false
            referencedRelation: 'roles'
            referencedColumns: ['id']
          },
        ]
      }
      tenant_memberships: {
        Row: {
          created_at: string
          is_default: boolean
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          is_default?: boolean
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          is_default?: boolean
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'tenant_memberships_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tenant_memberships_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'usuarios_app'
            referencedColumns: ['id']
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          id: string
          nombre: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          nombre: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          nombre?: string
          slug?: string
        }
        Relationships: []
      }
      trabajos_generacion_ia: {
        Row: {
          actualizado_en: string
          cancelacion_solicitada_en: string | null
          completado_en: string | null
          creado_en: string
          entidad_id: string
          estado: Database['public']['Enums']['estado_trabajo_generacion_ia']
          estado_openai: string | null
          fecha_limite: string
          id: string
          iniciado_en: string
          intentos: number
          metadata: Json
          openai_response_id: string
          proxima_revision_en: string
          reclamado_hasta: string | null
          reclamado_por: string | null
          tipo_entidad: Database['public']['Enums']['tipo_trabajo_generacion_ia']
          token_reclamacion: string | null
          ultimo_error: Json | null
        }
        Insert: {
          actualizado_en?: string
          cancelacion_solicitada_en?: string | null
          completado_en?: string | null
          creado_en?: string
          entidad_id: string
          estado?: Database['public']['Enums']['estado_trabajo_generacion_ia']
          estado_openai?: string | null
          fecha_limite?: string
          id?: string
          iniciado_en?: string
          intentos?: number
          metadata?: Json
          openai_response_id: string
          proxima_revision_en?: string
          reclamado_hasta?: string | null
          reclamado_por?: string | null
          tipo_entidad: Database['public']['Enums']['tipo_trabajo_generacion_ia']
          token_reclamacion?: string | null
          ultimo_error?: Json | null
        }
        Update: {
          actualizado_en?: string
          cancelacion_solicitada_en?: string | null
          completado_en?: string | null
          creado_en?: string
          entidad_id?: string
          estado?: Database['public']['Enums']['estado_trabajo_generacion_ia']
          estado_openai?: string | null
          fecha_limite?: string
          id?: string
          iniciado_en?: string
          intentos?: number
          metadata?: Json
          openai_response_id?: string
          proxima_revision_en?: string
          reclamado_hasta?: string | null
          reclamado_por?: string | null
          tipo_entidad?: Database['public']['Enums']['tipo_trabajo_generacion_ia']
          token_reclamacion?: string | null
          ultimo_error?: Json | null
        }
        Relationships: []
      }
      transiciones_estado_plan: {
        Row: {
          creado_en: string
          desde_estado_id: string
          hacia_estado_id: string
          id: string
          rol_permitido_id: string
          tipo_estructura:
            | Database['public']['Enums']['tipo_estructura_plan']
            | null
        }
        Insert: {
          creado_en?: string
          desde_estado_id: string
          hacia_estado_id: string
          id?: string
          rol_permitido_id: string
          tipo_estructura?:
            | Database['public']['Enums']['tipo_estructura_plan']
            | null
        }
        Update: {
          creado_en?: string
          desde_estado_id?: string
          hacia_estado_id?: string
          id?: string
          rol_permitido_id?: string
          tipo_estructura?:
            | Database['public']['Enums']['tipo_estructura_plan']
            | null
        }
        Relationships: [
          {
            foreignKeyName: 'transiciones_estado_plan_desde_estado_id_fkey'
            columns: ['desde_estado_id']
            isOneToOne: false
            referencedRelation: 'estados_plan'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'transiciones_estado_plan_hacia_estado_id_fkey'
            columns: ['hacia_estado_id']
            isOneToOne: false
            referencedRelation: 'estados_plan'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'transiciones_estado_plan_rol_permitido_id_fkey'
            columns: ['rol_permitido_id']
            isOneToOne: false
            referencedRelation: 'roles'
            referencedColumns: ['id']
          },
        ]
      }
      upload_sessions: {
        Row: {
          client_sha256: string | null
          completed_at: string | null
          created_at: string
          declared_mime: string
          declared_size: number
          error_code: string | null
          expires_at: string
          id: string
          original_filename: string
          result_file_id: string | null
          source: string
          status: Database['public']['Enums']['estado_sesion_carga_documento']
          temporary_path: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          client_sha256?: string | null
          completed_at?: string | null
          created_at?: string
          declared_mime: string
          declared_size: number
          error_code?: string | null
          expires_at?: string
          id?: string
          original_filename: string
          result_file_id?: string | null
          source?: string
          status?: Database['public']['Enums']['estado_sesion_carga_documento']
          temporary_path: string
          tenant_id: string
          user_id: string
        }
        Update: {
          client_sha256?: string | null
          completed_at?: string | null
          created_at?: string
          declared_mime?: string
          declared_size?: number
          error_code?: string | null
          expires_at?: string
          id?: string
          original_filename?: string
          result_file_id?: string | null
          source?: string
          status?: Database['public']['Enums']['estado_sesion_carga_documento']
          temporary_path?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'upload_sessions_result_file_fk'
            columns: ['result_file_id']
            isOneToOne: false
            referencedRelation: 'files'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'upload_sessions_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'upload_sessions_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'usuarios_app'
            referencedColumns: ['id']
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
            foreignKeyName: 'usuarios_app_invitado_por_fkey'
            columns: ['invitado_por']
            isOneToOne: false
            referencedRelation: 'usuarios_app'
            referencedColumns: ['id']
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
            foreignKeyName: 'usuarios_roles_asignado_por_fkey'
            columns: ['asignado_por']
            isOneToOne: false
            referencedRelation: 'usuarios_app'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'usuarios_roles_carrera_id_fkey'
            columns: ['carrera_id']
            isOneToOne: false
            referencedRelation: 'carreras'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'usuarios_roles_carrera_id_fkey'
            columns: ['carrera_id']
            isOneToOne: false
            referencedRelation: 'registros_oficiales_plan_detalle'
            referencedColumns: ['carrera_id']
          },
          {
            foreignKeyName: 'usuarios_roles_facultad_id_fkey'
            columns: ['facultad_id']
            isOneToOne: false
            referencedRelation: 'facultades'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'usuarios_roles_facultad_id_fkey'
            columns: ['facultad_id']
            isOneToOne: false
            referencedRelation: 'registros_oficiales_plan_detalle'
            referencedColumns: ['facultad_id']
          },
          {
            foreignKeyName: 'usuarios_roles_rol_id_fkey'
            columns: ['rol_id']
            isOneToOne: false
            referencedRelation: 'roles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'usuarios_roles_usuario_id_fkey'
            columns: ['usuario_id']
            isOneToOne: false
            referencedRelation: 'usuarios_app'
            referencedColumns: ['id']
          },
        ]
      }
      vector_store_selecciones: {
        Row: {
          blob_ids: Array<string>
          created_at: string
          error: string | null
          estado: string
          expires_at: string | null
          id: string
          last_active_at: string
          openai_vector_store_id: string | null
          seleccion_sha256: string
          tenant_id: string
        }
        Insert: {
          blob_ids?: Array<string>
          created_at?: string
          error?: string | null
          estado?: string
          expires_at?: string | null
          id?: string
          last_active_at?: string
          openai_vector_store_id?: string | null
          seleccion_sha256: string
          tenant_id: string
        }
        Update: {
          blob_ids?: Array<string>
          created_at?: string
          error?: string | null
          estado?: string
          expires_at?: string | null
          id?: string
          last_active_at?: string
          openai_vector_store_id?: string | null
          seleccion_sha256?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'vector_store_selecciones_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      pg_all_foreign_keys: {
        Row: {
          fk_columns: Array<unknown> | null
          fk_constraint_name: unknown
          fk_schema_name: unknown
          fk_table_name: unknown
          fk_table_oid: unknown
          is_deferrable: boolean | null
          is_deferred: boolean | null
          match_type: string | null
          on_delete: string | null
          on_update: string | null
          pk_columns: Array<unknown> | null
          pk_constraint_name: unknown
          pk_index_name: unknown
          pk_schema_name: unknown
          pk_table_name: unknown
          pk_table_oid: unknown
        }
        Relationships: []
      }
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
            | Database['public']['Enums']['nivel_plan_estudio']
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
            foreignKeyName: 'registros_oficiales_plan_actualizado_por_fkey'
            columns: ['actualizado_por']
            isOneToOne: false
            referencedRelation: 'usuarios_app'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'registros_oficiales_plan_documento_archivo_id_fkey'
            columns: ['documento_archivo_id']
            isOneToOne: false
            referencedRelation: 'archivos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'registros_oficiales_plan_plan_estudio_id_fkey'
            columns: ['plan_estudio_id']
            isOneToOne: true
            referencedRelation: 'planes_estudio'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'registros_oficiales_plan_plan_estudio_id_fkey'
            columns: ['plan_estudio_id']
            isOneToOne: true
            referencedRelation: 'plantilla_plan'
            referencedColumns: ['plan_estudio_id']
          },
          {
            foreignKeyName: 'registros_oficiales_plan_registrado_por_fkey'
            columns: ['registrado_por']
            isOneToOne: false
            referencedRelation: 'usuarios_app'
            referencedColumns: ['id']
          },
        ]
      }
      tap_funky: {
        Row: {
          args: string | null
          is_definer: boolean | null
          is_strict: boolean | null
          is_visible: boolean | null
          kind: unknown
          langoid: unknown
          name: unknown
          oid: unknown
          owner: unknown
          returns: string | null
          returns_set: boolean | null
          schema: unknown
          volatility: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _cleanup: { Args: never; Returns: boolean }
      _contract_on: { Args: { '': string }; Returns: unknown }
      _currtest: { Args: never; Returns: number }
      _db_privs: { Args: never; Returns: Array<unknown> }
      _extensions: { Args: never; Returns: Array<unknown> }
      _get: { Args: { '': string }; Returns: number }
      _get_latest: { Args: { '': string }; Returns: Array<number> }
      _get_note: { Args: { '': string }; Returns: string }
      _is_verbose: { Args: never; Returns: boolean }
      _prokind: { Args: { p_oid: unknown }; Returns: unknown }
      _query: { Args: { '': string }; Returns: string }
      _refine_vol: { Args: { '': string }; Returns: string }
      _retval: { Args: { '': string }; Returns: string }
      _table_privs: { Args: never; Returns: Array<unknown> }
      _temptypes: { Args: { '': string }; Returns: string }
      _todo: { Args: never; Returns: string }
      activar_cron_documentos_academicos: { Args: never; Returns: boolean }
      activar_cron_recuperacion_ia: { Args: never; Returns: boolean }
      adoptar_publicar_intento_chat_ia_webhook: {
        Args: {
          p_estado_openai: string
          p_iniciado_en?: string
          p_intento_id: string
          p_openai_response_id: string
        }
        Returns: Json
      }
      adoptar_publicar_intento_entidad_ia_webhook: {
        Args: {
          p_estado_openai: string
          p_iniciado_en?: string
          p_intento_id: string
          p_openai_response_id: string
        }
        Returns: Json
      }
      adoptar_publicar_intento_recursos_ia_webhook: {
        Args: {
          p_estado_openai: string
          p_iniciado_en?: string
          p_intento_id: string
          p_openai_response_id: string
        }
        Returns: Json
      }
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
        Returns: Array<{
          admin_override: boolean
          estado_clave: string
          motivo: string
        }>
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
      authz_can_create_carrera_catalog: {
        Args: { p_facultad_id: string; p_nivel: string }
        Returns: boolean
      }
      authz_can_list_plan_catalog_for_facultad: {
        Args: { p_facultad_id: string }
        Returns: boolean
      }
      authz_can_manage_carrera_catalog: {
        Args: { p_carrera_id: string }
        Returns: boolean
      }
      authz_can_manage_facultad_catalog: {
        Args: { p_facultad_id: string }
        Returns: boolean
      }
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
      autorizar_uso_archivo_documental: {
        Args: {
          p_file_id: string
          p_permiso: Database['public']['Enums']['permiso_archivo_documental']
          p_usuario_id: string
        }
        Returns: boolean
      }
      build_asignaturas_prefix_tsquery: {
        Args: { p_search: string }
        Returns: unknown
      }
      catalogo_asignaturas_buscar: {
        Args: {
          p_carrera_id?: string
          p_estado?: Database['public']['Enums']['estado_asignatura']
          p_facultad_id?: string
          p_incluir_archivadas?: boolean
          p_limit?: number
          p_offset?: number
          p_plan_estudio_id?: string
          p_q?: string
          p_tipo?: Database['public']['Enums']['tipo_asignatura']
        }
        Returns: Array<{
          asignatura_id: string
          carrera_id: string
          carrera_nivel: Database['public']['Enums']['nivel_plan_estudio']
          carrera_nombre: string
          codigo: string
          creditos: number
          estado: Database['public']['Enums']['estado_asignatura']
          facultad_color: string
          facultad_icono: string
          facultad_id: string
          facultad_nombre: string
          facultad_nombre_corto: string
          facultad_prefijo: string
          motivos_acceso: Json
          nombre: string
          numero_ciclo: number
          plan_estudio_id: string
          plan_nombre: string
          plan_tipo_estructura: Database['public']['Enums']['tipo_estructura_plan']
          rank: number
          responsables: Json
          tipo: Database['public']['Enums']['tipo_asignatura']
          total_count: number
        }>
      }
      col_is_null:
        | {
            Args: {
              column_name: unknown
              description?: string
              schema_name: unknown
              table_name: unknown
            }
            Returns: string
          }
        | {
            Args: {
              column_name: unknown
              description?: string
              table_name: unknown
            }
            Returns: string
          }
      col_not_null:
        | {
            Args: {
              column_name: unknown
              description?: string
              schema_name: unknown
              table_name: unknown
            }
            Returns: string
          }
        | {
            Args: {
              column_name: unknown
              description?: string
              table_name: unknown
            }
            Returns: string
          }
      confirmar_terminal_intento_generacion_ia: {
        Args: { p_intento_id: string; p_token_reclamacion: string }
        Returns: boolean
      }
      consultar_intento_chat_ia: {
        Args: { p_intento_id: string }
        Returns: Json
      }
      consultar_intento_generacion_ia: {
        Args: { p_intento_id: string }
        Returns: Json
      }
      consultar_publicacion_generacion_recursos_ia: {
        Args: {
          p_consulta_referencias: string
          p_generation_job_id: string
          p_modo_referencias: string
          p_openai_response_id: string
          p_referencias: Json
        }
        Returns: Json
      }
      consultar_publicacion_intento_recursos_ia: {
        Args: {
          p_generation_job_id: string
          p_intento_id: string
          p_openai_response_id: string
        }
        Returns: Json
      }
      crear_recursos_placeholder: {
        Args: {
          p_asignatura_id: string
          p_tema_id: string
          p_tipos: Array<string>
          p_unidad_id: string
        }
        Returns: Array<string>
      }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      datos_validos_con_definicion: {
        Args: { p_datos: Json; p_definicion: Json }
        Returns: boolean
      }
      diag:
        | {
            Args: { msg: unknown }
            Returns: {
              error: true
            } & 'Could not choose the best candidate function between: public.diag(msg => text), public.diag(msg => anyelement). Try renaming the parameters or the function itself in the database so function overloading can be resolved'
          }
        | {
            Args: { msg: string }
            Returns: {
              error: true
            } & 'Could not choose the best candidate function between: public.diag(msg => text), public.diag(msg => anyelement). Try renaming the parameters or the function itself in the database so function overloading can be resolved'
          }
      diag_test_name: { Args: { '': string }; Returns: string }
      do_tap:
        | { Args: never; Returns: Array<string> }
        | { Args: { '': string }; Returns: Array<string> }
      ejecutar_higiene_documental: {
        Args: { p_dias_gracia_gc?: number }
        Returns: Array<{
          blobs_encolados: number
          selecciones_expiradas: number
          selecciones_purgadas: number
        }>
      }
      encolar_trabajo_ingesta_documental: {
        Args: {
          p_file_version_id: string
          p_idempotency_key: string
          p_payload?: Json
          p_tenant_id: string
          p_tipo: Database['public']['Enums']['tipo_trabajo_ingesta_documental']
          p_upload_session_id: string
        }
        Returns: {
          attempts: number
          available_at: string
          completed_at: string | null
          created_at: string
          file_version_id: string | null
          id: string
          idempotency_key: string
          job_type: Database['public']['Enums']['tipo_trabajo_ingesta_documental']
          last_error: Json | null
          locked_at: string | null
          locked_by: string | null
          payload: Json
          status: Database['public']['Enums']['estado_trabajo_ingesta_documental']
          tenant_id: string
          upload_session_id: string | null
        }
        SetofOptions: {
          from: '*'
          to: 'ingestion_jobs'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      expirar_intentos_chat_ia: { Args: never; Returns: number }
      expirar_intentos_entidad_ia: { Args: never; Returns: number }
      expirar_intentos_generacion_ia: {
        Args: { p_handler: string; p_limite?: number }
        Returns: Json
      }
      expirar_trabajos_generacion_ia: { Args: never; Returns: number }
      fail:
        | { Args: never; Returns: string }
        | { Args: { '': string }; Returns: string }
      fallar_intento_recursos_ia: {
        Args: {
          p_error?: Json
          p_generation_job_id: string
          p_intento_id: string
          p_openai_response_id?: string
          p_token_reclamacion: string
        }
        Returns: boolean
      }
      finalizar_blob_gc: { Args: { p_blob_id: string }; Returns: boolean }
      finalizar_cancelacion_generacion_ia: {
        Args: { p_token_reclamacion: string; p_trabajo_id: string }
        Returns: boolean
      }
      finalizar_recursos_aprendizaje_ia: {
        Args: {
          p_estado_openai: string
          p_generation_job_id: string
          p_objetos: Json
          p_openai_response_id: string
          p_resultado: Json
          p_score: Json
          p_token_reclamacion: string
          p_trabajo_id: string
        }
        Returns: {
          actualizado_en: string
          cancelacion_solicitada_en: string | null
          completado_en: string | null
          creado_en: string
          entidad_id: string
          estado: Database['public']['Enums']['estado_trabajo_generacion_ia']
          estado_openai: string | null
          fecha_limite: string
          id: string
          iniciado_en: string
          intentos: number
          metadata: Json
          openai_response_id: string
          proxima_revision_en: string
          reclamado_hasta: string | null
          reclamado_por: string | null
          tipo_entidad: Database['public']['Enums']['tipo_trabajo_generacion_ia']
          token_reclamacion: string | null
          ultimo_error: Json | null
        }
        SetofOptions: {
          from: '*'
          to: 'trabajos_generacion_ia'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      finalizar_trabajo_generacion_ia: {
        Args: {
          p_error?: Json
          p_estado: Database['public']['Enums']['estado_trabajo_generacion_ia']
          p_estado_openai: string
          p_resultado?: Json
          p_token_reclamacion: string
          p_trabajo_id: string
        }
        Returns: {
          actualizado_en: string
          cancelacion_solicitada_en: string | null
          completado_en: string | null
          creado_en: string
          entidad_id: string
          estado: Database['public']['Enums']['estado_trabajo_generacion_ia']
          estado_openai: string | null
          fecha_limite: string
          id: string
          iniciado_en: string
          intentos: number
          metadata: Json
          openai_response_id: string
          proxima_revision_en: string
          reclamado_hasta: string | null
          reclamado_por: string | null
          tipo_entidad: Database['public']['Enums']['tipo_trabajo_generacion_ia']
          token_reclamacion: string | null
          ultimo_error: Json | null
        }
        SetofOptions: {
          from: '*'
          to: 'trabajos_generacion_ia'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      finalizar_trabajo_ingesta_documental: {
        Args: {
          p_error?: Json
          p_job_id: string
          p_ok: boolean
          p_reintentar_en?: string
          p_worker: string
        }
        Returns: boolean
      }
      findfuncs: { Args: { '': string }; Returns: Array<string> }
      finish: {
        Args: { exception_on_failure?: boolean }
        Returns: Array<string>
      }
      fn_calcular_score_preparacion: {
        Args: {
          p_asignatura_id: string
          p_tema_id?: string
          p_unidad_id?: string
        }
        Returns: number
      }
      fn_ensure_contenido_tematico_ids: { Args: { j: Json }; Returns: Json }
      fn_generar_nombre_plan_curricular: {
        Args: { p_carrera_id: string; p_fecha_inicio_imparticion: string }
        Returns: string
      }
      format_type_string: { Args: { '': string }; Returns: string }
      has_unique: { Args: { '': string }; Returns: string }
      in_todo: { Args: never; Returns: boolean }
      is_empty: { Args: { '': string }; Returns: string }
      isnt_empty: { Args: { '': string }; Returns: string }
      json_schema_parcial_definicion: {
        Args: { p_definicion: Json }
        Returns: Json
      }
      liberar_trabajo_generacion_ia: {
        Args: {
          p_error?: Json
          p_estado_openai: string
          p_proxima_revision_en: string
          p_token_reclamacion: string
          p_trabajo_id: string
        }
        Returns: boolean
      }
      listar_archivos_conversacion_documental: {
        Args: {
          p_conversation_id: string
          p_conversation_type: Database['public']['Enums']['tipo_conversacion_documental']
          p_tenant_id: string
          p_usuario_id: string
        }
        Returns: Array<{
          active: boolean
          added_at: string
          can_remove: boolean
          file_id: string
          first_used_at: string
          used: boolean
        }>
      }
      listar_biblioteca_documental: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_query?: string
          p_sort?: string
          p_tenant_id: string
          p_usuario_id: string
        }
        Returns: Array<{
          archived_at: string
          created_at: string
          current_version_id: string
          description: string
          detected_mime: string
          display_name: string
          id: string
          last_used_at: string
          last_viewed_at: string
          pinned_at: string
          size_bytes: number
          source: string
          status: Database['public']['Enums']['estado_procesamiento_documento']
          total_count: number
          updated_at: string
        }>
      }
      listar_colecciones_documentales: {
        Args: { p_tenant_id: string; p_usuario_id: string }
        Returns: Array<{
          created_at: string
          created_by: string
          description: string
          file_ids: Array<string>
          id: string
          kind: string
          name: string
          status: string
          updated_at: string
        }>
      }
      lives_ok: { Args: { '': string }; Returns: string }
      marcar_intento_generacion_ia_publicado: {
        Args: { p_intento_id: string; p_token_reclamacion: string }
        Returns: boolean
      }
      materializar_sesion_carga_documento: {
        Args: {
          p_detected_mime: string
          p_session_id: string
          p_sha256: string
          p_size_bytes: number
          p_storage_path: string
        }
        Returns: Array<{
          blob_created: boolean
          blob_id: string
          file_id: string
          file_version_id: string
        }>
      }
      nivel_es_posgrado: { Args: { p_nivel: string }; Returns: boolean }
      no_plan: { Args: never; Returns: Array<boolean> }
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
      num_failed: { Args: never; Returns: number }
      observability_admin_ping: { Args: never; Returns: Json }
      observability_applied_migrations: {
        Args: never
        Returns: Array<{
          name: string
          version: string
        }>
      }
      observability_public_ping: { Args: never; Returns: Json }
      os_name: { Args: never; Returns: string }
      pass:
        | { Args: never; Returns: string }
        | { Args: { '': string }; Returns: string }
      persistir_resultado_recursos_aprendizaje_ia: {
        Args: {
          p_generation_job_id: string
          p_objetos: Json
          p_openai_response_id: string
          p_resultado: Json
          p_score: Json
        }
        Returns: {
          actualizado_en: string
          asignatura_id: string
          completado_en: string | null
          config_json: Json
          creado_en: string
          creado_por: string | null
          error: string | null
          estado: Database['public']['Enums']['learning_generation_estado']
          id: string
          intento_generacion_activo_id: string | null
          openai_response_id: string | null
          requested_types: Array<
            Database['public']['Enums']['learning_object_tipo']
          >
          resultado_json: Json
          scope: Database['public']['Enums']['learning_generation_scope']
          tema_id: string | null
          unidad_id: string | null
        }
        SetofOptions: {
          from: '*'
          to: 'learning_generation_jobs'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      pg_version: { Args: never; Returns: string }
      pg_version_num: { Args: never; Returns: number }
      pgtap_version: { Args: never; Returns: number }
      plan_estado_clave: { Args: { p_plan_id: string }; Returns: string }
      planes_catalogo_buscar: {
        Args: {
          p_activo?: boolean
          p_carrera_id?: string
          p_estado_id?: string
          p_facultad_id?: string
          p_limit?: number
          p_nivel?: string
          p_offset?: number
          p_search?: string
        }
        Returns: Array<{
          carrera: Json
          estado_plan: Json
          estructura_plan: Json
          facultad: Json
          plan: Json
          puede_abrir_detalle: boolean
          total_count: number
        }>
      }
      preparar_blob_gc: {
        Args: { p_blob_id: string }
        Returns: Array<{
          blob_id: string
          openai_file_id: string
          storage_bucket: string
          storage_path: string
        }>
      }
      preparar_intento_chat_ia: {
        Args: {
          p_actor?: string
          p_consulta_referencias?: string
          p_conversacion_id: string
          p_intento_id: string
          p_mensaje_id: string
          p_modo_referencias?: string
          p_referencias?: Json
          p_solicitud: Json
          p_tipo_conversacion: Database['public']['Enums']['tipo_conversacion_documental']
          p_usuario_id: string
        }
        Returns: Json
      }
      preparar_intento_entidad_ia: {
        Args: {
          p_actor?: string
          p_consulta_referencias?: string
          p_contexto: Json
          p_entidad_id: string
          p_intento_id: string
          p_modo_referencias?: string
          p_referencias?: Json
          p_solicitud: Json
          p_tipo_entidad: Database['public']['Enums']['tipo_trabajo_generacion_ia']
          p_usuario_id: string
        }
        Returns: Json
      }
      preparar_intento_generacion_ia: {
        Args: {
          p_actor?: string
          p_consulta_referencias?: string
          p_contexto: Json
          p_entidad_id: string
          p_handler: string
          p_intento_id: string
          p_modo_referencias?: string
          p_payload_version: number
          p_referencias?: Json
          p_solicitud: Json
          p_tipo_entidad: Database['public']['Enums']['tipo_trabajo_generacion_ia']
        }
        Returns: Json
      }
      preparar_intento_recursos_ia: {
        Args: {
          p_actor?: string
          p_consulta_referencias?: string
          p_contexto: Json
          p_generation_job_id: string
          p_intento_id: string
          p_modo_referencias?: string
          p_referencias?: Json
          p_solicitud: Json
          p_usuario_id: string
        }
        Returns: Json
      }
      propiedad_restriccion_estados: {
        Args: { p_prop: Json }
        Returns: Array<string>
      }
      propiedad_restriccion_permiso: { Args: { p_prop: Json }; Returns: string }
      propiedad_tiene_restriccion: { Args: { p_prop: Json }; Returns: boolean }
      publicar_generacion_recursos_ia: {
        Args: {
          p_consulta_referencias?: string
          p_estado_local?: Database['public']['Enums']['learning_generation_estado']
          p_estado_openai?: string
          p_generation_job_id: string
          p_iniciado_en?: string
          p_metadata?: Json
          p_modo_referencias?: string
          p_openai_response_id: string
          p_referencias?: Json
          p_usuario_id: string
        }
        Returns: Json
      }
      publicar_intento_chat_ia: {
        Args: { p_intento_id: string; p_token_reclamacion: string }
        Returns: Json
      }
      publicar_intento_entidad_ia: {
        Args: { p_intento_id: string; p_token_reclamacion: string }
        Returns: Json
      }
      publicar_intento_recursos_ia: {
        Args: {
          p_estado_local?: Database['public']['Enums']['learning_generation_estado']
          p_estado_openai?: string
          p_generation_job_id: string
          p_iniciado_en?: string
          p_intento_id: string
          p_metadata?: Json
          p_openai_response_id: string
          p_token_reclamacion: string
          p_usuario_id: string
        }
        Returns: Json
      }
      publicar_solicitud_chat_ia: {
        Args: {
          p_consulta_referencias?: string
          p_conversacion_id: string
          p_estado_openai?: string
          p_iniciado_en?: string
          p_mensaje_id: string
          p_metadata?: Json
          p_modo_referencias?: string
          p_openai_response_id: string
          p_referencias?: Json
          p_tipo_conversacion: Database['public']['Enums']['tipo_conversacion_documental']
          p_usuario_id: string
        }
        Returns: {
          actualizado_en: string
          cancelacion_solicitada_en: string | null
          completado_en: string | null
          creado_en: string
          entidad_id: string
          estado: Database['public']['Enums']['estado_trabajo_generacion_ia']
          estado_openai: string | null
          fecha_limite: string
          id: string
          iniciado_en: string
          intentos: number
          metadata: Json
          openai_response_id: string
          proxima_revision_en: string
          reclamado_hasta: string | null
          reclamado_por: string | null
          tipo_entidad: Database['public']['Enums']['tipo_trabajo_generacion_ia']
          token_reclamacion: string | null
          ultimo_error: Json | null
        }
        SetofOptions: {
          from: '*'
          to: 'trabajos_generacion_ia'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      puede_usar_carga_documental_temporal: {
        Args: { p_incluir_subido?: boolean; p_object_name: string }
        Returns: boolean
      }
      purgar_trabajos_generacion_ia: { Args: never; Returns: number }
      reasignar_responsabilidades: {
        Args: { p_actor: string; p_destino: string; p_origen: string }
        Returns: Json
      }
      recalcular_learning_quality_scores: {
        Args: { p_asignatura_id: string }
        Returns: undefined
      }
      recalcular_vectores_asignaturas: { Args: never; Returns: undefined }
      reclamar_intentos_chat_ia: {
        Args: { p_actor: string; p_limite?: number }
        Returns: Json
      }
      reclamar_intentos_generacion_ia: {
        Args: { p_actor: string; p_handler: string; p_limite?: number }
        Returns: Json
      }
      reclamar_lote_trabajos_generacion_ia: {
        Args: {
          p_arrendamiento?: string
          p_limite?: number
          p_reclamado_por: string
        }
        Returns: Array<{
          actualizado_en: string
          cancelacion_solicitada_en: string | null
          completado_en: string | null
          creado_en: string
          entidad_id: string
          estado: Database['public']['Enums']['estado_trabajo_generacion_ia']
          estado_openai: string | null
          fecha_limite: string
          id: string
          iniciado_en: string
          intentos: number
          metadata: Json
          openai_response_id: string
          proxima_revision_en: string
          reclamado_hasta: string | null
          reclamado_por: string | null
          tipo_entidad: Database['public']['Enums']['tipo_trabajo_generacion_ia']
          token_reclamacion: string | null
          ultimo_error: Json | null
        }>
        SetofOptions: {
          from: '*'
          to: 'trabajos_generacion_ia'
          isOneToOne: false
          isSetofReturn: true
        }
      }
      reclamar_trabajo_generacion_ia: {
        Args: {
          p_arrendamiento?: string
          p_openai_response_id: string
          p_reclamado_por: string
        }
        Returns: {
          actualizado_en: string
          cancelacion_solicitada_en: string | null
          completado_en: string | null
          creado_en: string
          entidad_id: string
          estado: Database['public']['Enums']['estado_trabajo_generacion_ia']
          estado_openai: string | null
          fecha_limite: string
          id: string
          iniciado_en: string
          intentos: number
          metadata: Json
          openai_response_id: string
          proxima_revision_en: string
          reclamado_hasta: string | null
          reclamado_por: string | null
          tipo_entidad: Database['public']['Enums']['tipo_trabajo_generacion_ia']
          token_reclamacion: string | null
          ultimo_error: Json | null
        }
        SetofOptions: {
          from: '*'
          to: 'trabajos_generacion_ia'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reclamar_trabajos_ingesta_documental: {
        Args: { p_arrendamiento?: string; p_limite?: number; p_worker: string }
        Returns: Array<{
          attempts: number
          available_at: string
          completed_at: string | null
          created_at: string
          file_version_id: string | null
          id: string
          idempotency_key: string
          job_type: Database['public']['Enums']['tipo_trabajo_ingesta_documental']
          last_error: Json | null
          locked_at: string | null
          locked_by: string | null
          payload: Json
          status: Database['public']['Enums']['estado_trabajo_ingesta_documental']
          tenant_id: string
          upload_session_id: string | null
        }>
        SetofOptions: {
          from: '*'
          to: 'ingestion_jobs'
          isOneToOne: false
          isSetofReturn: true
        }
      }
      registrar_entrega_webhook_ia: {
        Args: {
          p_event_id: string
          p_event_type: string
          p_openai_response_id: string
          p_payload: Json
          p_test_run_id: string
        }
        Returns: {
          delivery_count: number
          event_id: string
          event_type: string
          id: string
          last_received_at: string
          openai_response_id: string | null
          payload: Json
          processing_error: string | null
          processing_status: string
          received_at: string
          signature_valid: boolean
          test_run_id: string | null
        }
        SetofOptions: {
          from: '*'
          to: 'observability_webhook_events'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      registrar_trabajo_generacion_ia: {
        Args: {
          p_entidad_id: string
          p_estado_openai?: string
          p_iniciado_en?: string
          p_metadata?: Json
          p_openai_response_id: string
          p_tipo_entidad: Database['public']['Enums']['tipo_trabajo_generacion_ia']
        }
        Returns: {
          actualizado_en: string
          cancelacion_solicitada_en: string | null
          completado_en: string | null
          creado_en: string
          entidad_id: string
          estado: Database['public']['Enums']['estado_trabajo_generacion_ia']
          estado_openai: string | null
          fecha_limite: string
          id: string
          iniciado_en: string
          intentos: number
          metadata: Json
          openai_response_id: string
          proxima_revision_en: string
          reclamado_hasta: string | null
          reclamado_por: string | null
          tipo_entidad: Database['public']['Enums']['tipo_trabajo_generacion_ia']
          token_reclamacion: string | null
          ultimo_error: Json | null
        }
        SetofOptions: {
          from: '*'
          to: 'trabajos_generacion_ia'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reprogramar_intento_chat_ia: {
        Args: {
          p_error?: Json
          p_intento_id: string
          p_token_reclamacion: string
        }
        Returns: boolean
      }
      reprogramar_intento_generacion_ia: {
        Args: {
          p_error?: Json
          p_intento_id: string
          p_token_reclamacion: string
        }
        Returns: boolean
      }
      resumen_trabajos_generacion_ia: { Args: never; Returns: Json }
      runtests:
        | { Args: never; Returns: Array<string> }
        | { Args: { '': string }; Returns: Array<string> }
      search_asignaturas: {
        Args: {
          p_carrera_id?: string
          p_facultad_id?: string
          p_limit?: number
          p_offset?: number
          p_plan_estudio_id?: string
          p_search?: string
        }
        Returns: Array<{
          codigo: string
          contenido_tematico: Json
          creditos: number
          datos: Json
          estado: Database['public']['Enums']['estado_asignatura']
          id: string
          nombre: string
          numero_ciclo: number
          plan_estudio_id: string
          rank: number
          tipo: Database['public']['Enums']['tipo_asignatura']
          total_count: number
        }>
      }
      skip:
        | { Args: { '': string }; Returns: string }
        | { Args: { how_many: number; why: string }; Returns: string }
      solicitar_cancelacion_trabajo_generacion_ia: {
        Args: { p_openai_response_id: string }
        Returns: {
          actualizado_en: string
          cancelacion_solicitada_en: string | null
          completado_en: string | null
          creado_en: string
          entidad_id: string
          estado: Database['public']['Enums']['estado_trabajo_generacion_ia']
          estado_openai: string | null
          fecha_limite: string
          id: string
          iniciado_en: string
          intentos: number
          metadata: Json
          openai_response_id: string
          proxima_revision_en: string
          reclamado_hasta: string | null
          reclamado_por: string | null
          tipo_entidad: Database['public']['Enums']['tipo_trabajo_generacion_ia']
          token_reclamacion: string | null
          ultimo_error: Json | null
        }
        SetofOptions: {
          from: '*'
          to: 'trabajos_generacion_ia'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      solicitar_warmup_seleccion: {
        Args: {
          p_collection_ids?: Array<string>
          p_file_ids?: Array<string>
          p_tenant_id: string
          p_usuario_id: string
        }
        Returns: Array<{
          estado_seleccion: string
          hash_seleccion: string
          warmup_encolado: boolean
        }>
      }
      suma_porcentajes: { Args: { '': Json }; Returns: number }
      throws_ok: { Args: { '': string }; Returns: string }
      tipo_propiedad_json_schema: { Args: { p_prop: Json }; Returns: string }
      todo:
        | { Args: { how_many: number }; Returns: Array<boolean> }
        | { Args: { how_many: number; why: string }; Returns: Array<boolean> }
        | { Args: { why: string }; Returns: Array<boolean> }
        | { Args: { how_many: number; why: string }; Returns: Array<boolean> }
      todo_end: { Args: never; Returns: Array<boolean> }
      todo_start:
        | { Args: never; Returns: Array<boolean> }
        | { Args: { '': string }; Returns: Array<boolean> }
      transiciones_permitidas_plan: {
        Args: { p_plan_id: string }
        Returns: Array<{
          clave: string
          color: string | null
          es_campo_editable: boolean
          es_final: boolean
          etiqueta: string
          id: string
          orden: number
        }>
        SetofOptions: {
          from: '*'
          to: 'estados_plan'
          isOneToOne: false
          isSetofReturn: true
        }
      }
      unaccent_immutable: { Args: { '': string }; Returns: string }
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
          p_nuevo_estado: Database['public']['Enums']['estado_asignatura']
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
      vincular_respuesta_intento_chat_ia: {
        Args: {
          p_estado_openai?: string
          p_iniciado_en?: string
          p_intento_id: string
          p_openai_response_id: string
          p_token_reclamacion: string
        }
        Returns: Json
      }
      vincular_respuesta_intento_generacion_ia: {
        Args: {
          p_estado_openai?: string
          p_iniciado_en?: string
          p_intento_id: string
          p_openai_response_id: string
          p_token_reclamacion: string
        }
        Returns: Json
      }
    }
    Enums: {
      estado_asignatura:
        | 'borrador'
        | 'revisada'
        | 'aprobada'
        | 'generando'
        | 'fallida'
        | 'archivada'
      estado_conversacion: 'ACTIVA' | 'ARCHIVANDO' | 'ARCHIVADA' | 'ERROR'
      estado_mensaje_ia: 'PROCESANDO' | 'COMPLETADO' | 'ERROR' | 'CANCELADO'
      estado_procesamiento_documento:
        | 'pending'
        | 'processing'
        | 'ready'
        | 'partial_error'
        | 'failed'
        | 'deleted'
      estado_sesion_carga_documento:
        | 'created'
        | 'uploading'
        | 'uploaded'
        | 'hashing'
        | 'deduplicating'
        | 'extracting'
        | 'waiting_provider'
        | 'chunking'
        | 'embedding'
        | 'ready'
        | 'failed'
        | 'expired'
      estado_tarea_revision: 'PENDIENTE' | 'COMPLETADA' | 'OMITIDA'
      estado_trabajo_generacion_ia:
        | 'pendiente'
        | 'reclamado'
        | 'completado'
        | 'fallido'
        | 'cancelado'
        | 'incompleto'
        | 'expirado'
        | 'obsoleto'
      estado_trabajo_ingesta_documental:
        | 'pending'
        | 'processing'
        | 'completed'
        | 'retry'
        | 'dead_letter'
        | 'cancelled'
      fuente_cambio: 'HUMANO' | 'IA'
      learning_generation_estado:
        | 'queued'
        | 'running'
        | 'needs_review'
        | 'completed'
        | 'failed'
      learning_generation_scope: 'tema' | 'unidad' | 'asignatura'
      learning_object_tipo:
        | 'apunte'
        | 'quiz'
        | 'actividad'
        | 'ejercicios'
        | 'rubrica'
        | 'outline_presentacion'
        | 'recursos_externos'
      nivel_plan_estudio:
        | 'Licenciatura'
        | 'Maestría'
        | 'Doctorado'
        | 'Especialidad'
        | 'Diplomado'
        | 'Otro'
      permiso_archivo_documental: 'view' | 'use' | 'manage'
      puesto_tipo:
        | 'vicerrector'
        | 'director_facultad'
        | 'secretario_academico'
        | 'jefe_carrera'
        | 'profesor'
        | 'lci'
      rol_responsable_asignatura: 'PROFESOR_RESPONSABLE' | 'COAUTOR' | 'REVISOR'
      tipo_asignatura: 'OBLIGATORIA' | 'OPTATIVA' | 'TRONCAL' | 'OTRA'
      tipo_bibliografia: 'BASICA' | 'COMPLEMENTARIA'
      tipo_cambio:
        | 'ACTUALIZACION_CAMPO'
        | 'ACTUALIZACION_MAPA'
        | 'TRANSICION_ESTADO'
        | 'OTRO'
        | 'CREACION'
        | 'ACTUALIZACION'
      tipo_ciclo: 'Semestre' | 'Cuatrimestre' | 'Trimestre' | 'Otro'
      tipo_conversacion_documental: 'plan' | 'asignatura'
      tipo_estructura_plan: 'CURRICULAR' | 'NO_CURRICULAR'
      tipo_fuente_bibliografia: 'MANUAL' | 'BIBLIOTECA'
      tipo_interaccion_ia: 'GENERAR' | 'MEJORAR_SECCION' | 'OTRA'
      tipo_notificacion:
        | 'PLAN_ASIGNADO'
        | 'ESTADO_CAMBIADO'
        | 'TAREA_ASIGNADA'
        | 'COMENTARIO'
        | 'OTRA'
      tipo_origen:
        | 'MANUAL'
        | 'IA'
        | 'CLONADO_INTERNO'
        | 'CLONADO_TRADICIONAL'
        | 'OTRO'
      tipo_sujeto_archivo_documental:
        | 'user'
        | 'role'
        | 'plan'
        | 'subject'
        | 'conversation'
        | 'tenant'
      tipo_trabajo_generacion_ia:
        | 'plan'
        | 'asignatura'
        | 'chat_plan'
        | 'chat_asignatura'
        | 'recursos_aprendizaje'
        | 'observabilidad'
      tipo_trabajo_ingesta_documental:
        | 'hash_file'
        | 'extract_local'
        | 'extract_openai'
        | 'chunk'
        | 'embed'
        | 'cleanup'
        | 'openai_sync'
        | 'vs_warmup'
        | 'blob_gc'
    }
    CompositeTypes: {
      _time_trial_type: {
        a_time: number | null
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      estado_asignatura: [
        'borrador',
        'revisada',
        'aprobada',
        'generando',
        'fallida',
        'archivada',
      ],
      estado_conversacion: ['ACTIVA', 'ARCHIVANDO', 'ARCHIVADA', 'ERROR'],
      estado_mensaje_ia: ['PROCESANDO', 'COMPLETADO', 'ERROR', 'CANCELADO'],
      estado_procesamiento_documento: [
        'pending',
        'processing',
        'ready',
        'partial_error',
        'failed',
        'deleted',
      ],
      estado_sesion_carga_documento: [
        'created',
        'uploading',
        'uploaded',
        'hashing',
        'deduplicating',
        'extracting',
        'waiting_provider',
        'chunking',
        'embedding',
        'ready',
        'failed',
        'expired',
      ],
      estado_tarea_revision: ['PENDIENTE', 'COMPLETADA', 'OMITIDA'],
      estado_trabajo_generacion_ia: [
        'pendiente',
        'reclamado',
        'completado',
        'fallido',
        'cancelado',
        'incompleto',
        'expirado',
        'obsoleto',
      ],
      estado_trabajo_ingesta_documental: [
        'pending',
        'processing',
        'completed',
        'retry',
        'dead_letter',
        'cancelled',
      ],
      fuente_cambio: ['HUMANO', 'IA'],
      learning_generation_estado: [
        'queued',
        'running',
        'needs_review',
        'completed',
        'failed',
      ],
      learning_generation_scope: ['tema', 'unidad', 'asignatura'],
      learning_object_tipo: [
        'apunte',
        'quiz',
        'actividad',
        'ejercicios',
        'rubrica',
        'outline_presentacion',
        'recursos_externos',
      ],
      nivel_plan_estudio: [
        'Licenciatura',
        'Maestría',
        'Doctorado',
        'Especialidad',
        'Diplomado',
        'Otro',
      ],
      permiso_archivo_documental: ['view', 'use', 'manage'],
      puesto_tipo: [
        'vicerrector',
        'director_facultad',
        'secretario_academico',
        'jefe_carrera',
        'profesor',
        'lci',
      ],
      rol_responsable_asignatura: [
        'PROFESOR_RESPONSABLE',
        'COAUTOR',
        'REVISOR',
      ],
      tipo_asignatura: ['OBLIGATORIA', 'OPTATIVA', 'TRONCAL', 'OTRA'],
      tipo_bibliografia: ['BASICA', 'COMPLEMENTARIA'],
      tipo_cambio: [
        'ACTUALIZACION_CAMPO',
        'ACTUALIZACION_MAPA',
        'TRANSICION_ESTADO',
        'OTRO',
        'CREACION',
        'ACTUALIZACION',
      ],
      tipo_ciclo: ['Semestre', 'Cuatrimestre', 'Trimestre', 'Otro'],
      tipo_conversacion_documental: ['plan', 'asignatura'],
      tipo_estructura_plan: ['CURRICULAR', 'NO_CURRICULAR'],
      tipo_fuente_bibliografia: ['MANUAL', 'BIBLIOTECA'],
      tipo_interaccion_ia: ['GENERAR', 'MEJORAR_SECCION', 'OTRA'],
      tipo_notificacion: [
        'PLAN_ASIGNADO',
        'ESTADO_CAMBIADO',
        'TAREA_ASIGNADA',
        'COMENTARIO',
        'OTRA',
      ],
      tipo_origen: [
        'MANUAL',
        'IA',
        'CLONADO_INTERNO',
        'CLONADO_TRADICIONAL',
        'OTRO',
      ],
      tipo_sujeto_archivo_documental: [
        'user',
        'role',
        'plan',
        'subject',
        'conversation',
        'tenant',
      ],
      tipo_trabajo_generacion_ia: [
        'plan',
        'asignatura',
        'chat_plan',
        'chat_asignatura',
        'recursos_aprendizaje',
        'observabilidad',
      ],
      tipo_trabajo_ingesta_documental: [
        'hash_file',
        'extract_local',
        'extract_openai',
        'chunk',
        'embed',
        'cleanup',
        'openai_sync',
        'vs_warmup',
        'blob_gc',
      ],
    },
  },
} as const
