// Arquivo: src/lib/supabaseClient.js
import { createClient } from '@supabase/supabase-js'

// Estas linhas buscam as chaves de API do seu arquivo .env.local
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Aqui criamos e exportamos o cliente Supabase para ser usado em toda a aplicação
export const supabase = createClient(supabaseUrl, supabaseAnonKey)