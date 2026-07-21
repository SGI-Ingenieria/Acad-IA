// Punto de entrada estable para la función de chat. La implementación vive en
// `_shared` porque el cron y el webhook deben ejecutar exactamente el mismo
// protocolo durable de preparación, CAS y publicación.
export {
  buildChatAttemptOpenAIRequest,
  prepareChatGenerationAttempt,
  publishDurableChatResponse,
  requeueChatGenerationAttempt,
} from '../../_shared/chat-generation-attempts.ts'

export type {
  ChatAttemptClient,
  ChatGenerationAttempt,
  PrepareChatAttemptArgs,
  PublishDurableChatResponseArgs,
} from '../../_shared/chat-generation-attempts.ts'
