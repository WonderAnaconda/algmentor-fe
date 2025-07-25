import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import AuthStatus from '@/components/AuthStatus';
import { landingCopy } from '../landingCopy';
import { TrendingUp, Menu } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';

const Navbar = () => {
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

  return (
    <nav className="border-b border-border bg-card/50 backdrop-blur z-10">
      <div className="container mx-auto px-6 py-4 min-h-[72px]">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="p-2 rounded-lg bg-gradient-primary flex items-center group-hover:scale-105 transition-transform">
              <TrendingUp className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-xl">{landingCopy.nav.title}</h1>
              <p className="text-xs text-muted-foreground">{landingCopy.nav.subtitle}</p>
            </div>
          </Link>
          {/* Center nav links */}
          <div className="flex-1 flex justify-center">
            <nav className="flex gap-6">
              <Link to="/academy" className="text-base font-medium text-muted-foreground hover:text-primary transition-colors">
                Academy
              </Link>
              {/* Add more nav entries here as needed */}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            {/* Desktop buttons */}
            <div className="hidden md:flex items-center gap-4">
              <Button onClick={() => {
                if (isLoggedIn) navigate('/dashboard');
                else navigate('/login');
              }} className="bg-gradient-primary shadow-glow">
                {landingCopy.nav.getStarted}
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
                    <Button className="flex items-center justify-center w-full min-h-[44px] px-4 bg-gradient-primary shadow-glow font-semibold" size="sm" onClick={() => {
                      if (isLoggedIn) navigate('/dashboard');
                      else navigate('/login');
                    }}>
                      {landingCopy.nav.getStarted}
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
                        {landingCopy.nav.logout}
                      </Button>
                    ) : (
                      <Button
                        className="flex items-center justify-center w-full min-h-[44px] px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                        size="sm"
                        onClick={() => navigate('/login')}
                      >
                        {landingCopy.nav.signIn}
                      </Button>
                    )}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar; 