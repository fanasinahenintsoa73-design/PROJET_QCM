import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { startSync } from '@/lib/sync'
import { isSupabaseConfigured } from '@/lib/supabase'

// Le serveur JSON local est réservé à la démonstration. En production, les
// données passent par Supabase Auth/Postgres/Storage.
if (!isSupabaseConfigured) void startSync()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
