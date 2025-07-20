'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { Link, useNavigate } from 'react-router-dom'
import type { User, AuthChangeEvent, Session } from '@supabase/supabase-js'

export default function AuthStatus({ className = '', children }: { className?: string, children?: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const navigate = useNavigate();

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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/'); // Redirect to home after logout
  };

  if (user) {
    return (
      <button onClick={handleLogout} className={`bg-gray-800 hover:bg-gray-700 text-white font-semibold py-2 px-6 rounded-lg ml-2 ${className}`}>
        {children || 'Logout'}
      </button>
    )
  }
  return (
    <Link to="/login" className={`bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg ml-2 ${className}`}>
      {children || 'Sign In'}
    </Link>
  )
} 