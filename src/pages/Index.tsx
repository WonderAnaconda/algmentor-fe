import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, BarChart3, Target, Shield, Zap, Users, Menu } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
} from '@/components/ui/dropdown-menu';
import AuthStatus from '@/components/AuthStatus';
import { supabase } from '@/integrations/supabase/client';

const Index = () => {
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

  const handleStart = async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      navigate('/dashboard');
    } else {
      navigate('/login');
    }
  };

  const features = [
    {
      icon: BarChart3,
      title: "Comprehensive Analysis",
      description: "Deep dive into your trading performance with advanced metrics and visualizations"
    },
    {
      icon: Target,
      title: "AI-Powered Insights",
      description: "Get personalized recommendations to improve your trading strategy and profitability"
    },
    {
      icon: Shield,
      title: "Risk Assessment",
      description: "Identify and mitigate risks in your trading approach with detailed risk analysis"
    },
    {
      icon: Zap,
      title: "Real-time Processing",
      description: "Upload your trading data and get instant analysis with actionable insights"
    },
    {
      icon: Users,
      title: "Multi-broker Support",
      description: "Compatible with trading records from all major brokers and platforms"
    },
    {
      icon: TrendingUp,
      title: "Performance Tracking",
      description: "Monitor your progress over time and track improvement in your trading performance"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border bg-card/50 backdrop-blur">
        <div className="container mx-auto px-6 py-4 min-h-[72px]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-primary">
                <TrendingUp className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="font-bold text-xl">AlgMentor</h1>
                <p className="text-xs text-muted-foreground">Performance Analytics Platform</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {/* Desktop buttons */}
              <div className="hidden md:flex items-center gap-4">
                <Button onClick={handleStart} className="bg-gradient-primary shadow-glow">
                  Get Started
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
                      <Button className="flex items-center justify-center w-full min-h-[44px] px-4 bg-gradient-primary shadow-glow font-semibold" size="sm" onClick={handleStart}>
                        Get Started
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
      </nav>

      {/* Hero Section */}
      <section className="py-20 px-6">
        <div className="container mx-auto text-center space-y-8">
          <div className="space-y-4">
            <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-primary via-primary-glow to-accent bg-clip-text text-transparent homepage-gradient-heading">
              Optimize Your Trading Performance
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Upload your trading records and get AI-powered analysis with personalized improvement suggestions 
              to enhance your trading strategy and maximize profitability.
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              onClick={handleStart}
              className="bg-gradient-primary hover:opacity-90 shadow-glow text-lg px-8 py-3"
            >
              Start Analyzing Your Trades
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              onClick={() => navigate('/demo')}
              className="text-lg px-8 py-3"
            >
              View Demo Analysis
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6 bg-muted/20">
        <div className="container mx-auto">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl md:text-4xl font-bold">Powerful Trading Analytics</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Everything you need to understand and improve your trading performance
            </p>
          </div>
          
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => (
              <Card key={index} className="bg-gradient-card shadow-card hover:shadow-glow/20 transition-all duration-300">
                <CardContent className="p-6 space-y-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6">
        <div className="container mx-auto">
          <Card className="bg-gradient-primary p-12 text-center shadow-glow">
            <div className="space-y-6">
              <h2 className="text-3xl md:text-4xl font-bold text-primary-foreground">
                Ready to Improve Your Trading?
              </h2>
              <p className="text-primary-foreground/80 text-lg max-w-2xl mx-auto">
                Join thousands of traders who have already improved their performance with our AI-powered analysis.
              </p>
              <Button 
                size="lg" 
                variant="secondary"
                onClick={() => navigate('/login')}
                className="text-lg px-2 md:px-4 min-h-[64px] bg-background text-foreground hover:bg-background/90 whitespace-pre-line text-center"
              >
                Start Your Analysis Today
              </Button>
            </div>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-border">
        <div className="container mx-auto text-center text-muted-foreground">
          <p>&copy; 2025 AlgMentor. Built with advanced AI to help traders succeed.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
