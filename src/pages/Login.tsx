'use client'
import React, { useState } from 'react';
import { AuthCard } from '@/components/AuthCard';

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-[#1a2332] to-[#232b3b] p-4">
      <div className="w-full max-w-md">
        <AuthCard isLogin={isLogin} onToggleMode={() => setIsLogin((v) => !v)} />
      </div>
    </div>
  );
}