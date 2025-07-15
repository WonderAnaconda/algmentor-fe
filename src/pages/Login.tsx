import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthCard } from '@/components/AuthCard';
import { supabase } from '@/integrations/supabase/client';

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is already logged in
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate('/dashboard');
      }
    };
    
    checkAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        navigate('/dashboard');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSuccess = () => {
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5" />
      <div className="relative">
        <AuthCard
          isLogin={isLogin}
          onToggleMode={() => setIsLogin(!isLogin)}
          onSuccess={handleSuccess}
        />
      </div>
    </div>
  );
}