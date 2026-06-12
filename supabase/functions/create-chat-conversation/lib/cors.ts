export const corsHeaders: Record<string, string> = {
  'access-control-allow-origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform',
  'access-control-allow-methods': 'GET,POST,OPTIONS,DELETE',
}

export function withCors(res: Response) {
  const h = new Headers(res.headers)
  for (const [k, v] of Object.entries(corsHeaders)) h.set(k, v)
  return new Response(res.body, { status: res.status, headers: h })
}
