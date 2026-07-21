// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

console.log('Hello from Functions!')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

const jsonHeaders = {
  ...corsHeaders,
  'Content-Type': 'application/json',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    })
  }

  if (req.method === 'GET') {
    return new Response(
      JSON.stringify({
        ok: true,
        function: 'prueba',
      }),
      { headers: jsonHeaders },
    )
  }

  let payload: { name?: unknown }

  try {
    payload = await req.json()
  } catch {
    return new Response(
      JSON.stringify({
        error: 'JSON invalido o faltante.',
      }),
      {
        status: 400,
        headers: jsonHeaders,
      },
    )
  }

  const name =
    typeof payload.name === 'string' && payload.name.trim()
      ? payload.name.trim()
      : 'Functions'
  const data = {
    message: `Hello ${name}!`,
  }

  return new Response(JSON.stringify(data), {
    headers: jsonHeaders,
  })
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  Bash:
  curl -i --location --request POST 'https://mrx7013v-54321.usw3.devtunnels.ms/functions/v1/prueba' \
    --header 'Authorization: Bearer eyJhbGciOiJFUzI1NiIsImtpZCI6ImI4MTI2OWYxLTIxZDgtNGYyZS1iNzE5LWMyMjQwYTg0MGQ5MCIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjIwOTIwNjg3NTd9.HmpFyXs63M9xIUxaGSROHRCnLB3eThNtijiGtclYwSFwsF7IGBkYvG8zQkxTgUcEEc1B-8cQV1F6sdkXZZgoZw' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

  PowerShell:
  curl.exe -i --location --request POST 'https://mrx7013v-54321.usw3.devtunnels.ms/functions/v1/prueba' `
     --header 'Authorization: Bearer eyJhbGciOiJFUzI1NiIsImtpZCI6ImI4MTI2OWYxLTIxZDgtNGYyZS1iNzE5LWMyMjQwYTg0MGQ5MCIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjIwOTIwNjg3NTd9.HmpFyXs63M9xIUxaGSROHRCnLB3eThNtijiGtclYwSFwsF7IGBkYvG8zQkxTgUcEEc1B-8cQV1F6sdkXZZgoZw' `
     --header 'Content-Type: application/json' `
     --data '{\"name\":\"Functions\"}'

*/
