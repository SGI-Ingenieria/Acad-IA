export {
  AgenteProvider,
  useAgente,
  useAgenteOpcional,
  ambitoKey,
} from './AgenteContext'
export type {
  AgenteContextValue,
  AmbitoAgente,
  EntradaPila,
} from './AgenteContext'

export { AgenteDock } from './AgenteDock'
export { AgenteAurora } from './AgenteAurora'
export {
  AgenteHalo,
  usePropsHalo,
  estiloHaloAgente,
  CLASE_HALO,
} from './AgenteHalo'
export { EsqueletoAgente } from './EsqueletoAgente'
export type { AgenteHaloProps, VarianteHalo } from './AgenteHalo'
export { useColoresLineas } from './useColoresLineas'

export { TiraPostIts } from './postits/TiraPostIts'
export { PostItSugerencia } from './postits/PostItSugerencia'

export { AccionAgente } from './AccionAgente'
export { useAccionAgente, idCampoAgente } from './useAccionAgente'
export type {
  ModoAcoplamiento,
  OpcionesAccionAgente,
  ResultadoAccionAgente,
} from './useAccionAgente'
