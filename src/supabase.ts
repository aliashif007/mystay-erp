import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = "https://bnxorlbrykqkevebywph.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJueG9ybGJyeWtxa2V2ZWJ5d3BoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MzkwODYsImV4cCI6MjA5MDQxNTA4Nn0.eqdgoe7z0vxdfnP-b_Dw2PNAu46Mr0wZLqmMmz_q8jU"

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)