import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileUpload } from '@/components/ui/file-upload';
import { TradingDashboard } from '@/components/TradingDashboard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LogOut, TrendingUp, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Mock data for demonstration
const mockMetrics = {
  totalTrades: 247,
  winRate: 64.2,
  profitLoss: 15750,
  avgWin: 235,
  avgLoss: 156,
  maxDrawdown: 8.3,
  sharpeRatio: 1.47
};

const mockSuggestions = [
  {
    id: '1',
    type: 'risk' as const,
    title: 'High Position Sizing on Low Probability Trades',
    description: 'You tend to risk 3-5% on trades with win rates below 45%. Consider reducing position size to 1-2% for these setups.',
    impact: 'high' as const,
    category: 'Risk Management'
  },
  {
    id: '2',
    type: 'opportunity' as const,
    title: 'Underutilized Momentum Breakouts',
    description: 'Your momentum breakout strategy shows 78% win rate but only represents 12% of your trades. Consider increasing allocation.',
    impact: 'medium' as const,
    category: 'Strategy Allocation'
  },
  {
    id: '3',
    type: 'strategy' as const,
    title: 'Exit Strategy Optimization',
    description: 'Analysis shows you could improve returns by 23% using trailing stops instead of fixed targets on trending trades.',
    impact: 'high' as const,
    category: 'Exit Strategy'
  }
];

export default function Dashboard() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [hasUploadedFile, setHasUploadedFile] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    setUploadProgress(0);
    setHasUploadedFile(true);

    // Simulate upload progress
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 95) {
          clearInterval(interval);
          setTimeout(() => {
            setIsUploading(false);
            setShowResults(true);
            toast({
              title: "Analysis Complete!",
              description: "Your trading performance has been analyzed. Check your improvement suggestions below.",
            });
          }, 500);
          return 100;
        }
        return prev + Math.random() * 15;
      });
    }, 200);
  };

  const handleLogout = () => {
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-primary">
                <TrendingUp className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="font-bold text-lg">TradeAnalyzer</h1>
                <p className="text-xs text-muted-foreground">Performance Dashboard</p>
              </div>
            </div>
            
            <Button variant="ghost" onClick={handleLogout} className="gap-2">
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        <div className="space-y-8">
          {/* Welcome Section */}
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
              Trading Performance Analysis
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Upload your trading records to get detailed performance analysis and AI-powered improvement suggestions
            </p>
          </div>

          {/* Upload Section */}
          {!showResults && (
            <Card className="max-w-2xl mx-auto bg-gradient-card shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5 text-primary" />
                  Upload Trading Records
                </CardTitle>
              </CardHeader>
              <CardContent>
                <FileUpload
                  onFileUpload={handleFileUpload}
                  isUploading={isUploading}
                  uploadProgress={uploadProgress}
                />
              </CardContent>
            </Card>
          )}

          {/* Results Section */}
          {(showResults || hasUploadedFile) && (
            <TradingDashboard
              metrics={showResults ? mockMetrics : undefined}
              suggestions={showResults ? mockSuggestions : undefined}
              isLoading={isUploading}
            />
          )}

          {/* Info Section */}
          {!hasUploadedFile && (
            <div className="max-w-4xl mx-auto">
              <div className="grid gap-6 md:grid-cols-3">
                <Card className="bg-gradient-card shadow-card">
                  <CardContent className="p-6 text-center">
                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                      <Upload className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="font-semibold mb-2">Easy Upload</h3>
                    <p className="text-sm text-muted-foreground">
                      Support for CSV and Excel formats from all major brokers
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-card shadow-card">
                  <CardContent className="p-6 text-center">
                    <div className="w-12 h-12 bg-profit/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                      <TrendingUp className="h-6 w-6 text-profit" />
                    </div>
                    <h3 className="font-semibold mb-2">AI Analysis</h3>
                    <p className="text-sm text-muted-foreground">
                      Advanced algorithms analyze your trading patterns and performance
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-card shadow-card">
                  <CardContent className="p-6 text-center">
                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                      <TrendingUp className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="font-semibold mb-2">Actionable Insights</h3>
                    <p className="text-sm text-muted-foreground">
                      Get specific recommendations to improve your trading performance
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}