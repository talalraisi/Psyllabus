import { createClient } from '@supabase/supabase-js'

/**
 * Supabase with the service role, for the one job a student must never be
 * able to do for themselves: setting their plan after a payment. Server
 * only, and only from app/api/billing/webhook.
 */
export function supabaseAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
