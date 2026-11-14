import { createClient } from '@supabase/supabase-js'
import { config } from './config'

// Cliente con service_role: SOLO se usa en el servidor, nunca en el frontend.
export const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})
