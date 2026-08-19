const decoder = new TextDecoder()

export async function readWebhookBody(request) {
  if (typeof request?.arrayBuffer !== 'function') {
    throw new TypeError('Azure webhook request has no arrayBuffer method.')
  }

  return decoder.decode(await request.arrayBuffer())
}
