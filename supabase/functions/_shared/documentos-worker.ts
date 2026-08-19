import { requireEnv } from './env.ts'

export function documentWorkerRequest(args: {
  supabaseUrl: string
  serviceRoleKey: string
  source: string
}): { url: string; init: RequestInit } {
  return {
    url: `${args.supabaseUrl.replace(/\/$/, '')}/functions/v1/process-file-jobs`,
    init: {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${args.serviceRoleKey}`,
        apikey: args.serviceRoleKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ source: args.source }),
    },
  }
}

export async function wakeDocumentWorker(source: string): Promise<void> {
  const request = documentWorkerRequest({
    supabaseUrl: requireEnv('SUPABASE_URL'),
    serviceRoleKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    source,
  })
  const response = await fetch(request.url, request.init)
  if (!response.ok) {
    throw new Error(
      `process-file-jobs respondió ${response.status} al despertar la cola`,
    )
  }
}
