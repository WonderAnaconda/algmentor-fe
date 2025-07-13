import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { DemoAnalysis } from '@/components/DemoAnalysis';
import { ArrowLeft, TrendingUp } from 'lucide-react';

export default function DemoAnalysisPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => navigate('/')} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Home
              </Button>
              
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gradient-primary">
                  <TrendingUp className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="font-bold text-lg">TradeAnalyzer</h1>
                  <p className="text-xs text-muted-foreground">Demo Analysis</p>
                </div>
              </div>
            </div>
            
            <Button onClick={() => navigate('/login')} className="bg-gradient-primary shadow-glow">
              Get Your Analysis
            </Button>
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