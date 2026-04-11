import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  const isAuthPath =
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/reset-password') ||
    pathname.startsWith('/patient-login')

  const isApiPath = pathname.startsWith('/api/')
  const isPublicPath =
    pathname.startsWith('/terms') ||
    pathname.startsWith('/privacy') ||
    pathname.startsWith('/ref/')

  if (!user && !isAuthPath && !isApiPath && !isPublicPath) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Role-based routing for authenticated users
  if (user) {
    // Check cookie first for fast path
    let userType = request.cookies.get('rxnudge_user_type')?.value

    // If no cookie, fetch from DB
    if (!userType) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_type')
        .eq('id', user.id)
        .single()

      userType = profile?.user_type ?? 'caregiver'

      // Set cookie on response for fast future access
      supabaseResponse.cookies.set('rxnudge_user_type', userType ?? 'caregiver', {
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        httpOnly: false, // client-readable
        sameSite: 'lax',
      })
    }

    // Patient trying to access caregiver routes → redirect to /my-meds
    if (
      userType === 'patient' &&
      (pathname.startsWith('/dashboard') || pathname.startsWith('/patients'))
    ) {
      const url = request.nextUrl.clone()
      url.pathname = '/my-meds'
      return NextResponse.redirect(url)
    }

    // Caregiver trying to access patient route → redirect to /dashboard
    if (
      (userType === 'caregiver' || userType === 'self') &&
      pathname.startsWith('/my-meds')
    ) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
