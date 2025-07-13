import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Chrome, TrendingUp } from 'lucide-react';

interface AuthCardProps {
  isLogin?: boolean;
  onToggleMode?: () => void;
  onGoogleAuth?: () => void;
  onEmailAuth?: (email: string, password: string) => void;
}

export function AuthCard({ 
  isLogin = true, 
  onToggleMode, 
  onGoogleAuth, 
  onEmailAuth 
}: AuthCardProps) {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onEmailAuth?.(email, password);
  };

  return (
    <Card className="w-full max-w-md bg-gradient-card shadow-card border-border/50">
      <CardHeader className="text-center space-y-4">
        <div className="flex items-center justify-center gap-2">
          <div className="p-2 rounded-lg bg-gradient-primary">
            <TrendingUp className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold">TradeAnalyzer</h1>
            <p className="text-xs text-muted-foreground">Performance Analytics</p>
          </div>
        </div>
        <div>
          <CardTitle className="text-2xl">
            {isLogin ? 'Welcome back' : 'Create account'}
          </CardTitle>
          <CardDescription>
            {isLogin 
              ? 'Sign in to analyze your trading performance' 
              : 'Start analyzing your trades today'
            }
          </CardDescription>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <Button 
          variant="outline" 
          className="w-full bg-background/50 hover:bg-background/70 border-border/50"
          onClick={onGoogleAuth}
        >
          <Chrome className="mr-2 h-4 w-4" />
          Continue with Google
        </Button>
        
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <Separator />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">Or continue with email</span>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-background/50 border-border/50"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-background/50 border-border/50"
              required
            />
          </div>
          
          <Button 
            type="submit" 
            className="w-full bg-gradient-primary hover:opacity-90 shadow-glow"
          >
            {isLogin ? 'Sign In' : 'Create Account'}
          </Button>
        </form>
        
        <div className="text-center">
          <Button variant="link" onClick={onToggleMode} className="text-muted-foreground hover:text-foreground">
            {isLogin 
              ? "Don't have an account? Sign up" 
              : "Already have an account? Sign in"
            }
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}