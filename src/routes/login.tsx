import { createFileRoute, redirect } from '@tanstack/react-router'

import { LoginCard } from '@/components/auth/LoginCard'
import { qk } from '@/data/query/keys'
import { supabaseBrowser } from '@/data/supabase/client'

export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: (search.redirect as string) || '/',
  }),
  beforeLoad: async ({ context, search }) => {
    const session = await context.queryClient.ensureQueryData({
      queryKey: qk.session(),
      queryFn: async () => {
        const { data } = await supabaseBrowser().auth.getSession()
        return data.session ?? null
      },
      staleTime: 0,
    })

    if (session) {
      const target =
        search.redirect && search.redirect !== '/login' ? search.redirect : '/'

      throw redirect({ to: target as any })
    }
  },
  component: LoginPage,
})

function LoginPage() {
  const { redirect: redirectTo } = Route.useSearch()

  return (
    <div className="login-bg px-grupo py-region relative flex min-h-screen items-center justify-center overflow-hidden bg-cover bg-center bg-no-repeat">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.12),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(15,23,42,0.08),transparent_40%)] dark:bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.18),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.05),transparent_40%)]" />
      <div className="relative z-10 w-full max-w-md">
        <LoginCard redirectTo={redirectTo || '/'} />
      </div>
    </div>
  )
}
