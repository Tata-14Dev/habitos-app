import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { DEMO } from './demoFlag'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** `null` when the app runs without Supabase configured (local-only mode) or in demo mode. */
export const supabase: SupabaseClient | null =
  !DEMO && url && anonKey
    ? createClient(url, anonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
      })
    : null

export const syncConfigured = supabase !== null
