export type AIGeneratePlanInput = {
  clonacionPlan?: boolean;
  datosBasicos: {
    nombrePlan?: string;
    fechaInicioImparticion?: string | null;
    confirmarFechaPasada?: boolean;
    carreraId?: string;
    facultadId?: string;
    tipoCiclo: "Semestre" | "Cuatrimestre" | "Trimestre" | "Otro";
    numCiclos: number;
    estructuraPlanId: string;
  };
  iaConfig: {
    descripcionEnfoqueAcademico?: string;
    instruccionesAdicionalesIA?: string;
    references?: {
      fileIds?: Array<string>;
      collectionIds?: Array<string>;
    };
    webSearchEnabled?: boolean;
    reasoningEffort?: "auto" | "none" | "low" | "medium" | "high";
  };
  lineas?: Array<{
    nombre: string;
    orden: number;
    area?: string;
    color?: string | null;
  }>;
};
