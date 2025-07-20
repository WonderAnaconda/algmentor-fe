import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { DemoAnalysis } from '@/components/DemoAnalysis';
import { ArrowLeft, TrendingUp, Menu } from 'lucide-react';
import AuthStatus from '@/components/AuthStatus';
import { supabase } from '@/integrations/supabase/client';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
} from '@/components/ui/dropdown-menu';

export default function DemoAnalysisPage() {
  const navigate = useNavigate();
  const [isLoggedIn, setIsLoggedIn] = React.useState(false);

  React.useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setIsLoggedIn(!!data.user);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
    });
    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);

  const handleGetAnalysis = () => {
    if (isLoggedIn) {
      navigate('/dashboard');
    } else {
      navigate('/login');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Removed Back to Home button for demo screen */}
            <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <div className="p-2 rounded-lg bg-gradient-primary">
                <TrendingUp className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="font-bold text-lg">AlgMentor</h1>
                <p className="text-xs text-muted-foreground">Demo Analysis</p>
              </div>
            </Link>
            <div className="flex items-center gap-2">
              {/* Desktop buttons */}
              <div className="hidden md:flex items-center gap-2">
                <Button onClick={handleGetAnalysis} className="bg-gradient-primary shadow-glow">
                  Get Your Analysis
                </Button>
                <AuthStatus />
              </div>
              {/* Hamburger menu for mobile */}
              <div className="flex md:hidden">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="Open menu">
                      <Menu className="h-6 w-6" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-[160px] flex flex-col space-y-2">
                    <DropdownMenuItem asChild>
                      <Button className="flex items-center justify-center w-full min-h-[44px] px-4 bg-gradient-primary shadow-glow font-semibold" size="sm" onClick={handleGetAnalysis}>
                        Get Your Analysis
                      </Button>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      {isLoggedIn ? (
                        <Button
                          className="flex items-center justify-center w-full min-h-[44px] px-4 bg-gradient-primary shadow-glow font-semibold"
                          size="sm"
                          onClick={async () => {
                            await supabase.auth.signOut();
                            navigate('/');
                          }}
                        >
                          Logout
                        </Button>
                      ) : (
                        <Button
                          className="flex items-center justify-center w-full min-h-[44px] px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                          size="sm"
                          onClick={() => navigate('/login')}
                        >
                          Sign In
                        </Button>
                      )}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        <DemoAnalysis />
      </main>
    </div>
  );
}