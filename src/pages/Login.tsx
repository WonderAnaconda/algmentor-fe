'use client'
import React, { useState } from 'react';
import { AuthCard } from '@/components/AuthCard';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const navigate = useNavigate();

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-[#1a2332] to-[#232b3b] p-4"
      onClick={() => navigate(-1)}
    >
      <div
        className="w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        <AuthCard isLogin={isLogin} onToggleMode={() => setIsLogin((v) => !v)} />
      </div>
    </div>
  );
}