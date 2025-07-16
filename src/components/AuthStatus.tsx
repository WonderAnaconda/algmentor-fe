'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { Link } from 'react-router-dom'
import type { User, AuthChangeEvent, Session } from '@supabase/supabase-js'

export default function AuthStatus() {
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user as User | null)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      setUser(session?.user ?? null)
    })
    return () => {
      listener?.subscription.unsubscribe()
    }
  }, [])

  if (user) {
    return (
      <button onClick={() => supabase.auth.signOut()} className="bg-gray-800 hover:bg-gray-700 text-white font-semibold py-2 px-6 rounded-lg ml-2">Logout</button>
    )
  }
  return (
    <Link to="/login" className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg ml-2">Sign In</Link>
  )
} 