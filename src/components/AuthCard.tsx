import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Chrome, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AuthCardProps {
  isLogin?: boolean;
  onToggleMode?: () => void;
  onSuccess?: () => void;
}

export function AuthCard({ 
  isLogin = true, 
  onToggleMode, 
  onSuccess 
}: AuthCardProps) {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const { toast } = useToast();

  const handleGoogleAuth = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`
        }
      });
      
      if (error) throw error;
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        
        toast({
          title: "Success",
          description: "Signed in successfully!",
        });
        onSuccess?.();
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: {
              full_name: email.split('@')[0]
            }
          }
        });
        
        if (error) throw error;
        
        // Call the notify-new-user function
        try {
          await supabase.functions.invoke('notify-new-user', {
            body: {
              email,
              full_name: email.split('@')[0]
            }
          });
        } catch (notifyError) {
          console.error('Failed to send notification email:', notifyError);
        }
        
        toast({
          title: "Account created!",
          description: "Please check your email to confirm your account.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
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
          type="button"
          className="w-full flex items-center justify-center gap-2 bg-white text-black border border-gray-300 shadow-sm hover:bg-gray-100 font-medium py-2 px-4 rounded-md transition-colors duration-150"
          onClick={handleGoogleAuth}
          disabled={loading}
        >
          <svg className="mr-2 h-5 w-5" viewBox="0 0 48 48"><g><path d="M44.5 20H24v8.5h11.7C34.7 32.9 30.1 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.5 6.5 29.6 4.5 24 4.5 12.7 4.5 3.5 13.7 3.5 25S12.7 45.5 24 45.5c10.5 0 19.5-8.5 19.5-19.5 0-1.3-.1-2.2-.3-3z" fill="#FFC107"/><path d="M6.3 14.7l7 5.1C15.1 17.1 19.2 14.5 24 14.5c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.5 6.5 29.6 4.5 24 4.5c-7.2 0-13.3 4.1-16.7 10.2z" fill="#FF3D00"/><path d="M24 45.5c5.9 0 10.8-1.9 14.4-5.2l-6.6-5.4c-2 1.4-4.6 2.2-7.8 2.2-6.1 0-11.3-4.1-13.2-9.6l-7 5.4C7.1 41.1 14.9 45.5 24 45.5z" fill="#4CAF50"/><path d="M44.5 20H24v8.5h11.7c-1.1 3.1-4.1 5.5-7.7 5.5-2.2 0-4.2-.7-5.7-2.1l-7 5.4C17.1 41.1 20.3 45.5 24 45.5c6.1 0 11.3-4.1 13.2-9.6l7-5.4C46.9 32.9 44.5 20 44.5 20z" fill="#1976D2"/></g></svg>
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
        
        <form onSubmit={handleEmailAuth} className="space-y-4">
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