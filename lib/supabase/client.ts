import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // During some build/prerender steps, env vars may not be present.
  // Avoid crashing the build; at runtime these must be set.
  if (!url || !anon) {
    throw new Error('Supabase env not configured')
  }

  return createBrowserClient(url, anon)
}
