export function buildIsolatedChatRetryContext({
  dbMessageId,
  requestContent,
}: {
  dbMessageId?: string
  requestContent?: string
}) {
  return {
    content: requestContent?.trim() ?? '',
    retryOfMessageId: dbMessageId ?? '',
  }
}
