import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthCard } from '@/components/AuthCard';
import { useToast } from '@/hooks/use-toast';

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleGoogleAuth = () => {
    toast({
      title: "Google Authentication",
      description: "Connect to Supabase to enable Google OAuth authentication.",
    });
    // For now, simulate successful login
    setTimeout(() => {
      navigate('/dashboard');
    }, 1000);
  };

  const handleEmailAuth = (email: string, password: string) => {
    toast({
      title: isLogin ? "Signing in..." : "Creating account...",
      description: "Connect to Supabase to enable email authentication.",
    });
    // For now, simulate successful login
    setTimeout(() => {
      navigate('/dashboard');
    }, 1000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5" />
      <div className="relative">
        <AuthCard
          isLogin={isLogin}
          onToggleMode={() => setIsLogin(!isLogin)}
          onGoogleAuth={handleGoogleAuth}
          onEmailAuth={handleEmailAuth}
        />
      </div>
    </div>
  );
}