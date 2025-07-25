import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
import { landingCopy } from '../landingCopy';
import Navbar from "@/components/Navbar";
import Aurora from '../components/Aurora';

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

  // Map icons to features from landingCopy
  const featureIcons = [BarChart3, Target, Shield, Zap, Users, TrendingUp];
  const features = landingCopy.featuresSection.features.map((feature, idx) => ({
    ...feature,
    icon: featureIcons[idx]
  }));

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero Section */}
      <section className="flex items-center justify-center py-20 px-6 min-h-[85vh] relative z-10">

        <div className="absolute inset-0 w-full h-full z-0 pointer-events-none">
            <Aurora
              colorStops={['#3c83f6', '#6da2f8', '#3c83f6', '#16a249']}
              blend={0.8}
              amplitude={0.5}
              speed={0.8}
            />
        </div>

        <div className="container mx-auto text-center space-y-8 flex flex-col justify-center relative z-10">

          <div className="space-y-4">
            <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-primary via-primary-glow to-accent bg-clip-text text-transparent homepage-gradient-heading">
              {landingCopy.hero.heading}
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              {landingCopy.hero.description}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              onClick={handleStart}
              className="bg-gradient-primary hover:opacity-90 shadow-glow text-lg px-8 py-3"
            >
              {landingCopy.hero.startAnalyzing}
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              onClick={() => navigate('/demo')}
              className="text-lg px-8 py-3"
            >
              {landingCopy.hero.viewDemo}
            </Button>
          </div>
        </div>
      </section>

      {/* Edge Section */}
      <section className="py-20 px-6 bg-gradient-to-br from-blue-900 via-primary-glow to-green-900/80">
        <div className="container mx-auto">
          <Card className="bg-card/90 shadow-glow/10 p-10 md:p-16">
            <div className="text-center mb-16 space-y-4">
              <h2 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary via-primary-glow to-accent bg-clip-text text-transparent pb-6">
                {landingCopy.edgeSection.heading}
              </h2>
              {/* Render description as HTML to support <em> tag for cursive */}
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto" dangerouslySetInnerHTML={{ __html: landingCopy.edgeSection.description }} />
            </div>
            <div className="grid gap-8 md:grid-cols-3">
              {landingCopy.edgeSection.points.map((point, idx) => {
                const icons = [Target, Zap, Users];
                const Icon = icons[idx];
                return (
                  <div key={point.key} className="flex flex-col items-center text-center p-6 rounded-xl bg-background/80 shadow-card hover:shadow-glow/20 transition-all duration-300">
                    <div className="w-12 h-12 mb-4 flex items-center justify-center rounded-full bg-primary/10">
                      <Icon className="h-7 w-7 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">{point.title}</h3>
                    <p className="text-muted-foreground">{point.description}</p>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6 bg-muted/20">
        <div className="container mx-auto">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl md:text-4xl font-bold">{landingCopy.featuresSection.heading}</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              {landingCopy.featuresSection.description}
            </p>
          </div>
          
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => (
              <Card
                key={feature.key}
                className="group bg-gradient-card shadow-card hover:shadow-glow/30 hover:scale-[1.03] hover:ring-2 hover:ring-primary/40 transition-all duration-300 ease-out cursor-pointer"
              >
                <CardContent className="p-6 space-y-4 flex flex-col items-center">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-2 transition-all duration-300 group-hover:-translate-y-1 group-hover:bg-primary/20">
                    <feature.icon className="h-7 w-7 text-primary transition-all duration-300 group-hover:text-accent" />
                  </div>
                  <h3 className="text-xl font-semibold text-center transition-colors duration-300 group-hover:text-primary">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground text-center transition-colors duration-300 group-hover:text-foreground/90">
                    {feature.description}
                  </p>
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
                {landingCopy.cta.heading}
              </h2>
              <p className="text-primary-foreground/80 text-lg max-w-2xl mx-auto">
                {landingCopy.cta.description}
              </p>
              <Button 
                size="lg" 
                variant="secondary"
                onClick={() => navigate('/login')}
                className="text-lg px-2 md:px-4 min-h-[64px] bg-background text-foreground hover:bg-background/90 whitespace-pre-line text-center"
              >
                {landingCopy.cta.startToday}
              </Button>
            </div>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-border">
        <div className="container mx-auto text-center text-muted-foreground">
          <p>{landingCopy.footer.copyright}</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
